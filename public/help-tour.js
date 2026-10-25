import { openDialog, bindDialog } from '/common.js';

const SEEN_KEY = 'publicUsageGuide:v1';
let dialog, invitation, seenInSession = false, steps = [], step = 0, target;
const pageSteps = {
  ask: [['#model-trigger', '选择对话模型', '可按需要切换已配置的模型；遇到调用失败时，可以切换后重试。'], ['#chat-input', '从一个问题开始', '描述您了解的情况即可，不必使用专业术语。请避免输入真实未成年人的隐私信息。'], ['.qa-report-actions', '需要报告时整理草稿', '可以从对话整理报告草稿，再进入表单核对和补充。对话不会直接提交线索。']],
  training: [['.scenario-card h2', '按场景开始练习', '案例均为虚构，包含入门、进阶与高阶场景，可选择适合自己岗位的案例。'], ['[data-start]', '对话与作答结合', '进入案例后，先与AI角色沟通，再完成风险识别等五步作答。模拟上报不会进入公安队列。']],
  learning: [['.lesson-card h2', '阅读学习卡片', '先了解制度要点、保护措施和短案例，来源链接可供进一步查阅。'], ['[data-learn]', '记录学习进度', '阅读后记录完成情况，再到情景实训中练习应用；学习和实训记录会进入个人台账。']],
  report: [['#region-province', '按层级选择地区', '先选省份，再选城市和区县，系统会联动更新下级选项。具体地点填在详细地址中。'], ['.description-field', '如实记录已知情况', '写清时间、地点、观察到的情况和当事人原话，将已知事实与推测分开。'], ['.upload-zone', '可分次添加多份证据', '支持照片、视频和录音等文件。添加后可逐项移除，附件会随草稿保存。'], ['.form-submit', '核对后再提交', '提交前还会显示确认提示。姓名和电话为选填；遇现实紧急危险，请直接拨打110。']],
  records: [['#record-filters', '按类型查找记录', '可分别查看草稿、问答、实训、学习和上报记录。未完成的草稿可继续填写。'], ['#record-list', '了解记录保存范围', '登录账号的记录可跨浏览器恢复；访客记录只与当前浏览器关联。']],
  ledger: [['.stats', '查看培训完成情况', '这里汇总当前用户完成的学习、实训和达标情况。'], ['.export-link', '导出培训摘要', '导出内容是完成情况与评分摘要，不包含对话全文、报告描述或证据附件。']]
};
function markSeen() { seenInSession = true; try { localStorage.setItem(SEEN_KEY, '1'); } catch {} invitation?.remove(); }
function position() {
  if (!dialog?.open || !target) return;
  const rect = target.getBoundingClientRect(), frame = dialog.querySelector('.guide-highlight'), card = dialog.querySelector('.guide-card');
  const width = document.documentElement.clientWidth, height = innerHeight;
  const left = Math.max(8, rect.left - 6), top = Math.max(8, rect.top - 6);
  Object.assign(frame.style, { left: left + 'px', top: top + 'px', width: Math.max(1, Math.min(rect.right + 6, width - 8) - left) + 'px', height: Math.max(1, Math.min(rect.bottom + 6, height - 8) - top) + 'px' });
  const box = card.getBoundingClientRect();
  let cardTop = rect.bottom + 18;
  if (cardTop + box.height > height - 16) cardTop = rect.top - box.height - 18;
  if (cardTop < 16) cardTop = Math.max(16, height - box.height - 16);
  Object.assign(card.style, { left: Math.min(Math.max(16, rect.left), width - box.width - 16) + 'px', top: cardTop + 'px' });
}
function showStep() {
  const [selector, title, description] = steps[step];
  target = document.querySelector(selector);
  if (!target) return dialog.close();
  target.scrollIntoView({ block: 'center', behavior: 'instant' });
  dialog.querySelector('#guide-count').textContent = `${step + 1} / ${steps.length}`;
  dialog.querySelector('#guide-title').textContent = title;
  dialog.querySelector('#guide-description').textContent = description;
  dialog.querySelector('[data-guide-prev]').disabled = step === 0;
  dialog.querySelector('[data-guide-next]').textContent = step === steps.length - 1 ? '完成指引' : '下一步';
  requestAnimationFrame(position);
  dialog.querySelector('[data-guide-next]').focus({ preventScroll: true });
}
function startGuide() {
  if (dialog?.open) return;
  markSeen();
  const page = location.pathname.slice(1).split('/')[0] || 'ask';
  steps = [['.public-nav', '选择需要的功能', '智能问答帮助梳理情况，情景实训用于练习，普法学习提供要点；需要提交线索时进入报告表单。'], ...(pageSteps[page] || [])].filter(([selector]) => { const element = document.querySelector(selector); return element && element.getBoundingClientRect().width > 0; });
  if (!steps.length) return;
  if (!dialog) {
    dialog = document.createElement('dialog'); dialog.className = 'usage-guide'; dialog.setAttribute('aria-labelledby', 'guide-title'); dialog.setAttribute('aria-describedby', 'guide-description');
    dialog.innerHTML = '<div class="guide-highlight" aria-hidden="true"></div><section class="guide-card"><div class="guide-card-top"><span id="guide-count"></span><button type="button" data-guide-close aria-label="关闭使用指引">关闭</button></div><h2 id="guide-title"></h2><p id="guide-description"></p><div class="guide-actions"><button type="button" class="secondary" data-guide-prev>上一步</button><button type="button" class="primary" data-guide-next>下一步</button></div></section>';
    document.body.append(dialog); bindDialog(dialog);
    dialog.querySelector('[data-guide-close]').onclick = () => dialog.close();
    dialog.querySelector('[data-guide-prev]').onclick = () => { if (step > 0) { step--; showStep(); } };
    dialog.querySelector('[data-guide-next]').onclick = () => { if (step === steps.length - 1) dialog.close(); else { step++; showStep(); } };
    dialog.addEventListener('close', () => { target = null; });
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
  }
  step = 0; openDialog(dialog); showStep();
}
export function installGuide() {
  const header = document.querySelector('.public-topbar-right');
  if (!header || document.getElementById('usage-guide-button')) return;
  const button = document.createElement('button'); button.type = 'button'; button.id = 'usage-guide-button'; button.className = 'guide-open'; button.textContent = '使用指引'; button.onclick = startGuide; header.prepend(button);
  let seen = seenInSession;
  try { seen ||= localStorage.getItem(SEEN_KEY) === '1'; } catch {}
  if (!seen && !document.querySelector('.guide-invite')) {
    invitation = document.createElement('aside'); invitation.className = 'guide-invite'; invitation.setAttribute('aria-label', '首次使用提示');
    invitation.innerHTML = '<div><strong>第一次使用？</strong><p>跟随页面高亮提示，了解各功能的使用方式。</p></div><div class="guide-invite-actions"><button type="button" class="primary mini" data-guide-start>开始指引</button><button type="button" class="secondary mini" data-guide-dismiss>暂时跳过</button></div>';
    document.getElementById('public-topbar').after(invitation);
    invitation.querySelector('[data-guide-start]').onclick = startGuide;
    invitation.querySelector('[data-guide-dismiss]').onclick = markSeen;
  }
}
