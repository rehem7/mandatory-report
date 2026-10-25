import { api, post, esc, icon, toast } from '/common.js';
export async function mountLearning(container, catalog) {
  let states = await api('/api/learning/state'), selected = null, serverActive = false, working = false, disposed = false;
  const endVisible = new Set(), state = id => states.find(s => s.materialId === id), material = id => catalog.materials.find(m => m.id === id);
  let observer;
  const url = id => `/api/learning/${encodeURIComponent(id)}/progress`;
  const resultHTML = record => record?.lastQuiz ? `<section class="lesson-results" aria-label="本次测验解析"><h4>本次 ${record.lastQuiz.score} 分 · ${record.lastQuiz.passed ? '全部答对' : '继续巩固'}</h4>${record.lastQuiz.items.map((q, i) => `<article><strong>${i + 1}. ${q.correct ? '回答正确' : '需要调整'}</strong><p>你的选择：${esc(q.selected)}</p><p>参考答案：${esc(q.correctAnswer)}</p><p>${esc(q.explanation)}</p></article>`).join('')}</section>` : '';
  function render() {
    container.innerHTML = catalog.materials.map(m => {
      const s = state(m.id), record = s.record;
      return `<section class="lesson-card" data-lesson="${m.id}"><div class="lesson-meta"><span class="lesson-symbol">${icon('book')}</span><span>${esc(m.format)} · 约${m.minutes}分钟</span></div><h2>${esc(m.title)}</h2><p>${esc(m.intro)}</p><div class="lesson-status"><span class="badge ${record ? '' : 'subtle'}">${record ? '阅读完成' : '待阅读'}</span><span class="badge ${record?.masteredAt ? '' : 'subtle'}">${record?.masteredAt ? '测验已掌握' : '知识待检验'}</span></div>${record ? "" : `<button type="button" class="secondary" data-read-start="${m.id}">开始 / 继续阅读</button>`}<ul>${m.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul><div class="lesson-qa"><strong>${esc(m.question)}</strong><p>${esc(m.answer)}</p></div><div class="lesson-sources">${m.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`).join('')}</div><div data-lesson-end="${m.id}" class="lesson-end">本节要点结束</div>${record ? '' : `<div class="reading-progress"><p data-progress-text>${progressText(m.id)}</p><button type="button" class="primary" data-read-complete="${m.id}" ${s.ready ? '' : 'disabled'}>确认阅读完成</button></div>`}${record ? `<form data-lesson-quiz="${m.id}" class="lesson-quiz"><h3>情境检验</h3><p>阅读记录与知识掌握分开保存。两题均答对后记录为“已掌握”，可重新练习。</p>${m.quiz.map((q, i) => `<fieldset><legend>${i + 1}. ${esc(q.question)}</legend>${q.options.map((option, j) => `<label class="checkline"><input type="radio" name="question-${i}" value="${j}" required>${esc(option)}</label>`).join('')}</fieldset>`).join('')}<button type="submit" class="primary">提交作答，查看解析</button></form>${resultHTML(record)}<div class="lesson-next"><h3>把知识用到情境中</h3><p>已学完本节内容，接下来可练习风险识别、沟通与报告填写。</p>${m.relatedCaseIds.map(id => { const c = catalog.cases.find(c => c.id === id); return c ? `<a class="secondary lesson-training-link" href="/training?case=${encodeURIComponent(id)}">练习：${esc(c.title)} ↗</a>` : ''; }).join('')}</div>` : ''}</section>`;
    }).join('');
    observer?.disconnect(); observer = new IntersectionObserver(entries => { for (const e of entries) { if (e.isIntersecting) endVisible.add(e.target.dataset.lessonEnd); else endVisible.delete(e.target.dataset.lessonEnd); } }, { threshold: .7 });
    container.querySelectorAll('[data-lesson-end]').forEach(el => observer.observe(el));
  }
  function progressText(id) { const s = state(id); return `有效阅读 ${Math.floor(s.readSeconds)} / ${material(id).minReadSeconds} 秒 · ${s.reachedEnd ? '已浏览至末尾' : '请浏览至本节末尾'}${selected === id ? ' · 阅读中，离开页面或内容区域暂停计时' : ''}`; }
  function updateProgress() {
    for (const card of container.querySelectorAll('[data-lesson]')) {
      const id = card.dataset.lesson, progress = card.querySelector('[data-progress-text]');
      if (progress) progress.textContent = progressText(id);
      const button = card.querySelector('[data-read-complete]'); if (button) button.disabled = !state(id).ready;
      card.classList.toggle('is-reading', selected === id);
    }
  }
  async function pulse(action) {
    const id = selected; if (!id || disposed) return;
    const result = await post(url(id), { action, active: action !== 'pause', atEnd: endVisible.has(id) });
    if (disposed || selected !== id) return;
    states = states.map(s => s.materialId === id ? result : s); serverActive = result.active;
    if (action === 'pulse' && !result.active) { selected = null; toast('阅读已暂停，请选择要继续阅读的课程'); }
    updateProgress();
  }
  async function tick() {
    if (!selected || working || disposed) return;
    const card = container.querySelector(`[data-lesson="${selected}"]`), rect = card?.getBoundingClientRect();
    const visible = !document.hidden && location.pathname === '/learning' && rect && rect.bottom > 80 && rect.top < innerHeight - 50;
    working = true;
    try { if (visible) await pulse(serverActive ? 'pulse' : 'start'); else if (serverActive) await pulse('pause'); }
    catch (e) { serverActive = false; selected = null; updateProgress(); toast(e.message); }
    finally { working = false; }
  }
  container.onclick = async event => {
    const button = event.target.closest('button'); if (!button || button.type === 'submit' || working) return;
    try {
      if (button.dataset.readStart) { if (selected && serverActive) await pulse('pause'); selected = button.dataset.readStart; await pulse('start'); }
      if (button.dataset.readComplete) { button.disabled = true; const id = button.dataset.readComplete; await post('/api/learning', { materialId: id }); if (selected) await pulse('pause'); selected = null; states = await api('/api/learning/state'); render(); toast('阅读已记录，接下来完成情境检验或进入实训'); }
    } catch (e) { toast(e.message); updateProgress(); }
  };
  container.onsubmit = async event => {
    const form = event.target.closest('[data-lesson-quiz]'); if (!form) return;
    event.preventDefault(); const button = form.querySelector('[type=submit]'); button.disabled = true;
    try { await post(`/api/learning/${form.dataset.lessonQuiz}/quiz`, { answers: material(form.dataset.lessonQuiz).quiz.map((q, i) => Number(new FormData(form).get(`question-${i}`))) }); states = await api('/api/learning/state'); render(); toast('作答与解析已保存'); }
    catch (e) { button.disabled = false; toast(e.message); }
  };
  render(); const timer = setInterval(tick, 5000);
  const onVisibility = () => { tick(); }; document.addEventListener('visibilitychange', onVisibility);
  return () => { if (disposed) return; if (selected && serverActive) api(url(selected), { method: 'POST', body: JSON.stringify({ action: 'pause', active: false, atEnd: endVisible.has(selected) }), keepalive: true }).catch(() => {}); disposed = true; clearInterval(timer); observer.disconnect(); document.removeEventListener('visibilitychange', onVisibility); };
}
