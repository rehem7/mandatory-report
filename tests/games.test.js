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
    // 总结页的「涉及法条」也要能溯源，条号缺失或者自拟概括都算不合格。
    for (const law of level.keyLaws) {
      assert.match(law, /^(《未成年人保护法》第十一条第[二三]款|九部门《关于建立|九部门意见第)/, material.id + ' 重点法条缺少出处：' + law.slice(0, 24));
    }
    for (const bin of level.bins) {
      const right = bin.cards.filter(card => card.correct), wrong = bin.cards.filter(card => !card.correct);
      assert.ok(right.length >= 3 && wrong.length >= 1, bin.id + ' 卡片配比不足');
      assert.ok(bin.pointIndex >= 0 && bin.pointIndex < material.points.length, bin.id + ' 知识点索引越界');
      assert.ok((bin.pointIndexes || []).every(index => index >= 0 && index < material.points.length), bin.id + ' 知识点数组越界');
      // 依据要写清出处再给条文：学员和评审都能顺着标签翻到那一条。
      assert.match(bin.basis, /^(未保法第十一条|九部门意见第)/, bin.id + ' 依据缺少条文出处标签');
      assert.ok(bin.basis.includes('：'), bin.id + ' 依据缺少出处分隔');
      assert.ok(bin.basis.length >= 60, bin.id + ' 依据过短，出处加条文至少要到 60 字');
      assert.ok(/应当|可以|不得|未履行/.test(bin.basis), bin.id + ' 依据应落成条文的义务表述');
      assert.ok(!/病历书写规范|实务要求|保护实务|本情形/.test(bin.basis), bin.id + ' 依据应为条文内容，不接受自拟表述或对本栏的裁定');
      assert.ok(bin.cards.every(card => !/未保法|九部门意见|第十一条/.test(card.text)), bin.id + ' 卡片区不应混入法条原文');
      assert.ok(bin.cards.every(card => card.note && card.text.length > 4), bin.id + ' 卡片缺少说明');
    assert.equal(new Set(bin.cards.map(card => card.id)).size, bin.cards.length, bin.id + ' 卡片 id 重复');
    }
    // 同一关三栏的依据不能重复，不然学员翻一页又看到同一句，像是凑数。
    const tags = level.bins.map(bin => bin.basis.split('：')[0]);
    assert.equal(new Set(tags).size, tags.length, material.id + ' 同一关内依据出处重复：' + tags.join(' | '));
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

test('法条只当栏框依据，卡片里不应再出现法条原文', () => {
  for (const level of sortingLevels) {
    for (const bin of level.bins) {
      const lawOnCard = bin.cards.filter(card => /第[一二三四五六七八九十百]+条|九部门意见|未成年人保护法：/.test(card.text));
      assert.deepEqual(lawOnCard.map(card => card.id), [], bin.id + ' 的卡片里还混着法条原文');
      assert.ok(bin.cards.every(card => typeof card.correct === 'boolean'), bin.id + ' 卡片缺少 correct 标记');
    }
  }
});

test('15 条知识点在投放关与找茬关合并后全覆盖', () => {
  for (const material of materials) {
    const covered = new Set();
    const level = sortingLevels.find(item => item.materialId === material.id);
    for (const bin of level.bins) for (const index of bin.pointIndexes) covered.add(index);
    const scene = detectiveScenes.find(item => item.materialId === material.id);
    for (const character of scene.characters) if (character.line.pointIndex != null) covered.add(character.line.pointIndex);
    assert.deepEqual([...covered].sort(), material.points.map((_, index) => index), material.id + ' 还有知识点两个游戏都没考到');
  }
});

test('学习材料的格式标签与岗位覆盖范围一致', () => {
  for (const material of materials) {
    const universal = material.roles.length > 1;
    assert.ok(material.format.startsWith(universal ? '通用 · ' : '岗位 · '), material.id + ' 的格式标签与岗位范围对不上');
  }
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
  assert.deepEqual(done.run.weakPoints, [], '一张都没投错，通关后自然没有薄弱知识点');
  assert.ok(done.record.gameClearedAt, '通关应标记到学习记录，供台账使用');
  assert.equal(gameState(db, 'a').cleared.length, 1);
  assert.equal(gameState(db, 'a').weakPoints.length, 0, '全程没投错，通关后不挂薄弱知识点');
  assert.equal(db.gameRuns.length, 2);
});

test('归类投放按一次投对率记分：全对满分，投错按张扣分，未通关不计分', () => {
  const db = learningFor('report-duty');
  const level = sortingLevels.find(item => item.materialId === 'report-duty');
  const all = correctOf(level);

  const perfect = recordGameRun(db, actor, { gameId: 'sorting', levelId: level.id, durationMs: 30000, placed: all, misplaced: [] });
  assert.equal(perfect.run.cleared, true);
  assert.equal(perfect.run.score.total, 100, '一张都没投错应得满分');
  assert.equal(perfect.run.score.passed, true);

  const wrongId = level.bins[0].cards.find(card => !card.correct).id;
  const oneWrong = recordGameRun(db, actor, { gameId: 'sorting', levelId: level.id, durationMs: 36000, placed: all, misplaced: [wrongId] });
  assert.equal(oneWrong.run.score.total, Math.round(((all.length - 1) / all.length) * 100), '投错一张按比例扣分');
  assert.equal(oneWrong.run.score.max, 100);
  // 投错已经扣了分，学习页就得能标红对应知识点——通关不等于全掌握。
  assert.ok(oneWrong.run.weakPoints.length >= 1, '通关但投错过，薄弱知识点要保留');
  assert.equal(oneWrong.run.weakPoints[0].binId, level.bins[0].id);
  assert.ok(gameState(db, 'a').weakPoints.length >= 1, '通关后学习页仍应标红薄弱知识点');

  // 同一张卡反复投错只扣一次（misplaced 按张去重）
  const twice = recordGameRun(db, actor, { gameId: 'sorting', levelId: level.id, durationMs: 38000, placed: all, misplaced: [wrongId, wrongId] });
  assert.equal(twice.run.score.total, oneWrong.run.score.total, '同一张卡反复投错不应重复扣分');

  const partial = recordGameRun(db, actor, { gameId: 'sorting', levelId: level.id, durationMs: 9000, placed: all.slice(0, 3), misplaced: [wrongId] });
  assert.equal(partial.run.cleared, false);
  assert.equal(partial.run.score, null, '没通关不记分');
});

test('找茬关不折算分数：误判即失败，通关即全对', () => {
  const scene = detectiveScenes[0];
  const db = learningFor(scene.materialId);
  const errors = scene.characters.filter(character => character.line.isError).map(character => character.line.id);
  const done = recordGameRun(db, actor, { gameId: 'detective', levelId: scene.id, durationMs: 24000, foundErrorIds: errors, outcome: 'cleared' });
  assert.equal(done.run.cleared, true);
  assert.equal(done.run.score, null, '找茬关通关即全对，再折算分数没有区分度');
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
