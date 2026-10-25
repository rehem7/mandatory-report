import crypto from "node:crypto";

// This marker is exclusive to generated fixtures, never inferred from AI tags.
const fixtureVersion = "receiver-demo-v1";
export function resetDemoData(db, now = Date.now()) {
  const oldIds = new Set(db.reports.filter(report => report.demoFixture === fixtureVersion).map(report => report.id));
  const receivedAt = new Date(now - 2 * 3600000).toISOString();
  const rows = [
    { label: "待接收", types: ["其他"], confirmedTag: null, status: "待受理", description: "【虚构演示】社区发现一名儿童情绪低落，情况尚不明确，需要核实当前安全。" },
    { label: "待分流", types: ["情感忽视"], confirmedTag: "B", status: "已受理", description: "【虚构演示】儿童缺少稳定陪伴，已完成初步核实，等待选择适合的帮扶部门。" },
    { label: "民政帮扶", department: "民政", types: ["照料忽视"], confirmedTag: "B", status: "分流帮扶", description: "【虚构演示】家庭暂时缺少照料支持，需要评估照护与生活帮扶。", helpSummary: "【虚构演示】需评估临时照料与家庭生活支持，尚无明确侵害事实，请跟进帮扶需求。" },
    { label: "教育帮扶", department: "教育", types: ["其他"], confirmedTag: "B", status: "分流帮扶", description: "【虚构演示】学生近期出勤不稳定，需要学校与家庭协同支持。", helpSummary: "【虚构演示】需跟进入学、出勤与心理支持需求，仅提供开展帮扶所需信息。" },
    { label: "妇联帮扶", department: "妇联", types: ["情感忽视"], confirmedTag: "B", status: "分流帮扶", description: "【虚构演示】监护人与孩子沟通困难，希望获得家庭教育与关爱支持。", helpSummary: "【虚构演示】需提供家庭教育指导与关爱支持，请记录联系安排和后续计划。" },
    { label: "超期监督", types: ["身体虐待"], confirmedTag: "A", status: "初查", overdue: true, description: "【虚构演示】出现疑似身体侵害信号，已人工确认 A 类；本条专门展示超期监督流程。" }
  ];
  const reports = rows.map((row, index) => {
    const { label, overdue, ...fields } = row;
    return {
      id: `DEMO-${crypto.randomBytes(4).toString("hex").toUpperCase()}-${index + 1}`,
      receipt: crypto.randomBytes(24).toString("hex"), demoFixture: fixtureVersion,
      ownerId: "demo-fixtures", identity: "社区工作人员", identityOther: "", typeOther: "虚构演示案例",
      region: "演示省 · 演示市 · 演示区", address: "演示地点（非真实地址）",
      occurredAt: receivedAt, age: "10岁（虚构）", reporter: { name: "", organization: "", phone: "" },
      anonymous: true, obligated: true, attachments: [],
      receivedAt: overdue ? new Date(now - 26 * 3600000).toISOString() : receivedAt,
      deadline: new Date(now + (overdue ? -2 : 22) * 3600000).toISOString(),
      ai: { tag: row.confirmedTag || "C", risk: row.confirmedTag === "A" ? "高" : "待核实", infringement: row.types.join("、"), threshold: "虚构演示，需人工复核", reason: `演示场景：${label}`, evidence: [], mock: true },
      department: null, helpSummary: "", helpRecords: [], supervision: [], ...fields
    };
  });
  db.reports = [...reports, ...db.reports.filter(report => !oldIds.has(report.id))];
  db.logs = db.logs.filter(entry => !oldIds.has(entry.reportId));
  for (const report of reports) {
    db.logs.push({ id: crypto.randomUUID(), role: "系统", action: "创建虚构演示样例" + (report.department ? `：B类人工分流至${report.department}` : ""), reportId: report.id, time: new Date(now).toISOString() });
  }
  return { created: reports.length, preserved: db.reports.length - reports.length };
}
