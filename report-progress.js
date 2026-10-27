const stages = { 待受理: 0, 已受理: 1, 初查: 1, 已立案: 1, 不予立案: 1, 分流帮扶: 2, 已归档: 3 };
export const progressLabels = ["已接收", "研判中", "已转办", "已办结"];

// Only public progress is returned; internal notes and personal data stay private.
export function reportProgress(report, logs = []) {
  const submittedAt = report.submittedAt || logs.find(e => e.reportId === report.id && e.action.startsWith("提交线索"))?.time || report.receivedAt;
  const history = [{ status: "待受理", time: submittedAt }];
  for (const entry of report.progressHistory ? [] : logs) {
    if (entry.reportId !== report.id) continue;
    const status = entry.action.match(/^status (已受理|初查|已立案|不予立案|已归档)(?:：|$)/)?.[1];
    if (status) history.push({ status, time: entry.time });
    else if (entry.action.startsWith("divert：")) history.push({ status: "分流帮扶", time: entry.time });
    else if (entry.action.startsWith("upgrade：")) history.push({ status: "待受理", time: entry.time });
  }
  for (const entry of report.progressHistory || []) {
    if (Object.hasOwn(stages, entry.status)) history.push({ status: entry.status, time: entry.time });
  }
  const seen = new Set();
  const events = history.filter(e => e.time && !seen.has(e.status + e.time) && seen.add(e.status + e.time))
    .sort((a, b) => a.time.localeCompare(b.time))
    .map(e => ({ status: e.status, stage: stages[e.status], label: progressLabels[stages[e.status]], time: e.time }));
  return { id: report.id, status: report.status, receivedAt: submittedAt, stage: stages[report.status] ?? 0, timeline: events };
}

export function recordReportProgress(report, previousStatus, logs) {
  if (report.status === previousStatus) return;
  if (!report.progressHistory) report.progressHistory = reportProgress({ ...report, status: previousStatus }, logs).timeline.map(({ status, time }) => ({ status, time }));
  report.progressHistory.push({ status: report.status, time: new Date().toISOString() });
}
