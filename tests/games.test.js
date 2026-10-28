import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { materials } from '../content.js';
import { sortingLevels, detectiveScenes, gameMeta } from '../game-content.js';
import { recordGameRun, gameState } from '../games.js';

const actor = { ownerId: 'a', profile: { id: 'a-profile' } }, other = { ownerId: 'b', profile: { id: 'b-profile' } };
const learningFor = (...materialIds) => ({ learning: materialIds.map((materialId, index) => ({ id: 'r' + index, ownerId: 'a', materialId, title: materialId, completedAt: new Date().toISOString() })), gameRuns: [] });
const correctOf = level => level.bins.flatMap(bin => bin.cards.filter(card => card.correct).map(card => card.id));

test('每个普法主题都有可玩的关卡，知识点都指回学习材料里的真实条目', () => {
  assert.equal(gameMeta.length, 2);
  for (const material of materials) {
    const level = sortingLevels.find(item => item.materialId === material.id);
    assert.ok(level, material.id + ' 缺少归类关卡');
    assert.ok(level.bins.length >= 2);
    assert.ok(level.keyLaws.length >= 1);
    for (const bin of level.bins) {
      const right = bin.cards.filter(card => card.correct), wrong = bin.cards.filter(card => !card.correct);
      assert.ok(right.length >= 3 && wrong.length >= 1, bin.id + ' 卡片配比不足');
      assert.ok(bin.pointIndex >= 0 && bin.pointIndex < material.points.length, bin.id + ' 知识点索引越界');
      assert.ok(bin.cards.every(card => card.note && card.text.length > 4), bin.id + ' 卡片缺少说明');
      assert.equal(new Set(bin.cards.map(card => card.id)).size, bin.cards.length, bin.id + ' 卡片 id 重复');
    }
  }
  for (const scene of detectiveScenes) {
    const material = materials.find(item => item.id === scene.materialId);
    assert.ok(material, scene.id + ' 对应材料不存在');
    assert.equal(scene.characters.length, 3);
    const errors = scene.characters.filter(character => character.line.isError);
    assert.ok(errors.length >= 1, scene.id + ' 没有错误情节');
    for (const character of errors) {
      assert.ok(character.line.knowledge, scene.id + ' 错误情节缺少知识点');
      assert.ok(character.line.pointIndex >= 0 && character.line.pointIndex < material.points.length);
    }
    assert.ok(scene.misjudgePoint < material.points.length);
  }
  assert.equal(new Set(sortingLevels.map(level => level.id)).size, sortingLevels.length);
  assert.equal(new Set(detectiveScenes.map(scene => scene.id)).size, detectiveScenes.length);
});

test('归类投放：投放未齐不算通关，全部投齐才通关并写入学习记录', () => {
  const db = learningFor('report-duty');
  const level = sortingLevels.find(item => item.materialId === 'report-duty');
  const all = correctOf(level);
  const partial = recordGameRun(db, actor, { gameId: 'sorting', levelId: level.id, cleared: true, durationMs: 20000, placed: all.slice(0, 2), misplaced: [] });
  assert.equal(partial.run.cleared, false, '只投放两张时，客户端声称通关不算数');
  assert.deepEqual(partial.state.cleared, []);
  assert.deepEqual(partial.run.weakPoints, [], '没投完只是退出，不代表投错，不挂知识点');
  assert.equal(partial.record.gameClearedAt, undefined);

  const done = recordGameRun(db, actor, { gameId: 'sorting', levelId: level.id, cleared: true, durationMs: 41000, placed: all, misplaced: [] });
  assert.equal(done.run.cleared, true);
  assert.deepEqual(done.run.weakPoints, [], '通关后不再挂薄弱知识点');
  assert.ok(done.record.gameClearedAt, '通关应标记到学习记录，供台账使用');
  assert.equal(gameState(db, 'a').cleared.length, 1);
  assert.equal(gameState(db, 'a').weakPoints.length, 0, '通关会清掉同一关之前的薄弱知识点');
  assert.equal(db.gameRuns.length, 2);
});

test('归类投放：投错的卡片记入错题明细，并定位到对应知识点', () => {
  const db = learningFor('evidence-privacy');
  const level = sortingLevels.find(item => item.materialId === 'evidence-privacy');
  const bin = level.bins[0], wrong = bin.cards.find(card => !card.correct);
  const result = recordGameRun(db, actor, { gameId: 'sorting', levelId: level.id, cleared: false, durationMs: 9000, placed: [], misplaced: [wrong.id] });
  assert.equal(result.run.cleared, false);
  assert.equal(result.run.weakPoints.length, 1);
  assert.equal(result.run.weakPoints[0].binId, bin.id);
  assert.equal(result.run.weakPoints[0].pointIndex, bin.pointIndex);
  assert.equal(result.run.weakPoints[0].reason, wrong.note);
});

test('找茬大侦探：漏判与误判都不算通关，重玩通关后薄弱点清空', () => {
  const db = learningFor('teacher-duty');
  const scene = detectiveScenes.find(item => item.materialId === 'teacher-duty');
  const errorLine = scene.characters.find(character => character.line.isError).line;

  const miss = recordGameRun(db, actor, { gameId: 'detective', levelId: scene.id, cleared: false, outcome: 'miss', durationMs: 12000, foundErrorIds: [], nodeId: errorLine.id });
  assert.equal(miss.run.cleared, false);
  assert.equal(miss.run.weakPoints[0].pointIndex, errorLine.pointIndex);
  assert.equal(miss.run.weakPoints[0].reason, errorLine.knowledge);

  const misjudge = recordGameRun(db, actor, { gameId: 'detective', levelId: scene.id, cleared: true, outcome: 'misjudge', durationMs: 15000, foundErrorIds: [] });
  assert.equal(misjudge.run.cleared, false, '没找到全部错误时不能算通关');
  assert.equal(misjudge.run.weakPoints[0].pointIndex, scene.misjudgePoint);

  const cleared = recordGameRun(db, actor, { gameId: 'detective', levelId: scene.id, cleared: true, outcome: 'cleared', durationMs: 26000, foundErrorIds: [errorLine.id] });
  assert.equal(cleared.run.cleared, true);
  assert.equal(gameState(db, 'a').weakPoints.length, 0);
});

test('提交数据必须与关卡对得上，且不能绕过普法学习直接刷通关', () => {
  const db = learningFor('teacher-duty');
  const level = sortingLevels.find(item => item.materialId === 'teacher-duty');
  assert.throws(() => recordGameRun(db, actor, { gameId: 'sorting', levelId: 'not-a-level', cleared: true, durationMs: 1000, placed: [] }), /关卡不存在/);
  assert.throws(() => recordGameRun(db, actor, { gameId: 'sorting', levelId: level.id, cleared: true, durationMs: 1000, placed: ['made-up-card'] }), /不匹配/);
  assert.throws(() => recordGameRun(db, actor, { gameId: 'sorting', levelId: level.id, cleared: true, durationMs: -1, placed: [] }), /用时无效/);
  assert.throws(() => recordGameRun(db, actor, { gameId: 'detective', levelId: detectiveScenes.find(scene => scene.materialId === 'teacher-duty').id, cleared: true, durationMs: 1000, foundErrorIds: ['x'] }), /不匹配/);
  const fresh = { learning: [], gameRuns: [] };
  assert.throws(() => recordGameRun(fresh, actor, { gameId: 'sorting', levelId: level.id, cleared: true, durationMs: 1000, placed: correctOf(level) }), /请先完成本节普法学习/);
  assert.equal(db.gameRuns.length, 0, '校验失败不应留下记录');
});

test('别人的游戏记录不会串到自己的状态里', () => {
  const db = learningFor('report-duty');
  db.learning.push({ id: 'r-b', ownerId: 'b', materialId: 'report-duty', title: 'report-duty', completedAt: new Date().toISOString() });
  const level = sortingLevels.find(item => item.materialId === 'report-duty');
  recordGameRun(db, { ownerId: 'b', profile: { id: 'b-profile' } }, { gameId: 'sorting', levelId: level.id, cleared: true, durationMs: 5000, placed: correctOf(level) });
  assert.equal(gameState(db, 'a').cleared.length, 0);
  assert.equal(gameState(db, 'b').cleared.length, 1);
  assert.equal(db.learning.find(record => record.ownerId === 'a').gameClearedAt, undefined, '别人的通关不能改我的学习记录');
});

test('游戏通关写进我的记录与培训台账，未通关只留下薄弱知识点', async () => {
  const testData = fs.mkdtempSync(path.join(os.tmpdir(), 'mandatory-games-'));
  process.env.DATA_DIR = testData;
  process.env.FREE_API_KEY = '';
  process.env.AI_CATALOG_ENABLED = '0';
  const { server } = await import('../server.js');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let cookie = '';
  const call = async (url, data) => {
    const response = await fetch(base + url, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined });
    const issued = response.headers.getSetCookie?.() || [];
    const visitor = issued.find(value => value.startsWith('report_visitor='));
    if (visitor) cookie = visitor.split(';')[0];
    return { status: response.status, data: await response.json() };
  };
  try {
    const bootstrap = await call('/api/portal/bootstrap');
    const ownerId = bootstrap.data.account.ownerId;
    const level = sortingLevels.find(item => item.materialId === 'report-duty');
    const all = correctOf(level);
    assert.equal((await call('/api/games/sorting/run', { levelId: level.id, cleared: true, durationMs: 1000, placed: all })).status, 400, '没学完不能直接通关');
    // 先完成本节普法学习
    assert.equal((await call('/api/learning/report-duty/quiz', { answers: [1, 0, 2] })).status, 200);
    assert.equal((await call('/api/games/sorting/run', { levelId: level.id, cleared: true, durationMs: 30000, placed: all })).status, 200);
    const clearing = await call('/api/games/sorting/run', { levelId: level.id, cleared: true, durationMs: 24000, placed: all });
    assert.equal(clearing.data.run.cleared, true);
    assert.ok(clearing.data.record.gameClearedAt);

    const records = await call('/api/portal/records');
    assert.equal(records.data.games.cleared.length, 1);
    assert.equal(records.data.games.runs.length, 2);
    assert.equal(records.data.games.runs.at(-1).gameId, 'sorting');

    const ledger = await call('/api/units/' + encodeURIComponent(ownerId));
    assert.equal(ledger.data.totals.games, 1);
    assert.equal(ledger.data.rows.filter(row => row.kind === '知识检验').length, 1, '同一关重复通关只占一行');
    assert.equal(ledger.data.rows.find(row => row.kind === '学习').state, '练习完成 · 检验通关');

    const csv = await fetch(base + '/api/units/' + encodeURIComponent(ownerId) + '/export.csv', { headers: { Cookie: cookie } });
    const text = await csv.text();
    assert.match(text, /知识检验用时\(秒\)/);
    assert.match(text, /知识检验/);
    assert.match(text, /归类投放闯关/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
