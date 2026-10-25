import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { normalizeChatImages, modelMessage } from '../chat-images.js';
import { sessionClient } from './support/client.js';
import { readEvents } from '../public/event-stream.js';

test('图片真实传输、能力检测及失败不误判，重试停止和账号隔离', async () => {
  let wrong = false, gate = false; const requests = [];
  const upstream = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const b = JSON.parse(Buffer.concat(chunks)); requests.push(b);
    const user = b.messages.findLast(m => m.role === 'user'), prompt = Array.isArray(user.content) ? user.content.find(p => p.type === 'text').text : user.content;
    let content = '可见色块测试图，不代表任何真实事件。';
    if (prompt.includes('2行2列')) {
      const bytes = Buffer.from(user.content.find(p => p.type === 'image_url').image_url.url.split(',')[1], 'base64');
      let offset = 8, data = [];
      while (offset < bytes.length) { const length = bytes.readUInt32BE(offset), name = bytes.toString('ascii', offset + 4, offset + 8); if (name === 'IDAT') data.push(bytes.subarray(offset + 8, offset + 8 + length)); offset += length + 12; }
      const pixels = inflateSync(Buffer.concat(data));
      const palette = [[230, 20, 30, '红'], [15, 175, 40, '绿'], [20, 60, 230, '蓝'], [245, 220, 10, '黄'], [10, 10, 10, '黑']];
      content = wrong ? '无法看图' : [[16, 16], [96, 16], [16, 96], [96, 96]].map(([x, y]) => { const i = y * 385 + 1 + x * 3; return palette.find(p => p[0] === pixels[i] && p[1] === pixels[i + 1] && p[2] === pixels[i + 2])[3]; }).join(',');
    }
    if (b.stream) { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write('data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n\n'); if (!gate) res.end('data: [DONE]\n\n'); }
    else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content } }] })); }
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mandatory-images-'));
  Object.assign(process.env, { DATA_DIR: dir, AI_CATALOG_ENABLED: '0', FREE_API_KEY: 'local-image-test', AI_BASE_URL: `http://127.0.0.1:${upstream.address().port}/v1` });
  const { colorChallenge } = await import('../image-probe.js');
  const { server } = await import('../server.js'); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { complete } = await import('../ai.js');
  const base = `http://127.0.0.1:${server.address().port}`, a = sessionClient(base), stranger = sessionClient(base), model = '[故人情]gemini-3.8-flash';
  const call = async (url, body, client = a) => { const r = await client(url, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json() }; };
  const images = [{ name: '无隐私测试.png', mime: 'image/png', data: colorChallenge().data }];
  try {
    const s = (await call('/api/sessions', { kind: 'qa', model })).data, prefix = `/api/sessions/${s.id}`;
    assert.equal((await call(prefix + '/messages', { model, content: '', images })).status, 400, '未验证模型不得收到用户图片'); assert.equal(requests.length, 0);
    let check = await call('/api/ai/image-check', { model }); assert.equal(check.data.verified, true);
    const publicJson = JSON.stringify(check.data); assert.doesNotMatch(publicJson, /local-image-test|routeKey|"key"/);
    assert.match(check.data.config.models[0].description, /轻快响应/); assert.doesNotMatch(check.data.config.models[0].description, /图片|图像|验证/); assert.equal(check.data.config.models[0].imageSupport.status, 'verified');
    const response = await call(prefix + '/messages', { model, content: '描述图片', images }); assert.equal(response.status, 200);
    const last = requests.at(-1).messages.findLast(m => m.role === 'user'); assert.equal(last.content[1].type, 'image_url'); assert.match(last.content[1].image_url.url, /^data:image\/png;base64,/);
    const another = '[故人情]gemini-2.5-pro'; await call('/api/ai/image-check', { model: another });
    const beforeSwitch = requests.length;
    assert.equal((await call(prefix + '/messages', { model: another, content: '切换模型继续' })).status, 400, '历史图片不得随模型切换转交另一模型'); assert.equal(requests.length, beforeSwitch);
    assert.equal((await call(prefix, undefined, stranger)).status, 404); assert.equal(response.data.messages[0].images[0].data, images[0].data);
    await assert.rejects(complete(model, [modelMessage({ role: 'user', content: '', images })]), /尚未验证/);
    wrong = true; check = await call('/api/ai/image-check', { model }); assert.equal(check.data.verified, false);
    assert.equal((await call(prefix + '/messages', { model, content: '继续看图', images })).status, 400);
    wrong = false; await call('/api/ai/image-check', { model });
    const stopSession = (await call('/api/sessions', { kind: 'qa', model })).data, stopPrefix = `/api/sessions/${stopSession.id}`; gate = true;
    const stream = await a(stopPrefix + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, content: '图片消息停止后回填', images, stream: true, requestId: 'image-stop' }) });
    await readEvents(stream.body, async ({ event }) => { if (event === 'delta') { const stopped = await call(stopPrefix + '/stop', { requestId: 'image-stop' }); assert.deepEqual(stopped.data.restore.images, images); } });
    assert.equal((await call(stopPrefix)).data.messages.length, 0);
    assert.throws(() => normalizeChatImages([...images, ...images, ...images, ...images]), /最多3/);
    assert.throws(() => normalizeChatImages([{ name: 'bad.png', mime: 'image/png', data: Buffer.from('not a PNG').toString('base64') }]), /格式不符/);
    const oversized = Buffer.from(images[0].data, 'base64'); oversized.writeUInt32BE(100000, 16);
    assert.throws(() => normalizeChatImages([{ ...images[0], data: oversized.toString('base64') }]), /尺寸/);
  } finally { server.closeAllConnections(); upstream.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await new Promise(resolve => upstream.close(resolve)); fs.rmSync(dir, { recursive: true, force: true }); }
});
