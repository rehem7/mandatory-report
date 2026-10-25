import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resetDemoData } from "../demo-data.js";
import { sessionClient } from "./support/client.js";

test("重置清除全部旧线索与办理记录，恢复12条固定基准案例", () => {
  const submitted = { id: "submitted-report", ai: { mock: true }, description: "用户已提交的数据" };
  const db = { reports: [submitted, { id: "old-fixture", demoFixture: "receiver-demo-v1" }], logs: [{ reportId: submitted.id, action: "保留记录" }, { reportId: "old-fixture", action: "旧样例" }], users: [{ id: "user-1" }], sessions: [{ id: "chat-1" }], reportDrafts: [{ id: "draft-1" }] };
  const otherData = JSON.stringify([db.users, db.sessions, db.reportDrafts]);
  const first = resetDemoData(db);
  const baseline = structuredClone(db.reports.map(({ receipt, ...report }) => report));
  assert.deepEqual(first, { created: 12, removed: 2 });
  db.reports[0].status = "初查";
  db.reports[0].helpRecords.push({ note: "重置后必须清除" });
  db.reports.push({ id: "later-report" });
  const second = resetDemoData(db);
  assert.deepEqual(second, { created: 12, removed: 13 });
  assert.equal(db.reports.length, 12);
  assert.deepEqual(db.reports.map(({ receipt, ...report }) => report), baseline);
  assert.equal(new Set(db.reports.map(row => row.sourceCase.title)).size, 12);
  assert.ok(!db.reports.some(row => row.id === "old-fixture"));
  for (const row of db.reports.filter(row => row.sourceCase)) {
    assert.match(row.sourceCase.url, /^https:\/\/www\.spp\.gov\.cn\//);
    assert.equal(row.receivedAt, null);
    assert.equal(row.deadline, null);
    assert.doesNotMatch(JSON.stringify(row), /虚构/);
  }
  assert.ok(!db.reports.includes(submitted));
  assert.ok(!db.reports.some(row => row.id === "later-report"));
  assert.ok(db.logs.every(row => row.reportId !== submitted.id && row.reportId !== "old-fixture"));
  assert.equal(JSON.stringify([db.users, db.sessions, db.reportDrafts]), otherData);
});

test("接收端重置先备份再清除旧提交，每次均恢复12条案例及各部门初始状态", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mandatory-demo-reset-"));
  Object.assign(process.env, { DATA_DIR: dir, AI_CATALOG_ENABLED: "0" });
  const { server } = await import("../server.js");
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`, client = sessionClient(base);
  const call = async (url, body, role = "公安", method = body ? "POST" : "GET") => {
    const response = await client(url, { method, headers: { "Content-Type": "application/json", "X-Demo-Role": encodeURIComponent(role) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  try {
    const home = await (await fetch(base + "/")).text();
    assert.doesNotMatch(home, /id="reset-demo-data"/);
    const workbench = await (await fetch(base + "/receiver")).text();
    assert.match(workbench, /id="reset-demo-data"/);
    const submission = await call("/api/reports", { consent: true, identity: "社区工作人员", region: "测试地区", address: "保留地址", occurredAt: new Date().toISOString(), age: "10", types: ["其他"], typeOther: "待核实", description: "非样例的已提交报告", reporter: { name: "保留身份", phone: "" } });
    assert.equal(submission.status, 201);
    assert.equal((await call("/api/demo/reset", {})).status, 400);
    assert.equal((await call("/api/demo/reset", { confirm: "reset-demo-data" }, "妇联")).status, 403);
    for (let attempt = 0; attempt < 2; attempt++) {
      const reset = await call("/api/demo/reset", { confirm: "reset-demo-data" });
      assert.equal(reset.status, 200); assert.equal(reset.data.created, 12); assert.equal(reset.data.removed, attempt === 0 ? 1 : 12);
      assert.equal(reset.data.backupSaved, true);
      const police = (await call("/api/reports")).data;
      assert.equal(police.length, 12);
      assert.ok(police.every(row => row.sourceCase && row.status === "已归档"));
      assert.ok(!police.some(row => row.id === submission.data.id));
      assert.ok(!JSON.stringify(police).includes("稍后新增的记录"));
      for (const role of ["民政", "教育", "妇联"]) {
        const reports = (await call("/api/reports", undefined, role)).data;
        assert.equal(reports.length, role === "教育" ? 2 : 1); assert.equal(reports[0].department, role);
        assert.doesNotMatch(reports[0].description, /虚构/);
        assert.equal(reports[0].sourceCase.publisher, "最高人民检察院");
        for (const field of ["address", "reporter", "receipt", "attachments"]) assert.equal(reports[0][field], undefined);
      }
      const supervision = (await call("/api/reports", undefined, "检察院")).data;
      assert.equal(supervision.length, 5); assert.match(supervision[0].supervision[0].reason, /立案监督/);
      assert.equal(supervision[0].sourceCase.publisher, "最高人民检察院");
      assert.equal(supervision[0].description, undefined);
      assert.equal((await call("/api/my-reports")).data.length, 0);
      if (attempt === 0) assert.equal((await call("/api/reports/CASE-BASE-002/action", { action: "help", note: "稍后新增的记录" }, "民政")).status, 200);
    }
    const backups = fs.readdirSync(path.join(dir, "backups"));
    assert.equal(backups.length, 2);
    assert.ok(backups.some(name => JSON.parse(fs.readFileSync(path.join(dir, "backups", name))).reports.some(report => report.id === submission.data.id)));
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
