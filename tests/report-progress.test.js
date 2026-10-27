import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { reportProgress } from "../report-progress.js";
import { sessionClient } from "./support/client.js";

test("公开进度覆盖接收端全部办理状态", () => {
  const expected = { 待受理: 0, 已受理: 1, 初查: 1, 已立案: 1, 不予立案: 1, 分流帮扶: 2, 已归档: 3 };
  for (const [status, stage] of Object.entries(expected)) {
    assert.equal(reportProgress({ id: "mapping", status, receivedAt: "2026-10-01T08:00:00Z" }).stage, stage, status);
  }
});

test("旧办理日志恢复公开时间轴，不公开内部备注或虚构转办", () => {
  const result = reportProgress({ id: "legacy", status: "已归档", receivedAt: "2026-10-01T08:00:00Z", description: "private" }, [
    { reportId: "other", action: "status 已受理：private", time: "2026-10-02T08:00:00Z" },
    { reportId: "legacy", action: "status 已受理：private", time: "2026-10-02T08:00:00Z" },
    { reportId: "legacy", action: "status 已立案：private", time: "2026-10-03T08:00:00Z" },
    { reportId: "legacy", action: "status 已归档：private", time: "2026-10-04T08:00:00Z" }
  ]);
  assert.equal(result.stage, 3);
  assert.deepEqual(result.timeline.map(e => e.stage), [0, 1, 1, 3]);
  assert.doesNotMatch(JSON.stringify(result), /private/);
});

test("上报进度随真实办理更新、升级保留原提交时间并隔离其他用户", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "report-progress-"));
  process.env.DATA_DIR = dir;
  process.env.AI_CATALOG_ENABLED = "0";
  const { server } = await import("../server.js");
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const owner = sessionClient(base), other = sessionClient(base);
  const call = async (client, url, body, role = "公安") => {
    const response = await client(url, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "X-Demo-Role": encodeURIComponent(role) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.ok(response.ok, `${url}: ${response.status}`);
    return response.json();
  };
  try {
    const submitted = await call(owner, "/api/reports", { identity: "教师/教育工作者", region: "虚构地区", address: "虚构学校", occurredAt: "2026-10-01T09:00", age: "7-13岁", description: "进度测试", types: ["忽视"], consent: true });
    const target = `/api/reports/${submitted.id}/action`;
    const read = async () => (await call(owner, "/api/portal/records")).receipts[0];
    const assertSync = async (status, stage) => {
      const receiver = await call(owner, `/api/reports/${submitted.id}`);
      const records = await read();
      const mine = (await call(owner, "/api/my-reports"))[0];
      const receipt = await call(owner, "/api/receipt", { id: submitted.id, receipt: submitted.receipt });
      assert.equal(receiver.status, status);
      for (const progress of [records, mine, receipt]) {
        assert.equal(progress.status, receiver.status);
        assert.equal(progress.stage, stage);
        assert.equal(progress.timeline.at(-1).status, status);
      }
    };
    assert.deepEqual((await read()).timeline.map(e => e.stage), [0]);
    await assertSync("待受理", 0);
    assert.equal((await call(other, "/api/my-reports")).length, 0);
    assert.equal((await call(other, "/api/portal/records")).receipts.length, 0);
    await call(owner, target, { action: "review", tag: "B", note: "内部隐私备注" });
    assert.equal((await read()).timeline.length, 1, "人工复核不凭空推进办理状态");
    await call(owner, target, { action: "status", status: "已受理", note: "内部隐私备注" });
    await assertSync("已受理", 1);
    await call(owner, target, { action: "divert", department: "教育", note: "内部隐私备注" });
    await assertSync("分流帮扶", 2);
    let progress = await read();
    assert.equal(progress.stage, 2);
    assert.deepEqual(progress.timeline.map(e => e.stage), [0, 1, 2]);
    assert.doesNotMatch(JSON.stringify(progress), /内部隐私备注|receipt|ownerId|reporter|description/);
    await call(owner, target, { action: "upgrade", note: "内部隐私备注" }, "教育");
    await assertSync("待受理", 0);
    progress = await read();
    assert.equal(progress.stage, 0);
    assert.equal(progress.receivedAt, submitted.receivedAt);
    assert.deepEqual(progress.timeline.map(e => e.stage), [0, 1, 2, 0]);
    await call(owner, target, { action: "review", tag: "A", note: "复核" });
    for (const status of ["已受理", "初查", "已归档"]) {
      await call(owner, target, { action: "status", status, note: "办理" });
      await assertSync(status, status === "已归档" ? 3 : 1);
    }
    progress = await call(owner, "/api/receipt", { id: submitted.id, receipt: submitted.receipt });
    assert.equal(progress.stage, 3);
    assert.equal(progress.timeline.at(-1).label, "已办结");
    assert.equal(progress.timeline.length, 7);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
