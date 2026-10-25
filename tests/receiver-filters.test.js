import test from "node:test";
import assert from "node:assert/strict";
import { matchesQueueFilter, receiverStatCards } from "../public/receiver-filters.js";

const reports = [
  { id: "pending", confirmedTag: null, status: "待受理", supervision: [], helpRecords: [] },
  { id: "overdue", confirmedTag: "A", status: "初查", supervision: [{ reason: "超期未处置" }], helpRecords: [] },
  { id: "not-filed", confirmedTag: "A", status: "不予立案", supervision: [{ reason: "不予立案" }], helpRecords: [] },
  { id: "unreported", confirmedTag: "A", status: "已归档", supervision: [{ reason: "应报未报：未及时报告" }], helpRecords: [] },
  { id: "help-pending", confirmedTag: "B", status: "分流帮扶", supervision: [], helpRecords: [] },
  { id: "help-recorded", confirmedTag: "B", status: "分流帮扶", supervision: [], helpRecords: [{ note: "已跟进" }] },
  { id: "archived", confirmedTag: "C", status: "已归档", supervision: [], helpRecords: [] }
];
const ids = filter => reports.filter(report => matchesQueueFilter(report, filter)).map(report => report.id);

test("公安四张统计卡对应全部、待复核、A类和监督线索", () => {
  assert.deepEqual(ids("all"), reports.map(report => report.id));
  assert.deepEqual(ids("pending"), ["pending"]);
  assert.deepEqual(ids("a"), ["overdue", "not-filed", "unreported"]);
  assert.deepEqual(ids("supervision"), ["overdue", "not-filed", "unreported"]);
  assert.deepEqual(receiverStatCards("公安", reports).map(card => [card[4], card[1]]), [["all", 7], ["pending", 1], ["a", 3], ["supervision", 3]]);
});

test("检察及帮扶部门统计卡筛选匹配队列，归档无记录不计入待帮扶", () => {
  assert.deepEqual(ids("overdue"), ["overdue"]);
  assert.deepEqual(ids("not-filed"), ["not-filed"]);
  assert.deepEqual(ids("unreported"), ["unreported"]);
  const support = reports.filter(report => report.confirmedTag === "B" || report.id === "archived");
  for (const role of ["民政", "教育", "妇联"]) {
    assert.deepEqual(receiverStatCards(role, support).map(card => [card[4], card[1]]), [["all", 3], ["help-pending", 1], ["help-recorded", 1], ["archived", 1]]);
  }
  assert.deepEqual(ids("unknown"), []);
});
