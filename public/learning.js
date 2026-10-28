import { api, post, esc, icon, toast } from '/common.js';
import { gameEntriesHTML, openGame, weakPointIndexes } from '/games.js';

export async function mountLearning(container, catalog, { lessonId = null } = {}) {
  let [states, gameStates] = await Promise.all([api('/api/learning/state'), api('/api/games/state')]);
  let disposed = false, submitting = false;
  const material = catalog.materials.find(m => m.id === lessonId);
  const recordFor = id => states.find(s => s.materialId === id)?.record;
  let showResult = !!recordFor(lessonId)?.lastQuiz;
  const sourcesHTML = m => `<div class="lesson-sources">${m.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`).join('')}</div>`;
  const pointsHTML = m => {
    const weak = new Set(weakPointIndexes(gameStates, m.id));
    return `<ul>${m.points.map((point, index) => `<li class="${weak.has(index) ? 'lesson-point is-weak' : 'lesson-point'}">${esc(point)}</li>`).join('')}</ul><div class="lesson-qa"><strong>${esc(m.question)}</strong><p>${esc(m.answer)}</p></div>`;
  };

  function renderCards() {
    container.innerHTML = catalog.materials.map(m => {
      const record = recordFor(m.id);
      return `<article class="lesson-card" data-lesson="${m.id}" aria-labelledby="lesson-title-${m.id}"><div class="lesson-meta"><span class="lesson-symbol">${icon('book')}</span><span>${esc(m.format)} · 约${m.minutes}分钟</span></div><h2 id="lesson-title-${m.id}">${esc(m.title)}</h2><p>${esc(m.intro)}</p><div class="lesson-status"><span class="badge subtle">${m.quiz.length} 道主题选择题</span><span class="badge ${record?.masteredAt ? '' : 'subtle'}">${record?.masteredAt ? '已掌握' : record?.lastQuiz ? `最高 ${record.bestScore} 分 · 可再练习` : '待练习'}</span>${record?.gameClearedAt ? '<span class="badge">知识检验已通关</span>' : ''}</div>${pointsHTML(m)}${sourcesHTML(m)}<div class="lesson-card-actions"><a href="/learning?lesson=${encodeURIComponent(m.id)}" class="primary lesson-practice-link">主题练习 <span aria-hidden="true">→</span></a></div></article>`;
    }).join('');
  }

  function resultsHTML(record) {
    const result = record.lastQuiz;
    return `<section class="lesson-results" aria-label="本次练习成绩与解析"><div class="lesson-score"><strong>${result.score}<span> 分</span></strong><div><h3 id="lesson-result-title" tabindex="-1">${result.passed ? '全部答对，已掌握本主题' : '练习完成，看看哪些要点还需巩固'}</h3><p>答对 ${result.items.filter(q => q.correct).length} / ${result.items.length} 题 · 最高 ${record.bestScore} 分 · 已练习 ${record.attempts} 次</p></div></div>${result.items.map((q, index) => `<article class="lesson-answer ${q.correct ? 'is-correct' : 'is-incorrect'}"><div class="lesson-answer-heading"><strong>${index + 1}. ${esc(q.question)}</strong><span class="badge ${q.correct ? '' : 'amber'}">${q.correct ? '回答正确' : '需要巩固'}</span></div><p>你的选择：${esc(q.selected)}</p><p><b>正确答案：</b>${esc(q.correctAnswer)}</p><p class="lesson-explanation"><b>解析：</b>${esc(q.explanation)}</p></article>`).join('')}<div class="lesson-result-actions"><button type="button" class="primary" data-retry-quiz>重新练习</button><a class="secondary" href="/learning">返回学习卡片</a></div></section>`;
  }

  function renderPractice() {
    const record = recordFor(material.id);
    container.innerHTML = `<section class="lesson-practice" aria-labelledby="lesson-practice-title"><div class="lesson-meta"><span class="lesson-symbol">${icon('book')}</span><span>主题练习 · ${material.quiz.length} 道单选题</span></div><h2 id="lesson-practice-title">${esc(material.title)}</h2><p class="lesson-practice-intro">${esc(material.intro)}</p><details class="lesson-reference"><summary>回顾本主题学习要点</summary>${pointsHTML(material)}${sourcesHTML(material)}</details>${showResult && record?.lastQuiz ? resultsHTML(record) : `<form data-lesson-quiz="${material.id}" class="lesson-quiz"><p>每题选择一个答案，提交后查看得分与逐题解析。全部答对后记录为“已掌握”。</p>${material.quiz.map((q, index) => `<fieldset><legend>${index + 1}. ${esc(q.question)}</legend>${q.options.map((option, optionIndex) => `<label class="lesson-option"><input type="radio" name="question-${index}" value="${optionIndex}" required><span><b>${String.fromCharCode(65 + optionIndex)}.</b> ${esc(option)}</span></label>`).join('')}</fieldset>`).join('')}<div class="lesson-quiz-actions"><span data-quiz-progress role="status">已答 0 / ${material.quiz.length} 题</span><button type="submit" class="primary">提交作答，查看得分</button></div></form>`}${showResult && record?.lastQuiz ? `<div class="lesson-next"><h3>把知识用到情景中</h3>${material.relatedCaseIds.map(id => { const scenario = catalog.cases.find(c => c.id === id); return scenario ? `<a class="secondary lesson-training-link" href="/training?case=${encodeURIComponent(id)}">情景实训：${esc(scenario.title)} ↗</a>` : ''; }).join('')}</div>` : ''}${gameEntriesHTML(material, catalog.games, gameStates, { locked: !record?.lastQuiz })}</section>`;
  }

  container.onclick = event => {
    const play = event.target.closest('[data-play-game]');
    if (play) {
      void openGame({
        gameId: play.dataset.playGame,
        levelId: play.dataset.playLevel,
        games: catalog.games,
        onFinish: async () => {
          [states, gameStates] = await Promise.all([api('/api/learning/state'), api('/api/games/state')]);
          if (!disposed) renderPractice();
        }
      });
      return;
    }
    if (event.target.closest('[data-retry-quiz]')) { showResult = false; renderPractice(); container.querySelector('input')?.focus(); return; }
    const card = event.target.closest('[data-lesson]');
    if (!card || event.target.closest('a,button,input,label,summary') || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || window.getSelection()?.toString()) return;
    card.querySelector('.lesson-practice-link').click();
  };
  container.onchange = event => {
    const form = event.target.closest('[data-lesson-quiz]'); if (!form) return;
    form.querySelector('[data-quiz-progress]').textContent = `已答 ${form.querySelectorAll('input:checked').length} / ${material.quiz.length} 题`;
  };
  container.onsubmit = async event => {
    const form = event.target.closest('[data-lesson-quiz]'); if (!form) return;
    event.preventDefault(); if (submitting || !form.reportValidity()) return;
    const values = new FormData(form), answers = material.quiz.map((q, index) => Number(values.get(`question-${index}`)));
    submitting = true; container.setAttribute('aria-busy', 'true');
    form.querySelectorAll('fieldset,button').forEach(element => { element.disabled = true; });
    try {
      const record = await post(`/api/learning/${encodeURIComponent(material.id)}/quiz`, { answers });
      if (disposed) return;
      states = states.map(state => state.materialId === material.id ? { ...state, record } : state);
      showResult = true; renderPractice(); container.querySelector('#lesson-result-title')?.focus();
      toast('练习成绩和解析已保存');
    } catch (error) { if (!disposed) { form.querySelectorAll('fieldset,button').forEach(element => { element.disabled = false; }); toast(error.message); } }
    finally { submitting = false; if (!disposed) container.removeAttribute('aria-busy'); }
  };

  if (lessonId && !material) container.innerHTML = '<section class="lesson-practice"><h2>未找到这节课程</h2><a class="secondary" href="/learning">返回学习卡片</a></section>';
  else if (material) renderPractice();
  else renderCards();
  return () => { disposed = true; container.onclick = null; container.onchange = null; container.onsubmit = null; };
}
