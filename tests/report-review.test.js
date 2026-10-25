import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sessionClient } from './support/client.js';
import { validateExtraction, confirmReportReview, explicitDate } from '../report-extraction.js';

const user = content => ({ role: 'user', content });
const item = (field, value, quote, messageId = 'u1', kind = 'observed') => ({ field, value, kind, evidence: [{ messageId, quote }] });
const review = (messages, candidates, mode = 'incident') => validateExtraction({ mode, candidates }, messages);
const select = value => ({ reviewId: value.id, confirmed: true, selections: value.candidates.map(c => ({ id: c.id, value: c.value })) });

test('咨询、假设与处置建议即使被模型误分类，也不能成为事件事实', () => {
  for (const text of ['如果孩子遭受性侵怎么办？', '学生出现伤痕并害怕回家，教师应该怎么做？', '例如孩子说被打了', '老师建议立即报警', '我打算联系医院', '我准备报警', '万一孩子被打我会报警']) {
    const value = review([user(text)], [item('description', '被改写成事件的文本', text)]);
    assert.equal(value.candidates.length, 0, text); assert.equal(value.excluded.length, 1);
    assert.throws(() => confirmReportReview({ messages: [user(text)], reportReview: value }, select(value)), /核对|勾选/);
  }
  assert.equal(review([user('我是教师，我今天看到学生手臂有伤痕，怎么办？')], [item('description', '猜测的描述', '学生手臂有伤痕')]).candidates.length, 1);
  assert.equal(review([user('我看到学生有伤痕')], [item('description', '学生有伤痕', '学生有伤痕')], 'consultation').candidates.length, 0);
});

test('服务端保留完整否定句，拒绝从否定内容提取类型及地点', () => {
  const messages = [user('未发现家庭暴力，只是同学争吵。地点不是长沙市。')];
  const value = review(messages, [item('description', '家庭暴力', '家庭暴力'), item('types', '家庭暴力', '家庭暴力'), item('region', '长沙市', '长沙市')]);
  assert.equal(value.candidates.length, 1); assert.equal(value.candidates[0].value, '未发现家庭暴力，只是同学争吵。');
  const draft = confirmReportReview({ messages, reportReview: value }, select(value));
  assert.deepEqual(draft.fields.types, []); assert.equal(draft.fields.region, ''); assert.match(draft.fields.description, /^未发现/);
  for (const text of ['家长否认存在家庭暴力', '并非家庭暴力', '排除家庭暴力']) assert.equal(review([user(text)], [item('types', '家庭暴力', '家庭暴力')]).candidates.length, 0);
});

test('来源仅允许当前用户消息，AI、其他会话与无出处值一律拒绝', () => {
  const messages = [user('我看到学生有伤痕'), { role: 'assistant', content: '事发于2026年10月25日9时30分，在北京。' }];
  const value = review(messages, [item('description', '模型编造案情', '学生有伤痕'), item('region', '北京', '北京'), item('age', '7-13岁', '十三岁', 'u2'), item('address', '虚构地址', '学生有伤痕')]);
  assert.equal(value.candidates.length, 1); assert.equal(value.candidates[0].value, '我看到学生有伤痕');
  assert.equal(value.warnings.length, 3);
  assert.equal(value.missing.includes('age'), true); assert.equal(value.missing.includes('occurredAt'), true);
});

test('转述与推测不升级为观察事实，确认后仍保留待核实标记', () => {
  const messages = [user('听邻居说孩子被打，我猜可能与家庭暴力有关。')];
  const value = review(messages, [item('description', '孩子遭受家庭暴力', '孩子被打'), item('types', '家庭暴力', '家庭暴力')]);
  assert.equal(value.candidates.length, 1); assert.equal(value.candidates[0].pending, true);
  const draft = confirmReportReview({ messages, reportReview: value }, select(value));
  assert.match(draft.fields.description, /^用户转述（待核实）：听邻居说/); assert.deepEqual(draft.fields.types, []);
});

test('年月日时分、年龄和报告者身份只做明确原话的机械规范化', () => {
  const messages = [user('我是一名教师。孩子13岁。2026年10月25日9时30分，我在湖南省长沙市岳麓区看见孩子手臂有伤痕。')];
  const value = review(messages, [item('identity', '教师/教育工作者', '我是一名教师'), item('age', '7-13岁', '孩子13岁'), item('occurredAt', '2026-10-25T09:30', '2026年10月25日9时30分'), item('region', '湖南省 长沙市 岳麓区', '湖南省长沙市岳麓区'), item('description', '案情重写', '孩子手臂有伤痕')]);
  assert.equal(value.candidates.length, 5);
  const draft = confirmReportReview({ messages, reportReview: value }, select(value));
  assert.equal(draft.fields.occurredAt, '2026-10-25T09:30'); assert.equal(draft.fields.age, '7-13岁'); assert.equal(draft.fields.region, '湖南省 长沙市 岳麓区');
  assert.equal(explicitDate('2026-02-30T09:30'), ''); assert.equal(explicitDate('昨天9点30分'), '');
  assert.equal(review([user('我是老师的朋友')], [item('identity', '教师/教育工作者', '我是老师的朋友')]).candidates.length, 0);
  assert.equal(review([user('孩子未满14岁')], [item('age', '7-13岁', '孩子未满14岁')]).candidates.length, 0);
});

test('更正冲突要用户选择，变更对话、伪造核对项、未确认均不能写入', () => {
  const messages = [user('地点是虚构甲校。我看到学生手臂有伤痕。'), user('更正地点是虚构乙校。')];
  const value = review(messages, [item('address', '虚构甲校', '虚构甲校'), item('address', '虚构乙校', '虚构乙校', 'u2'), item('description', '手臂有伤痕', '学生手臂有伤痕')]);
  assert.equal(value.candidates.filter(c => c.conflict).length, 2);
  const session = { messages, reportReview: value };
  assert.throws(() => confirmReportReview(session, select(value)), /只保留一个/);
  const choice = select(value); choice.selections.shift();
  const draft = confirmReportReview(session, choice); assert.equal(draft.fields.address, '虚构乙校');
  assert.throws(() => confirmReportReview(session, { ...choice, confirmed: false }), /核对/);
  assert.throws(() => confirmReportReview(session, { ...choice, selections: [{ id: 'fake', value: '伪造' }] }), /无效/);
  session.messages.push(user('我补充了一条新信息'));
  assert.throws(() => confirmReportReview(session, choice), e => e.status === 409);
});

test('用户修改留有审计记录，AI无出处字段不能绕过选择直接注入', () => {
  const messages = [user('我看见孩子手臂有伤痕')], value = review(messages, [item('description', '改写', '孩子手臂有伤痕')]);
  const body = select(value); body.selections[0].value = '我看见孩子手臂有一处淤青，原因待核实'; body.fields = { age: '7-13岁' };
  const draft = confirmReportReview({ messages, reportReview: value }, body);
  assert.equal(draft.confirmation.selected[0].editedByUser, true); assert.equal(draft.confirmation.selected[0].evidence[0].quote, messages[0].content);
  assert.equal(draft.fields.age, ''); assert.equal(draft.fields.reporter.phone, '');
});

test('手动与工具共用用户原话抽取，确认接口隔离账号并阻止旧版本与重复草稿', async () => {
  const inputs = [];
  const upstream = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const data = JSON.parse(Buffer.concat(chunks));
    let message;
    if (!data.tools) {
      const messages = JSON.parse(data.messages.at(-1).content); inputs.push(messages);
      const source = messages.at(-1);
      message = { content: JSON.stringify({ mode: 'incident', candidates: [item('description', '模型不应改写的事实', source.content, source.id)] }) };
    } else if (!data.messages.some(m => m.role === 'tool')) message = { tool_calls: [{ id: 'prepare', type: 'function', function: { name: 'prepare_report_draft', arguments: '{}' } }] };
    else message = { content: 'AI建议不应成为用户事件事实。请核对已提取信息。' };
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ choices: [{ message }] }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-review-'));
  Object.assign(process.env, { DATA_DIR: dir, AI_CATALOG_ENABLED: '0', FREE_API_KEY: 'local-test-placeholder', AI_BASE_URL: `http://127.0.0.1:${upstream.address().port}/v1` });
  const { server } = await import('../server.js'); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`, a = sessionClient(base), b = sessionClient(base), model = '[故人情]gemini-3.8-flash';
  const call = async (client, url, body) => { const r = await client(url, { method: body ? 'POST' : 'GET', ...(body ? { body: JSON.stringify(body) } : {}), headers: { 'Content-Type': 'application/json' } }); return { status: r.status, data: await r.json() }; };
  try {
    const session = (await call(a, '/api/sessions', { kind: 'qa', model })).data, prefix = `/api/sessions/${session.id}`;
    const auto = (await call(a, prefix + '/messages', { content: '我今天看到虚构学生手臂有伤痕，希望报告', model })).data;
    assert.ok(auto.reportReview); assert.equal(auto.reportDraft, undefined);
    const manual = (await call(a, prefix + '/report-draft', { model })).data;
    assert.deepEqual(inputs[0], inputs[1], '自动与手动抽取输入一致，均无AI回复或记忆');
    assert.deepEqual(auto.reportReview.candidates.map(c => c.value), manual.candidates.map(c => c.value));
    assert.equal((await call(b, prefix + '/report-confirm', select(manual))).status, 404);
    assert.equal((await call(a, prefix + '/report-confirm', select(auto.reportReview))).status, 409);
    const confirmation = await call(a, prefix + '/report-confirm', select(manual)); assert.equal(confirmation.status, 200);
    assert.equal((await call(a, prefix + '/report-confirm', select(manual))).data.id, confirmation.data.id, '网络重试不产生重复草稿');
    const changedSelection = select(manual); changedSelection.selections[0].value += '（用户更改）';
    assert.equal((await call(a, prefix + '/report-confirm', changedSelection)).status, 409, '另一标签页不能用旧核对结果生成不同草稿');
    assert.equal((await call(a, prefix)).data.reportConfirmations.length, 1, '确认记录只追加一次');
    assert.equal((await call(a, '/api/reports')).data.length, 0, '核对不提交线索');
    await call(a, prefix + '/messages', { content: '补充：地点仍需要核实', model });
    assert.equal((await call(a, prefix + '/report-confirm', select(manual))).status, 409);
  } finally {
    server.closeAllConnections(); upstream.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await new Promise(resolve => upstream.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
