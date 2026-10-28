// 普法小游戏：归类投放闯关 + 找茬大侦探。
// 两个游戏都在弹窗内完成，关卡文案全部来自 /api/portal/catalog 的 games 配置。
import { esc, icon, post, toast } from "/common.js";

const clock = ms => {
  const total = Math.max(0, Math.round(ms / 1000));
  return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
};
const fmtSeconds = ms => { const s = Math.round(ms / 1000); return s < 60 ? s + " 秒" : Math.floor(s / 60) + " 分 " + (s % 60) + " 秒"; };

/** 某一节普法材料上，哪些知识点在游戏里答错过（按最近一次未通关记录）。 */
export const weakPointIndexes = (state, materialId) => [...new Set((state?.weakPoints || []).filter(item => item.materialId === materialId).map(item => item.pointIndex))];

/** 学习页底部的游戏入口。只有在对应关卡存在时才渲染。 */
export function gameEntriesHTML(material, games, state, { locked = false } = {}) {
  const pair = games?.byMaterial?.[material.id];
  if (!pair) return "";
  const cleared = new Set((state?.cleared || []).map(item => item.gameId + ":" + item.levelId));
  const card = (game, level) => {
    if (!game || !level) return "";
    const done = cleared.has(game.id + ":" + level.id);
    return `<article class="game-entry" data-tone="${game.tone}"><div class="game-entry-head"><span class="game-entry-icon">${icon(game.icon)}</span><div><h3>${esc(game.name)}</h3><p>${esc(game.tagline)} · ${game.minutes} 分钟</p></div><span class="badge ${done ? "" : "subtle"}">${done ? "已通关" : "未通关"}</span></div><p class="game-entry-level">关卡：${esc(level.title)}${game.id === "detective" ? ` · ${level.characters.length} 位角色` : ` · ${level.bins.length} 个栏框`}</p><p class="game-entry-desc">${esc(game.description)}</p><button type="button" class="${done && !locked ? "secondary" : "primary"}" data-play-game="${game.id}" data-play-level="${level.id}" ${locked ? "disabled" : ""}>${locked ? "完成主题练习后解锁" : done ? "再玩一次" : "开始闯关"}${locked ? "" : " →"}</button></article>`;
  };
  return `<section class="game-entries" aria-labelledby="game-entries-title"><div class="game-entries-head"><div><h3 id="game-entries-title">学完了，去检验一下</h3><p>两个小游戏都基于本节内容与对应法条，通关后计入培训台账。</p></div></div><div class="game-entry-grid">${card(games.games.find(game => game.id === "sorting"), pair.sorting)}${card(games.games.find(game => game.id === "detective"), pair.detective)}</div></section>`;
}

function ensureDialog() {
  let dialog = document.getElementById("game-dialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "game-dialog";
    dialog.className = "game-dialog";
    document.body.append(dialog);
    dialog.addEventListener("close", () => { document.body.style.overflow = ""; });
  }
  return dialog;
}

let activeCleanup = null;
function open(dialog) {
  activeCleanup?.();
  if (!dialog.open) dialog.showModal();
  document.body.style.overflow = "hidden";
}
function close(dialog) {
  activeCleanup?.(); activeCleanup = null;
  if (dialog.open) dialog.close();
  document.body.style.overflow = "";
}

/** 打开一个游戏关卡。onFinish 在成绩已写入后台后回调，用于刷新学习页状态。 */

export async function openGame({ gameId, levelId, games, onFinish }) {
  const game = games?.games?.find(item => item.id === gameId);
  const level = games?.levels?.[gameId]?.find(item => item.id === levelId);
  if (!game || !level) return toast("关卡不存在，请刷新页面后重试");
  const dialog = ensureDialog();
  const submit = async payload => {
    try {
      const result = await post(`/api/games/${encodeURIComponent(gameId)}/run`, { levelId, ...payload });
      await onFinish?.(result);
      return result;
    } catch (error) { toast(error.message); return null; }
  };
  open(dialog);
  if (gameId === "sorting") sortingGame(dialog, game, level, submit); else detectiveGame(dialog, game, level, submit);
}

/* ---------------- 归类投放闯关 ---------------- */

const HOLD_MS = 160;  // 触屏按住多久算「提起卡片」
const SLOP = 9;       // 手指先滑了这么远，说明用户是在滚页面，放弃拖拽

function sortingGame(dialog, game, level, submit) {
  const state = { bin: 0, placed: new Set(), misplaced: new Set(), picked: null, started: Date.now(), finished: false };
  let ticker, drag = null, holdTimer = null;
  const bin = () => level.bins[state.bin];
  const pending = () => bin().cards.filter(card => !state.placed.has(card.id));
  const placedIn = () => bin().cards.filter(card => card.correct && state.placed.has(card.id));
  const requiredIn = () => bin().cards.filter(card => card.correct).length;
  const binEl = () => dialog.querySelector("[data-bin]");
  // 手机上栏框贴在卡片上方（sticky），桌面在右侧，提示文案要跟着方位走。
  const near = () => (matchMedia("(max-width: 860px)").matches ? "上方" : "右侧");
  const defaultHint = () => `按住卡片拖进${near()}栏框，不适用的卡片留在卡片区；也可以点一下卡片选中，再点栏框投放。`;

  const head = () => `<header class="game-head"><div class="game-head-title"><span class="game-eyebrow">${esc(game.name)} · ${esc(level.title)}</span><h2>${esc(bin().title)}</h2></div><div class="game-hud"><span class="game-timer" data-timer>00:00</span><button type="button" class="icon-button" data-close aria-label="关闭游戏">×</button></div></header>`;

  const cardHTML = card => `<button type="button" class="game-card${state.picked === card.id ? " is-picked" : ""}" data-card="${card.id}" data-tone="${card.tone}" aria-pressed="${state.picked === card.id}"><span class="card-kind">${card.tone === "law" ? "法条" : "做法"}</span><span class="card-text">${esc(card.text)}</span></button>`;

  const render = (note = "", tone = "") => {
    const b = bin(), done = placedIn().length;
    dialog.innerHTML = `<div class="game-shell" data-game="sorting">
      ${head()}
      <div class="game-progress-track" aria-hidden="true">${level.bins.map((item, index) => `<span class="${index < state.bin ? "is-done" : index === state.bin ? "is-now" : ""}">${index + 1}</span>`).join("")}</div>
      <p class="game-scene">${esc(b.scene)}</p>
      <div class="game-board">
        <section class="game-deck" aria-label="做法卡片区">
          <div class="deck-head"><h3>卡片区</h3><span class="deck-legend">浅蓝底是法条原文，白底是具体做法</span><span class="deck-count">还剩 ${pending().length} 张</span></div>
          <div class="deck-grid">${pending().map(cardHTML).join("") || `<p class="deck-empty">卡片已全部处理完，栏框正在收尾。</p>`}</div>
        </section>
        <div class="game-bin" data-bin data-tone="${tone}" aria-live="polite"><div class="bin-top"><span class="bin-label">投放栏框</span><span class="bin-drop" aria-hidden="true">松手投放</span><span class="bin-count">${done} / ${requiredIn()}</span></div><p class="bin-prompt">${esc(b.prompt)}</p><ul class="bin-placed">${placedIn().map(card => `<li class="chip" data-tone="${card.tone}">${esc(card.text)}</li>`).join("") || `<li class="chip-empty">把卡片拖进来，松手就投放</li>`}</ul></div>
      </div>
      <p class="game-hint" id="game-hint" data-tone="${tone}" role="status">${esc(note || defaultHint())}</p>
      <div class="game-foot"><button type="button" class="text-button" data-quit>退出本关</button></div>
    </div>`;
    dialog.querySelector("[data-timer]").textContent = clock(Date.now() - state.started);
  };

  const refreshTimer = () => { const el = dialog.querySelector("[data-timer]"); if (el) el.textContent = clock(Date.now() - state.started); };
  ticker = setInterval(refreshTimer, 500);

  /* ---- 拖拽投放 ---- */
  const hitBin = (x, y) => {
    const el = binEl();
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return x > rect.left - 12 && x < rect.right + 12 && y > rect.top - 12 && y < rect.bottom + 12;
  };

  const stopTouchScroll = event => event.preventDefault();
  const clearDrag = () => {
    clearTimeout(holdTimer); holdTimer = null;
    document.removeEventListener("touchmove", stopTouchScroll);
    if (drag) {
      drag.ghost?.remove();
      drag.el?.classList.remove("is-dragging", "is-lifted");
    }
    binEl()?.classList.remove("is-over");
    dialog.classList.remove("is-dragging-now");
    drag = null;
  };

  const liftGhost = () => {
    const el = drag.el, rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.classList.add("game-card-ghost");
    ghost.removeAttribute("data-card");
    ghost.setAttribute("aria-hidden", "true");
    // 手机上整张卡跟着手指会盖住上方栏框，压窄一点，能看见投放目标
    const width = matchMedia("(max-width: 860px)").matches ? Math.min(rect.width, Math.round(innerWidth * 0.66)) : rect.width;
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    ghost.style.width = width + "px";
    dialog.append(ghost);
    const ratio = width / rect.width;
    Object.assign(drag, { ghost, grabX: (drag.x0 - rect.left) * ratio, grabY: drag.y0 - rect.top, left0: rect.left, top0: rect.top });
    // 以抓取点为中心轻微缩小：手机上整张卡跟着手指会盖住栏框，缩一点能看见投放目标。
    ghost.style.transformOrigin = `${drag.grabX}px ${drag.grabY}px`;
    el.classList.add("is-dragging");
    dialog.classList.add("is-dragging-now");
  };

  const pick = (cardId, note = "") => {
    state.picked = state.picked === cardId ? null : cardId;
    render(note || (state.picked ? `已选中这张卡片，点${near()}的栏框投放。` : ""), state.picked ? "picked" : "");
  };

  const place = cardId => {
    const card = bin().cards.find(item => item.id === cardId);
    if (!card || state.placed.has(cardId)) return;
    state.picked = null;
    if (!card.correct) {
      state.misplaced.add(cardId);
      render(card.note, "error");
      dialog.querySelector("[data-bin]")?.classList.add("is-shake");
      return;
    }
    state.placed.add(cardId);
    render();
    if (placedIn().length < requiredIn()) return;
    // 当前栏框收齐 → 自动进入下一个
    setTimeout(() => {
      if (!dialog.open) return;
      if (state.bin + 1 < level.bins.length) { state.bin += 1; render("栏框已收齐，进入下一个情形。", "ok"); }
      else summary();
    }, 650);
  };

  const onPointerDown = event => {
    const el = event.target.closest?.("[data-card]");
    if (!el || event.button > 0) return;
    clearDrag();
    drag = { id: el.dataset.card, el, x0: event.clientX, y0: event.clientY, phase: "press", ghost: null };
    if (event.pointerType === "mouse") drag.phase = "ready";
    else holdTimer = setTimeout(() => {
      if (drag?.phase !== "press") return;
      drag.phase = "ready";
      drag.el.classList.add("is-lifted");
      // 手指已经按住不动，此时接管 touchmove，避免拖到一半页面跟着滚
      document.addEventListener("touchmove", stopTouchScroll, { passive: false });
    }, HOLD_MS);
  };

  const onPointerMove = event => {
    if (!drag) return;
    const dx = event.clientX - drag.x0, dy = event.clientY - drag.y0;
    if (drag.phase === "press") {
      // 还没按住就滑动 → 用户想滚页面，别抢手势
      if (Math.hypot(dx, dy) > SLOP) clearDrag();
      return;
    }
    if (drag.phase === "ready") {
      if (Math.hypot(dx, dy) < 5) return;
      drag.phase = "drag";
      liftGhost();
    }
    event.preventDefault();
    const over = hitBin(event.clientX, event.clientY);
    // 进入栏框上方时把投影再收小一点，露出投放目标
    drag.ghost.style.transform = `translate3d(${event.clientX - drag.grabX - drag.left0}px,${event.clientY - drag.grabY - drag.top0}px,0) scale(${over ? 0.8 : 0.94})`;
    drag.ghost.classList.toggle("is-snapping", over);
    binEl()?.classList.toggle("is-over", over);
  };

  const onPointerUp = event => {
    if (!drag) return;
    const dropped = drag.phase === "drag" && hitBin(event.clientX, event.clientY);
    const dragged = drag.phase === "drag";
    const id = drag.id;
    clearDrag();
    if (dropped) return place(id);
    if (!dragged) return pick(id);
    return pick(id, `这张卡片还没放进栏框，再拖一次，或者直接点${near()}的栏框投放。`);
  };

  const summary = () => {
    state.finished = true;
    clearInterval(ticker);
    const elapsed = Date.now() - state.started;
    const mistakes = level.bins.map(item => ({ item, cards: item.cards.filter(card => state.misplaced.has(card.id)) })).filter(entry => entry.cards.length);
    dialog.innerHTML = `<div class="game-shell" data-game="sorting">
      <header class="game-head"><div class="game-head-title"><span class="game-eyebrow">${esc(game.name)} · 闯关总结</span><h2>${esc(level.title)} 全部栏框完成</h2></div><button type="button" class="icon-button" data-close aria-label="关闭游戏">×</button></header>
      <div class="game-summary">
        <div class="summary-stats"><div><span>本局用时</span><strong>${fmtSeconds(elapsed)}</strong></div><div><span>完成栏框</span><strong>${level.bins.length} / ${level.bins.length}</strong></div><div><span>投放错误</span><strong>${state.misplaced.size} 张</strong></div></div>
        <section class="summary-block"><h3>错题明细</h3>${mistakes.length ? mistakes.map(entry => `<article class="summary-wrong"><strong>${esc(entry.item.title)}</strong>${entry.cards.map(card => `<p><b>${esc(card.text)}</b><small>${esc(card.note)}</small></p>`).join("")}</article>`).join("") : `<p class="muted">这一关一张卡片都没有投错。</p>`}</section>
        <section class="summary-block"><h3>重点法条</h3><ul class="summary-laws">${level.keyLaws.map(law => `<li>${esc(law)}</li>`).join("")}</ul></section>
      </div>
      <div class="game-foot game-foot-actions"><button type="button" class="text-button" data-quit>稍后再检验</button><button type="button" class="primary" data-complete>一键完成本节知识检验</button></div>
    </div>`;
    dialog.onclick = async event => {
      if (event.target.closest("[data-close]") || event.target.closest("[data-quit]")) return close(dialog);
      if (event.target.closest("[data-complete]")) {
        const button = event.target.closest("[data-complete]");
        button.disabled = true;
        const result = await submit({ cleared: true, durationMs: elapsed, placed: [...state.placed], misplaced: [...state.misplaced], outcome: "cleared" });
        button.disabled = false;
        if (result) { toast("本节知识检验已完成，已计入培训台账"); close(dialog); }
      }
    };
  };

  dialog.onclick = async event => {
    const target = event.target;
    if (target.closest("[data-close]")) return close(dialog);
    if (target.closest("[data-quit]")) {
      const result = await submit({ cleared: false, durationMs: Date.now() - state.started, placed: [...state.placed], misplaced: [...state.misplaced], outcome: "unfinished" });
      if (result) toast("已退出本关，错过的知识点会在学习页标出来");
      return close(dialog);
    }
    // 键盘用户：Enter 触发的是 click，用它来选中卡片；鼠标/手指的点击由 pointerup 处理，避免重复。
    const cardButton = target.closest("[data-card]");
    if (cardButton) { if (event.detail === 0) pick(cardButton.dataset.card); return; }
    if (target.closest("[data-bin]") && state.picked) return place(state.picked);
  };

  dialog.addEventListener("pointerdown", onPointerDown);
  // passive:false 才能在拖拽时阻止页面跟着滚
  document.addEventListener("pointermove", onPointerMove, { passive: false });
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", clearDrag);

  activeCleanup = () => {
    clearInterval(ticker); clearDrag();
    dialog.onclick = null;
    dialog.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", clearDrag);
  };
  render();
}

/* ---------------- 找茬大侦探 ---------------- */

/**
 * 场景底图按约定路径取：webp 取不到就试同名 png，再取不到直接移除，退回 CSS 渐变底。
 * 素材放进 public/assets/visual/scenes/ 后重启服务即可生效，不必改内容配置。
 */
function bindArtFallback(root) {
  const bg = root.querySelector(".stage-bg");
  bg?.addEventListener("error", () => {
    if (bg.dataset.png && !bg.dataset.tried) { bg.dataset.tried = "1"; bg.src = bg.dataset.png; return; }
    bg.remove();
  });
}

function detectiveGame(dialog, game, level, submit) {
  const errorLines = level.characters.map(character => character.line).filter(line => line.isError);
  const state = { found: new Set(), active: null, started: Date.now(), over: false, recorded: false };
  const activeCharacter = () => level.characters.find(character => character.id === state.active) || null;

  // 台词气泡的小箭头对准选中角色的实际水平位置（立绘宽度各不同，不能按 1/3 等分算）。
  // 窗口尺寸变化后重新量一次，避免箭头指偏。
  const aimTalk = () => {
    const picked = dialog.querySelector(".detective-stage .cast-member.is-active");
    const bubble = dialog.querySelector(".talk-track .cast-bubble");
    if (!picked || !bubble) return;
    const a = picked.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    bubble.style.setProperty("--talk-x", `${Math.round(a.left + a.width / 2 - b.left)}px`);
  };
  window.addEventListener("resize", aimTalk);

  const rules = () => {
    dialog.innerHTML = `<div class="game-shell" data-game="detective">
      <header class="game-head"><div class="game-head-title"><span class="game-eyebrow">${esc(game.name)} · ${esc(level.title)}</span><h2>先看清楚规则</h2></div><button type="button" class="icon-button" data-close aria-label="关闭游戏">×</button></header>
      <div class="game-rules-wrap">
        <div class="game-rules"><ol><li>点击场景中的角色，查看他们在做什么、说什么。</li><li>三个人的说法都可以先看完，不用急着下判断。</li><li>确认之后，按右下角的「我发现错误！」。按在做法没问题的角色上，才算误判、本局失败。</li></ol><p class="muted">本场景共 <b>${errorLines.length}</b> 处错误，均为虚构情节。</p></div>
        <img class="rules-art" src="/assets/visual/rule-magnifier.webp" alt="" aria-hidden="true">
      </div>
      <div class="game-foot game-foot-actions"><button type="button" class="text-button" data-quit>退出</button><button type="button" class="primary" data-start>我明白了，开始</button></div>
    </div>`;
  };

  const scene = note => {
    const active = activeCharacter();
    const foundNow = active?.line.isError && state.found.has(active.line.id);
    // 台词卡固定在舞台下方的槽位里，箭头由 aimTalk 按实测位置指过去。
    const talkCard = active
      ? `<div class="cast-bubble ${foundNow ? "is-found" : ""}" role="status"><span class="bubble-from">${esc(active.name)} · ${esc(active.role)}</span><p>“${esc(active.line.text)}”</p>${foundNow ? `<small>这一点已经记下来了，继续看看其他人。</small>` : ""}</div>`
      : `<p class="cast-hint">点一个角色，看看他此刻的想法与做法。</p>`;
    // 提示行常驻：没有反馈时显示规则提醒，保证台词槽高度稳定、点角色时按钮不跳动。
    const hintText = note || "先看完三个人，确认之后再按右下角的按钮。";
    const hintTone = !note ? "" : /找到/.test(note) ? "ok" : "picked";
    const hintLine = hintText ? `<p class="game-hint" data-tone="${hintTone}" role="status">${esc(hintText)}</p>` : "";
    dialog.innerHTML = `<div class="game-shell" data-game="detective">
      <header class="game-head"><div class="game-head-title"><span class="game-eyebrow">${esc(game.name)}</span><h2>${esc(level.title)}</h2></div><div class="game-hud"><span class="game-timer" data-timer>00:00</span><span class="game-found">已发现 ${state.found.size} / ${errorLines.length}</span><button type="button" class="icon-button" data-close aria-label="关闭游戏">×</button></div></header>
      <div class="detective-stage is-stand">
        <img class="stage-bg" src="/assets/visual/scenes/${esc(level.background || level.id)}.webp" data-png="/assets/visual/scenes/${esc(level.background || level.id)}.png" alt="" aria-hidden="true">
        <div class="stage-veil" aria-hidden="true"></div>
        <div class="stage-brief-card"><p class="stage-brief">${esc(level.brief)}</p><p class="stage-time">${esc(level.time)}</p></div>
        <div class="cast">${level.characters.map(character => `<button type="button" class="cast-member ${state.active === character.id ? "is-active" : ""} ${state.found.has(character.line.id) ? "is-found" : ""}" data-cast="${character.id}" aria-pressed="${state.active === character.id}"${character.stance ? ` style="--cast-h:${character.stance}"` : ""}><img class="cast-figure" src="/assets/visual/cast/stand/${esc(character.id)}.webp" alt="" aria-hidden="true"><span class="cast-name">${esc(character.name)}</span><span class="cast-role">${esc(character.role)}</span></button>`).join("")}</div>
      </div>
      <div class="talk-track">${talkCard}${hintLine}</div>
      <div class="game-foot detective-foot"><button type="button" class="text-button" data-quit>退出本关</button><button type="button" class="report-button" data-report><span>我发现错误！</span><small>先看完三个人，按错才失败</small></button></div>
    </div>`;
    dialog.querySelector("[data-timer]").textContent = clock(Date.now() - state.started);
    bindArtFallback(dialog);
    const stage = dialog.querySelector(".detective-stage");
    stage?.classList.toggle("has-active", Boolean(stage.querySelector(".cast-member.is-active")));
    aimTalk();
    // 立绘宽度由图片决定，首次加载完成前量出来的位置会偏，图到位后补量一次。
    dialog.querySelectorAll(".cast-figure").forEach(img => {
      if (!img.complete) img.addEventListener("load", aimTalk, { once: true });
    });
    // 矮屏兜底：台词槽不在可视区内就滚进来，别让用户以为点了没反应。
    dialog.querySelector(".talk-track")?.scrollIntoView({ block: "nearest" });
  };

  const endWith = async (outcome, detail) => {
    state.over = true;
    clearInterval(ticker);
    if (!state.recorded) {
      state.recorded = true;
      await submit({ cleared: outcome === "cleared", outcome, durationMs: Date.now() - state.started, foundErrorIds: [...state.found], nodeId: detail?.nodeId || null });
    }
    const elapsed = Date.now() - state.started;
    if (outcome === "cleared") {
      dialog.innerHTML = `<div class="game-shell" data-game="detective">
        <header class="game-head"><div class="game-head-title"><span class="game-eyebrow">${esc(game.name)} · 通关</span><h2>全部错误都找到了</h2></div><button type="button" class="icon-button" data-close aria-label="关闭游戏">×</button></header>
        <div class="game-summary"><div class="summary-stats is-two"><div><span>本局用时</span><strong>${fmtSeconds(elapsed)}</strong></div><div><span>发现错误</span><strong>${state.found.size} / ${errorLines.length}</strong></div></div>
        <section class="summary-block"><h3>这局要记住的</h3><ul class="summary-laws">${errorLines.map(line => `<li>${esc(line.knowledge)}</li>`).join("")}</ul></section></div>
        <div class="game-foot game-foot-actions"><button type="button" class="primary" data-close>完成本次检验</button></div>
      </div>`;
      toast("通关记录已写入培训台账");
      return;
    }
    dialog.innerHTML = `<div class="game-shell" data-game="detective">
      <header class="game-head"><div class="game-head-title"><span class="game-eyebrow">${esc(game.name)} · 本局未通过</span><h2>这里没有违反要求</h2></div><button type="button" class="icon-button" data-close aria-label="关闭游戏">×</button></header>
      <div class="game-summary"><div class="fail-card"><strong>误判</strong><p>${esc(detail.reason)}</p></div>
      <section class="summary-block"><h3>对应的知识点</h3><p class="fail-knowledge">${esc(detail.knowledge)}</p><p class="muted">这一条已经在「普法学习」里标出来了，看完可以再试一次。</p></section></div>
      <div class="game-foot game-foot-actions"><button type="button" class="secondary" data-retry>重新看这个场景</button><button type="button" class="primary" data-close>回学习页</button></div>
    </div>`;
  };

  let ticker = setInterval(() => { const el = dialog.querySelector("[data-timer]"); if (el) el.textContent = clock(Date.now() - state.started); }, 500);

  dialog.onclick = async event => {
    const target = event.target;
    if (target.closest("[data-close]")) return close(dialog);
    if (target.closest("[data-quit]")) {
      if (!state.over) await submit({ cleared: false, outcome: "unfinished", durationMs: Date.now() - state.started, foundErrorIds: [...state.found] });
      return close(dialog);
    }
    if (target.closest("[data-start]")) { state.started = Date.now(); return scene(); }
    if (target.closest("[data-retry]")) {
      state.found = new Set(); state.active = null; state.over = false; state.recorded = false; state.started = Date.now();
      return scene();
    }
    const cast = target.closest("[data-cast]");
    if (cast) {
      // 三个人都可以反复看，随便切换不判负；只有「按错人」才算误判。
      // 再点同一个人不必整块重绘，避免舞台闪一下。
      if (state.active === cast.dataset.cast) return;
      state.active = cast.dataset.cast;
      const character = activeCharacter();
      if (character.line.isError && state.found.has(character.line.id)) return scene("这一点已经找到了，看看还有没有别的。");
      return scene();
    }
    if (target.closest("[data-report]")) {
      const active = activeCharacter();
      if (!active) return scene("先点开一个角色，看看他在做什么。");
      if (!active.line.isError) {
        return endWith("misjudge", { reason: `“${active.line.text}”本身是符合要求的做法，在它上面按下报错就属于误判。`, knowledge: "区分“已经履行了报告职责”和“没有履行”：先看对方是否已经报告、是否保护了孩子安全。", pointIndex: level.misjudgePoint, nodeId: active.line.id });
      }
      if (state.found.has(active.line.id)) return scene("这一点已经记下来了，继续看看其他人。");
      state.found.add(active.line.id);
      if (state.found.size === errorLines.length) return endWith("cleared");
      return scene(`找到了：${active.line.knowledge} 继续看看还有没有别的。`);
    }
  };

  activeCleanup = () => { clearInterval(ticker); dialog.onclick = null; window.removeEventListener("resize", aimTalk); };
  rules();
}
