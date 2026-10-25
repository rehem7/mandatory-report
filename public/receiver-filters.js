export function matchesQueueFilter(report, filter) {
  switch (filter) {
    case "all": return true;
    case "pending": return !report.confirmedTag;
    case "a": return report.confirmedTag === "A";
    case "supervision": return !!report.supervision?.length;
    case "overdue": return report.supervision?.some(item => item.reason === "超期未处置") || false;
    case "not-filed": return report.supervision?.some(item => item.reason === "不予立案") || false;
    case "unreported": return report.supervision?.some(item => item.reason.startsWith("应报未报")) || false;
    case "help-pending": return report.status !== "已归档" && !report.helpRecords?.length;
    case "help-recorded": return !!report.helpRecords?.length;
    case "archived": return report.status === "已归档";
    default: return false;
  }
}

export function receiverStatCards(role, reports) {
  const definitions = role === "公安" ? [
    ["收到线索", "inbox", "当前接收的全部线索", "all"],
    ["待人工复核", "review", "AI 建议等待人工确认", "pending"],
    ["A 类监管", "shield", "已人工确认的监管线索", "a"],
    ["监督线索", "scale", "已推送至检察监督", "supervision"]
  ] : role === "检察院" ? [
    ["监督摘要", "inbox", "当前收到的监督线索", "all"],
    ["超期未处置", "clock", "超过 24h 处置时限", "overdue"],
    ["不予立案", "file", "A 类不予立案线索", "not-filed"],
    ["应报未报", "review", "公安移送监督摘要", "unreported"]
  ] : [
    ["本部门线索", "inbox", "公安分流至本部门", "all"],
    ["待帮扶", "heart", "尚未归档且未登记帮扶记录", "help-pending"],
    ["已有帮扶记录", "review", "已开展帮扶的线索", "help-recorded"],
    ["已归档", "file", "已完成阶段处置", "archived"]
  ];
  return definitions.map(([title, symbol, hint, filter]) => [title, reports.filter(report => matchesQueueFilter(report, filter)).length, symbol, hint, filter]);
}
