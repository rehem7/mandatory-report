import { esc } from "/common.js";

const statuses = { running: "进行中", done: "已完成", warning: "有提示", error: "未完成", cancelled: "已停止" };
export function activityHTML(steps = [], active = false) {
  if (!steps.length) return "";
  const current = steps.findLast(step => step.status === "running") || steps.at(-1);
  const issue = steps.some(step => ["error", "warning", "cancelled"].includes(step.status));
  return `<details class="activity-panel ${active ? 'is-active' : ''}" ${active ? 'open' : ''}><summary><span class="activity-heading"><span class="activity-signal ${active ? 'is-running' : ''}" aria-hidden="true"></span>处理${active ? '进度' : '记录'}<span class="activity-caption">${esc(active ? current.label : issue ? '已结束 · 有状态提示' : '已完成')} · ${steps.length} 步</span></span><span class="activity-chevron" aria-hidden="true">⌄</span></summary><ol class="activity-steps">${steps.slice(0, 32).map(step => `<li class="activity-step" data-state="${esc(step.status)}"><span class="activity-marker" aria-hidden="true">${step.status === 'done' ? '✓' : step.status === 'running' ? '' : '!'}</span><div><div class="activity-step-heading"><span>${esc(step.label)}</span><small>${statuses[step.status] || '状态未知'}</small></div>${step.detail ? `<p>${esc(step.detail)}</p>` : ''}</div></li>`).join('')}</ol><p class="activity-note">显示实际请求与工具执行状态</p></details>`;
}
