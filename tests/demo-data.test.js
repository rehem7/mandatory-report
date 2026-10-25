import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resetDemoData } from "../demo-data.js";
import { sessionClient } from "./support/client.js";

test("重置只替换生成的演示样例，保留提交、账号、对话与草稿", () => {
  const submitted = { id: "submitted-report", ai: { mock: true }, description: "用户已提交的数据" };
  const db = { reports: [submitted], logs: [{ reportId: submitted.id, action: "保留记录" }], users: [{ id: "user-1" }], sessions: [{ id: "chat-1" }], reportDrafts: [{ id: "draft-1" }] };
  const otherData = JSON.stringify([db.users, db.sessions, db.reportDrafts]);
  const first = resetDemoData(db), oldIds = db.reports.filter(row => row.demoFixture).map(row => row.id);
  assert.deepEqual(first, { created: 6, preserved: 1 });
  db.reports[0].status = "已归档";
  const second = resetDemoData(db);
  assert.deepEqual(second, first);
  assert.equal(db.reports.length, 7);
  assert.ok(db.reports.includes(submitted));
  assert.ok(db.reports.every(row => !oldIds.includes(row.id)));
  assert.ok(db.logs.every(row => !oldIds.includes(row.reportId)));
  assert.ok(db.logs.some(row => row.reportId === submitted.id));
  assert.equal(JSON.stringify([db.users, db.sessions, db.reportDrafts]), otherData);
});

test("首页重置接口覆盖各接收部门并保留用户提交，重复重置不累积样例", async () => {
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
    assert.match(home, /id="reset-demo-data"/);
    const submission = await call("/api/reports", { consent: true, identity: "社区工作人员", region: "测试地区", address: "保留地址", occurredAt: new Date().toISOString(), age: "10", types: ["其他"], typeOther: "待核实", description: "非样例的已提交报告", reporter: { name: "保留身份", phone: "" } });
    assert.equal(submission.status, 201);
    assert.equal((await call("/api/demo/reset", {})).status, 400);
    assert.equal((await call("/api/demo/reset", { confirm: "reset-demo-data" }, "妇联")).status, 403);
    for (let attempt = 0; attempt < 2; attempt++) {
      const reset = await call("/api/demo/reset", { confirm: "reset-demo-data" });
      assert.equal(reset.status, 200); assert.equal(reset.data.created, 6); assert.equal(reset.data.preserved, 1);
      const police = (await call("/api/reports")).data;
      assert.equal(police.length, 7);
      assert.ok(police.some(row => row.id === submission.data.id && row.description === "非样例的已提交报告"));
      for (const role of ["民政", "教育", "妇联"]) {
        const reports = (await call("/api/reports", undefined, role)).data;
        assert.equal(reports.length, 1); assert.equal(reports[0].department, role);
        assert.match(reports[0].description, /虚构演示/);
        for (const field of ["address", "reporter", "receipt", "attachments"]) assert.equal(reports[0][field], undefined);
      }
      const supervision = (await call("/api/reports", undefined, "检察院")).data;
      assert.equal(supervision.length, 1); assert.equal(supervision[0].supervision[0].reason, "超期未处置");
      assert.equal(supervision[0].description, undefined);
      assert.equal((await call("/api/my-reports")).data.length, 1);
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
