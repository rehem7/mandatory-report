import crypto from "node:crypto";
import { gameMeta, sortingLevels, detectiveScenes, levelOf, levelsForMaterial } from "./game-content.js";

const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const MAX_DURATION = 30 * 60 * 1000, RUNS_PER_OWNER = 300;

// 前端要跑本地判定，因此关卡配置里的 correct / isError 会一并下发。
// 这不是考试系统，没有排名与奖励，答案可见不影响学习目标；服务端仍然复核提交结果，
// 避免"没投放完就通关""漏判当通关"这类状态错误写进台账。
export const gameCatalog = () => ({
  games: gameMeta,
  levels: { sorting: sortingLevels, detective: detectiveScenes },
  byMaterial: Object.fromEntries(sortingLevels.map(level => [level.materialId, levelsForMaterial(level.materialId)]))
});

const correctIds = level => new Set(level.bins.flatMap(bin => bin.cards.filter(card => card.correct).map(card => card.id)));
const errorLines = scene => scene.characters.map(character => character.line).filter(line => line.isError);

// 投放关按「一次投对率」记分：分母是本节正确卡总数，扣掉投错过的卡（按张去重）。
// 例如 9 张正确卡错投 1 张 → 89 分。80 分达标。
// 找茬关误判即失败，能通关就一定没误判，再折算分数没有区分度，所以不记分。
const PASS_LINE = 80;
const scoreFor = (gameId, level, { misplaced, cleared }) => {
  if (!cleared || gameId !== "sorting") return null;
  const total = correctIds(level).size;
  if (!total) return null;
  const value = Math.max(0, Math.round(((total - misplaced.length) / total) * 100));
  return { total: value, max: 100, passed: value >= PASS_LINE };
};

export function gameState(db, ownerId) {
  const runs = (db.gameRuns || []).filter(run => run.ownerId === ownerId);
  const latest = new Map();
  for (const run of runs) latest.set(run.gameId + ":" + run.levelId, run);
  const cleared = [...latest.values()].filter(run => run.cleared).map(run => ({ gameId: run.gameId, levelId: run.levelId, materialId: run.materialId, durationMs: run.durationMs, at: run.createdAt }));
  // 通关也要保留薄弱点：投错会扣分，扣了分却在学习页一条都不标红，学员没法回去补。
  // latest 每关只取最新一次，所以重玩通关不会累积旧的。找茬关通关等于全找到，天然是空。
  const weakPoints = [];
  for (const run of latest.values()) weakPoints.push(...run.weakPoints);
  return { cleared, weakPoints, runs: runs.slice(-40) };
}

function weakPointsFor(gameId, level, { misplaced, outcome, foundErrorIds, nodeId }) {
  if (gameId === "sorting") {
    // 只有"投错了"才说明存在认知偏差；中途退出没投完不算错，所以不挂知识点。
    const points = new Map();
    for (const bin of level.bins) {
      const wrongCards = bin.cards.filter(card => misplaced.includes(card.id));
      if (!wrongCards.length) continue;
      // 一个情形可能同时考几条知识点（例如“怎么记”+“要不要承诺保密”），逐条挂上。
      for (const pointIndex of bin.pointIndexes || [bin.pointIndex]) {
        points.set(bin.id + ":" + pointIndex, {
          materialId: level.materialId,
          pointIndex,
          binId: bin.id,
          binTitle: bin.title,
          reason: wrongCards[0].note
        });
      }
    }
    return [...points.values()];
  }
  const set = new Set(foundErrorIds);
  return errorLines(level)
    .filter(line => !set.has(line.id))
    .map(line => ({
      materialId: level.materialId,
      pointIndex: line.pointIndex,
      nodeId: nodeId || line.id,
      reason: outcome === "misjudge" ? "在正确做法上按下了报错：注意区分“已履行报告职责”和“未履行”。" : line.knowledge
    }));
}

const stringList = (value, limit) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > limit || value.some(item => typeof item !== "string" || item.length > 80)) fail("游戏提交数据格式不正确");
  return [...new Set(value)];
};

export function recordGameRun(db, actor, payload, stamp = Date.now()) {
  const { gameId, levelId } = payload;
  const level = levelOf(gameId, levelId);
  if (!gameMeta.some(game => game.id === gameId) || !level) fail("游戏关卡不存在");
  // 游戏是"学完再检验"，没有对应的普法学习记录就不算检验过。
  if (!(db.learning || []).some(record => record.ownerId === actor.ownerId && record.materialId === level.materialId)) fail("请先完成本节普法学习与主题练习");
  const durationMs = Math.round(Number(payload.durationMs));
  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > MAX_DURATION) fail("游戏用时无效");

  const placed = stringList(payload.placed, 40), misplaced = stringList(payload.misplaced, 40), foundErrorIds = stringList(payload.foundErrorIds, 8);
  let cleared;
  if (gameId === "sorting") {
    const required = correctIds(level);
    if (placed.some(id => !required.has(id))) fail("投放记录与关卡不匹配");
    cleared = [...required].every(id => placed.includes(id));
    misplaced.forEach(id => { if (!level.bins.some(bin => bin.cards.some(card => card.id === id && !card.correct))) fail("投放记录与关卡不匹配"); });
  } else {
    const all = errorLines(level).map(line => line.id);
    if (foundErrorIds.some(id => !all.includes(id))) fail("找茬记录与场景不匹配");
    cleared = all.length === foundErrorIds.length && all.every(id => foundErrorIds.includes(id));
  }
  const outcome = gameId === "detective" ? (cleared ? "cleared" : ["misjudge", "miss"].includes(payload.outcome) ? payload.outcome : "miss") : cleared ? "cleared" : "unfinished";
  const run = {
    id: crypto.randomUUID(),
    ownerId: actor.ownerId,
    learnerId: actor.profile?.id || null,
    gameId, levelId,
    materialId: level.materialId,
    title: gameMeta.find(game => game.id === gameId).name + " · " + level.title,
    cleared, outcome,
    score: scoreFor(gameId, level, { misplaced, cleared }),
    durationMs,
    placed, misplaced, foundErrorIds,
    // 通关也记：只要投错过就留下知识点，学习页据此标红。没投错时 weakPointsFor 本来就是空的。
    weakPoints: weakPointsFor(gameId, level, { placed, misplaced, outcome, foundErrorIds, nodeId: payload.nodeId }),
    createdAt: new Date(stamp).toISOString()
  };
  db.gameRuns ||= [];
  db.gameRuns.push(run);
  const own = db.gameRuns.filter(item => item.ownerId === actor.ownerId);
  if (own.length > RUNS_PER_OWNER) {
    const drop = new Set(own.slice(0, own.length - RUNS_PER_OWNER).map(item => item.id));
    db.gameRuns = db.gameRuns.filter(item => !drop.has(item.id));
  }
  const learning = (db.learning || []).find(record => record.ownerId === actor.ownerId && record.materialId === level.materialId);
  if (learning && cleared) {
    learning.gameClearedAt ||= run.createdAt;
    learning.gameClearedRuns = (learning.gameClearedRuns || 0) + 1;
    learning.lastGameAt = run.createdAt;
  } else if (learning) {
    learning.lastGameAt = run.createdAt;
  }
  return { run, record: learning || null, state: gameState(db, actor.ownerId) };
}
