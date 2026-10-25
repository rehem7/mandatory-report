import test from "node:test";
import { sessionClient } from "./support/client.js";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cases, gradeTraining, trainingFeedbackContext } from "../content.js";

test("真实协议代理、失败重试、实训评分、记录归属、单位导出和删除", async () => {
  const requests = []; let failNext = false;
  const upstream = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    requests.push({ path: req.url, body: JSON.parse(Buffer.concat(chunks).toString()) });
    res.writeHead(failNext ? 503 : 200, { "Content-Type": "application/json" });
    if (failNext) { failNext = false; res.end(JSON.stringify({ error: { message: "upstream-private-error" } })); }
    else res.end(JSON.stringify({ choices: [{ message: { content: "测试协议响应：我现在在学校，想得到安全帮助。" } }] }));
  });
  await new Promise(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const testData = fs.mkdtempSync(path.join(os.tmpdir(), "mandatory-portal-"));
  process.env.DATA_DIR = testData; process.env.FREE_API_KEY = "test-key-never-public";
  process.env.AI_CATALOG_ENABLED = "0";
  process.env.AI_BASE_URL = "http://127.0.0.1:" + upstream.address().port + "/v1";
  const { server } = await import("../server.js");
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const fetch = sessionClient(base), stranger = sessionClient(base);
  const call = async (url, data, method = data ? "POST" : "GET") => { const r = await fetch(base + url, { method, headers: { "Content-Type": "application/json" }, body: data ? JSON.stringify(data) : undefined }); return { status: r.status, data: await r.json() }; };
  const chosen = "[故人情]gemini-3.8-flash";
  try {
    const registration = await call("/api/auth/register", { email: "teacher@example.test", identity: "教师/教育工作者" });
    const unitPath = "/api/units/" + encodeURIComponent(registration.data.profile.unitId);
    const catalog = (await call("/api/portal/catalog")).data; assert.equal(catalog.cases.length, 9); assert.ok(catalog.cases.every(c => c.fictional && !c.facts && !c.expectedRisk));
    const config = (await call("/api/ai/config")).data; assert.equal(config.models.length, 3); assert.equal(config.defaultModel, chosen); assert.ok(!JSON.stringify(config).includes(process.env.FREE_API_KEY));
    assert.equal((await call("/api/sessions", { learnerId: "public", kind: "qa", model: "fake" })).status, 400);
    const qa = (await call("/api/sessions", { learnerId: "public", kind: "qa", model: chosen })).data;
    const qaPath = "/api/sessions/" + qa.id;
    failNext = true;
    const failure = await call(qaPath + "/messages", { learnerId: "public", model: chosen, content: "虚构测试问题" }); assert.equal(failure.status, 502); assert.ok(!failure.data.error.includes("upstream-private-error"));
    let q = (await call(qaPath + "?learnerId=public")).data; assert.equal(q.messages.length, 1); assert.ok(q.lastError);
    q = (await call(qaPath + "/reply", { learnerId: "public", model: "[故人情]gemini-2.5-pro" })).data; assert.equal(q.messages.length, 2); assert.equal(q.lastError, null); assert.equal(requests.at(-1).body.model, "[故人情]gemini-2.5-pro"); assert.equal(requests.at(-1).path, "/v1/chat/completions");
    assert.equal((await stranger(base + qaPath)).status, 404);
    assert.equal((await call("/api/sessions", { learnerId: "public", kind: "training", caseId: "missing", model: chosen })).status, 400);
    const training = (await call("/api/sessions", { learnerId: "teacher-1", kind: "training", caseId: "school-injury", model: chosen })).data;
    const target = "/api/sessions/" + training.id;
    await call(target + "/messages", { learnerId: "teacher-1", model: chosen, content: "你现在安全吗？愿意告诉我发生了什么吗？" });
    const worksheet = { risk: [0, 1], communication: [0, 1], evidence: [0, 1], safety: "在学校安全区域安排教师陪伴，及时保护并联系公安", decision: "report", reason: "发现疑似持续侵害与回家危险，应立即报告，不等待自行调查结束。", preserveOriginal: true, protectPrivacy: true, report: { location: "虚构学校辅导室", type: "身体虐待", description: "【虚构实训】学生出现反复伤痕并表达害怕回家的担忧，目前在学校安全区域由教师陪伴。", confirmFictional: true } };
    assert.equal((await call(target + "/worksheet", { learnerId: "teacher-1", worksheet })).status, 200);
    assert.equal((await call(target + "?learnerId=teacher-1")).data.worksheet.report.location, worksheet.report.location);
    const done = (await call(target + "/finish", { learnerId: "teacher-1", model: chosen, worksheet, score: { total: 999 } })).data; assert.equal(done.score.total, 100); assert.equal(done.score.passed, true); assert.equal(done.score.items.length, 5); assert.ok(done.feedback); assert.equal(done.state, "completed");
    const feedbackRequest = requests.at(-1).body.messages;
    const feedbackInput = JSON.parse(feedbackRequest.at(-1).content);
    assert.equal(feedbackInput.用户工作表.报告判断, "报告（出现疑似侵害或危险，应立即报告）");
    assert.deepEqual(feedbackInput.用户工作表.风险识别, catalog.cases[0].riskOptions.slice(0, 2));
    assert.equal(feedbackInput.用户工作表.保留已有原始材料及时间信息, "已勾选");
    assert.equal(feedbackInput.用户工作表.避免公开传播可识别信息, "已勾选");
    assert.equal(feedbackInput.已确定的规则评分.总分, done.score.total);
    assert.deepEqual(feedbackInput.已确定的规则评分.各项得分.map(i => i.得分), done.score.items.map(i => i.score));
    assert.ok(!/preserveOriginal|protectPrivacy|confirmFictional|"decision"|"report"|"safety"|"risk"|"score"/.test(feedbackRequest.at(-1).content));
    assert.equal((await call(target + "/finish", { learnerId: "teacher-1", worksheet })).status, 409);
    assert.equal((await call("/api/reports")).data.length, 0, "模拟上报不得进入公安队列");
    assert.equal((await call("/api/learning", { learnerId: "teacher-1", materialId: "missing" })).status, 400);
    assert.equal((await call("/api/learning/teacher-duty/quiz", { answers: [0, 1] })).status, 400, "必须完成全部题目");
    const practice = await call("/api/learning/teacher-duty/quiz", { answers: [0, 1, 1] });
    assert.equal(practice.status, 200, "无需阅读计时即可直接练习");
    assert.equal(practice.data.lastQuiz.score, 100); assert.equal(practice.data.lastQuiz.items.length, 3);
    const ledger = (await call(unitPath)).data; assert.equal(ledger.totals.completed, 1); assert.equal(ledger.totals.passed, 1); assert.equal(ledger.totals.learning, 1); assert.equal(ledger.totals.mastered, 1);
    const csv = await (await fetch(base + unitPath + "/export.csv")).text(); assert.ok(csv.includes("风险识别")); assert.ok(csv.includes("100")); assert.ok(csv.includes("知识掌握")); assert.ok(!csv.includes("愿意告诉我发生了什么")); assert.ok(!csv.includes(worksheet.report.description));
    const persisted = JSON.parse(fs.readFileSync(path.join(testData, "database.json"), "utf8")); assert.equal(persisted.sessions.length, 2); assert.equal(persisted.sessions[1].score.total, 100); assert.equal(persisted.learning.length, 1);
    assert.equal((await stranger(base + target, { method: "DELETE" })).status, 404);
    await call(target + "?learnerId=teacher-1", null, "DELETE");
    await call("/api/learning/" + practice.data.id, null, "DELETE");
    const cleared = (await call(unitPath)).data; assert.equal(cleared.rows.length, 0); assert.equal(cleared.totals.completed, 0);
  } finally {
    await new Promise(resolve => server.close(resolve)); await new Promise(resolve => upstream.close(resolve));
    fs.unlinkSync(path.join(testData, "database.json")); fs.rmdirSync(testData);
  }
});

test("复盘输入如实说明空白、未选和未勾选，不把选项当成实际行动", () => {
  const worksheet = { risk: [], communication: [], evidence: [], safety: "", reason: "", decision: "", preserveOriginal: false, protectPrivacy: false, report: {} };
  const score = gradeTraining(cases[0], worksheet, []);
  const input = trainingFeedbackContext(cases[0], worksheet, score, []);
  assert.deepEqual(input.用户工作表.风险识别, ["未选择"]);
  assert.equal(input.用户工作表.报告判断, "未选择");
  assert.equal(input.用户工作表.当前安全保护措施, "未填写");
  assert.equal(input.用户工作表.保留已有原始材料及时间信息, "未勾选");
  assert.equal(input.用户工作表.避免公开传播可识别信息, "未勾选");
  assert.equal(input.用户工作表.模拟上报.确认本次为虚构演练, "未勾选");
  assert.equal(input.已确定的规则评分.总分, score.total);
  for (const [decision, expected] of [["wait", "等待自行调查清楚后再报告"], ["none", "无需关注或报告"]]) {
    assert.equal(trainingFeedbackContext(cases[0], { ...worksheet, decision }, score, []).用户工作表.报告判断, expected);
  }
});
