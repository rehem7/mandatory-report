import { esc, openDialog, bindDialog } from '/common.js';

const labels = { description: '事件经过', identity: '报告身份', identityOther: '其他身份说明', types: '疑似事件类型', typeOther: '其他事件说明', region: '省市区县', address: '详细地址', occurredAt: '发生时间', age: '年龄段' };
const kindLabels = { observed: '用户自述观察', statement: '用户陈述 / 当事人原话', reported: '转述 · 待核实', uncertain: '推测 · 待核实', negated: '否定陈述', hypothetical: '咨询 / 假设 / 示例', advice: '建议 / 计划' };
const options = { identity: ['未成年本人', '家长/监护人', '教师/教育工作者', '医护人员', '社区工作人员', '其他'], types: ['身体虐待', '性侵害', '情感/精神虐待', '忽视/疏于照料', '家庭暴力', '暴力伤害', '拐卖', '遗弃', '组织乞讨', '自杀/自残', '其他'], age: ['0-6岁', '7-13岁', '14-17岁', '18岁以上'] };
const evidenceHTML = item => item.evidence.map(ref => `<blockquote><small>用户消息 ${esc(ref.messageId.replace('u', ''))}</small><p>${esc(ref.quote)}</p></blockquote>`).join('');
function candidateHTML(item, index) {
  const id = `review-value-${index}`;
  const input = options[item.field] ? `<select id="${id}" data-value>${options[item.field].map(value => `<option${value === item.value ? ' selected' : ''}>${esc(value)}</option>`).join('')}</select>` : item.field === 'description' ? `<textarea id="${id}" data-value maxlength="4000" rows="3">${esc(item.value)}</textarea>` : `<input id="${id}" data-value type="${item.field === 'occurredAt' ? 'datetime-local' : 'text'}" maxlength="300" value="${esc(item.value)}">`;
  return `<article class="review-candidate" data-candidate="${esc(item.id)}"><label class="review-choice"><input type="checkbox" data-use><strong>使用这项${esc(labels[item.field])}</strong><span class="badge subtle">${esc(kindLabels[item.kind])}</span>${item.conflict ? '<span class="badge amber">有不同陈述</span>' : ''}</label><label class="field"><span>${esc(labels[item.field])} · 可修改</span>${input}</label><details open><summary>对应用户原话</summary>${evidenceHTML(item)}</details>${item.pending ? '<p class="review-pending-note">仍需核实。选入事件经过时，会保留“用户转述 / 推测（待核实）”标记。</p>' : ''}</article>`;
}
export function reviewReport(value, confirm) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'report-review-dialog'; dialog.setAttribute('aria-labelledby', 'report-review-title');
    const known = value.candidates.filter(item => !item.pending), pending = value.candidates.filter(item => item.pending);
    dialog.innerHTML = `<form><header class="panel-heading"><div><h2 id="report-review-title">核对对话中的报告信息</h2><p>AI 辅助提取 · 尚未写入表单或提交</p></div><button type="button" class="icon-button" data-close aria-label="关闭报告核对">×</button></header><p class="review-intro">请对照原话，逐项勾选希望使用的信息，也可以修改。原话可定位不代表事实已经核实；未知信息留空，之后仍可在表单补充。</p>${value.fixedFields.identity ? `<p class="review-fixed">报告身份：<strong>${esc(value.fixedFields.identity)}</strong>，来自当前登录账号。</p>` : ''}${known.length ? `<section><h3>已陈述的信息</h3>${known.map(candidateHTML).join('')}</section>` : ''}${pending.length ? `<section><h3>转述与推测 · 待核实</h3>${pending.map((item, i) => candidateHTML(item, i + known.length)).join('')}</section>` : ''}${!value.candidates.some(item => item.field === 'description') ? '<p class="review-empty">暂未提取到可写入报告的具体事件经过。可以在对话补充情况后重新整理，或直接手动填写表单。</p>' : ''}${value.excluded.length ? `<details class="review-excluded"><summary>不会写入报告的内容 · ${value.excluded.length} 项</summary>${value.excluded.map(item => `<article><strong>${esc(kindLabels[item.kind] || '咨询 / 不明确')}</strong><p>${esc(item.reason)}</p>${evidenceHTML(item)}</article>`).join('')}</details>` : ''}${value.warnings.length ? `<aside class="review-warnings"><h3>需要留意</h3><ul>${value.warnings.map(warning => `<li>${esc(warning)}</li>`).join('')}</ul></aside>` : ''}${value.missing.length ? `<p class="review-missing">未自动填入：${value.missing.map(key => esc(labels[key])).join('、')}。请在表单核实后补充。</p>` : ''}<p class="review-advice-note">对话中的保护或报告建议不作为已经发生的事实写入事件经过。</p><p data-error class="portal-error" role="alert" hidden></p><footer class="review-submit"><label class="checkline"><input type="checkbox" data-confirm>我已核对选中信息与原话，修改内容由我确认</label><div class="actions"><a href="/report" class="secondary">手动填写表单 ↗</a><button type="submit" class="primary" disabled>使用这些信息填写表单 →</button></div></footer></form>`;
    document.body.append(dialog); bindDialog(dialog);
    let result, saving = false;
    const form = dialog.querySelector('form'), button = form.querySelector('[type=submit]');
    const rows = () => [...form.querySelectorAll('[data-candidate]')].filter(row => row.querySelector('[data-use]').checked);
    form.oninput = () => { button.disabled = saving || !form.querySelector('[data-confirm]').checked || !rows().some(row => value.candidates.find(item => item.id === row.dataset.candidate)?.field === 'description'); };
    dialog.querySelector('[data-close]').onclick = () => { if (!saving) dialog.close(); };
    dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
    dialog.addEventListener('close', () => { dialog.remove(); resolve(result); }, { once: true });
    form.onsubmit = async event => {
      event.preventDefault(); if (saving || button.disabled) return;
      saving = true; button.disabled = true; button.textContent = '正在保存已核对信息…';
      const error = form.querySelector('[data-error]'); error.hidden = true;
      // Freeze the selected values while their confirmation is being saved.
      const selections = rows().map(row => ({ id: row.dataset.candidate, value: row.querySelector('[data-value]').value }));
      const controls = [...form.querySelectorAll('input,textarea,select,[data-close]')]; controls.forEach(input => input.disabled = true);
      try { result = await confirm({ reviewId: value.id, confirmed: true, selections }); dialog.close(); }
      catch (e) { error.textContent = e.message; error.hidden = false; }
      finally { saving = false; if (dialog.isConnected) { controls.forEach(input => input.disabled = false); button.textContent = '使用这些信息填写表单 →'; form.oninput(); } }
    };
    openDialog(dialog);
  });
}
