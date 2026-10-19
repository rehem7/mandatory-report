import test from "node:test";
import { sessionClient } from "./support/client.js";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readEvents } from "../public/event-stream.js";
import { reportDraft, webSearch } from "../chat-tools.js";

test("官方检索限制范围，失败如实降级，草稿保留未知字段", async () => {
  const original = globalThis.fetch;
  const visited = [];
  process.env.AI_SEARCH_ENDPOINT = "https://search.example.test/rss";
  globalThis.fetch = async (url, options) => {
    visited.push(String(url));
    if (String(url).startsWith(process.env.AI_SEARCH_ENDPOINT)) return new Response('<rss><item><title>官方资料</title><link>https://unit.gov.cn/report</link></item><item><title>外部页面</title><link>https://example.test/not-official</link></item></rss>');
    assert.match(String(url), /^https:\/\/[^/]+\.gov\.cn\//);
    if (options.signal.aborted) throw options.signal.reason;
    return new Response('<html><script>ignore</script>未成年人保护 强制报告测试正文</html>');
  };
  try {
    const result = await webSearch("强制报告制度");
    assert.equal(result.strength, "medium"); assert.equal(result.mode, "web-search");
    assert.equal(result.results.length, 1); assert.match(result.results[0].snippet, /强制报告测试正文/);
    assert.equal(visited.some(url => url.includes("not-official")), false);
    await webSearch("虚构姓名张三住在虚构路，疑似虐待");
    const query = new URL(visited.findLast(url => url.startsWith(process.env.AI_SEARCH_ENDPOINT))).searchParams.get("q");
    assert.match(query, /虐待/); assert.doesNotMatch(query, /张三|虚构路/);
    await assert.rejects(webSearch("电话 13800000000"), /个人信息/);
    globalThis.fetch = async url => String(url).startsWith(process.env.AI_SEARCH_ENDPOINT) ? new Response('<rss/>') : new Response('未成年人保护 官方资料');
    const fallback = await webSearch("报告流程");
    assert.equal(fallback.mode, "official-source-fallback"); assert.match(fallback.note, /不是完整全网检索/);
    assert.ok(fallback.results.length > 0 && fallback.results.length <= 5);
    const draft = reportDraft({ description: "虚构线索", types: ["拐卖", "拐卖", "不存在"], identity: "猜测", occurredAt: "昨天" });
    assert.deepEqual(draft.fields.types, ["拐卖"]);
    assert.equal(draft.fields.identity, ""); assert.equal(draft.fields.occurredAt, "");
    assert.equal(draft.fields.reporter.phone, ""); assert.equal(draft.origin, "chat");
    assert.throws(() => reportDraft(null), /字段无效/);
  } finally { globalThis.fetch = original; delete process.env.AI_SEARCH_ENDPOINT; }
});

test("停止回填、提前停止、工具草稿、用户记忆隔离及不支持工具的降级", async () => {
  let mode = "gated", calls = 0, upstreamClosed = false, lastRequest;
  const upstream = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const request = JSON.parse(Buffer.concat(chunks)); calls++; lastRequest = request;
    if (mode === "unsupported" && request.tools) { res.writeHead(400); return res.end('{}'); }
    if (!request.stream) {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ description: "用户明确提供的虚构事件", types: ["暴力伤害"], region: "", age: "" }) } }] }));
    }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    const delta = value => res.write('data: ' + JSON.stringify({ choices: [{ delta: value }] }) + '\n\n');
    const end = () => res.end('data: [DONE]\n\n');
    // Provider-only reasoning must never become public activity or answer text.
    delta({ reasoning_content: "PRIVATE_REASONING_SENTINEL" });
    if (mode === "pretoken") return;
    if (mode === "gated") { res.once("close", () => { upstreamClosed = true; }); delta({ content: "尚未完成的回答" }); return; }
    if (mode === "tools" && !request.messages.some(m => m.role === "tool")) {
      const args = JSON.stringify({ description: "我发现虚构学生有伤痕且害怕回家", types: ["身体虐待"], identity: "教师/教育工作者" });
      delta({ tool_calls: [{ index: 0, id: "draft-call", type: "function", function: { name: "prepare_report_draft", arguments: args.slice(0, 15) } }] });
      delta({ tool_calls: [{ index: 0, function: { arguments: args.slice(15) } }, { index: 1, id: "pref-call", type: "function", function: { name: "remember_user_preference", arguments: JSON.stringify({ preference: "回答先给操作步骤" }) } }] });
      return end();
    }
    if (mode === "invalid-tool" && !request.messages.some(m => m.role === "tool")) {
      delta({ tool_calls: [{ index: 0, id: "invalid", type: "function", function: { name: "prepare_report_draft", arguments: JSON.stringify({ description: "" }) } }] });
      return end();
    }
    delta({ content: "已完成测试回复，可核对报告草稿。" }); end();
  });
  await new Promise(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mandatory-tools-"));
  process.env.DATA_DIR = dir; process.env.FREE_API_KEY = "local-test-placeholder";
  process.env.AI_CATALOG_ENABLED = "0";
  process.env.AI_BASE_URL = "http://127.0.0.1:" + upstream.address().port + "/v1";
  const { server } = await import("../server.js");
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const owner = "11111111-1111-4111-8111-111111111111", stranger = "22222222-2222-4222-8222-222222222222";
  const model = "[故人情]gemini-3.8-flash";
  const clients = new Map([[owner, sessionClient(base)], [stranger, sessionClient(base)]]);
  const request = (url, body, user = owner, method = body ? "POST" : "GET") => clients.get(user)(base + url, { method, headers: { "Content-Type": "application/json", "X-Chat-User": user }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const create = async () => (await request("/api/sessions", { learnerId: "public", model, kind: "qa" })).json();
  const get = async s => (await request("/api/sessions/" + s.id + "?learnerId=public")).json();
  const memory = async user => (await request("/api/memory?learnerId=public", undefined, user)).json();
  const send = (s, content, requestId) => request("/api/sessions/" + s.id + "/messages", { learnerId: "public", model, content, stream: true, requestId });
  const stop = (s, requestId, user = owner) => request("/api/sessions/" + s.id + "/stop", { learnerId: "public", requestId }, user);
  const collect = async response => { const events = []; await readEvents(response.body, e => events.push({ event: e.event, value: JSON.parse(e.data) })); return events; };
  try {
    mode = "pretoken";
    const waiting = await create(), beforeText = [], waitingResponse = await send(waiting, "首字前进度测试", "pretoken-test");
    await readEvents(waitingResponse.body, async e => {
      const value = JSON.parse(e.data); beforeText.push({ event: e.event, value });
      if (e.event === "activity" && value.step.detail?.includes("连接已建立")) {
        const snapshot = await get(waiting);
        assert.equal(snapshot.busy, true); assert.equal(snapshot.generation.content, "");
        assert.equal(snapshot.generation.activity.at(-1).status, "running");
        assert.equal(snapshot.messages.some(m => m.role === "assistant"), false);
        await stop(waiting, "pretoken-test");
      }
    });
    assert.equal(beforeText.some(e => e.event === "delta"), false);
    assert.equal(beforeText.at(-1).event, "stopped");
    assert.ok(beforeText.some(e => e.event === "activity" && e.value.step.status === "cancelled"));
    assert.doesNotMatch(JSON.stringify(beforeText), /PRIVATE_REASONING_SENTINEL/);
    mode = "gated";
    const s = await create(), response = await send(s, "请停止后回填这条问题", "stop-test");
    let stopResult;
    const events = [];
    await readEvents(response.body, async e => {
      events.push({ event: e.event, value: JSON.parse(e.data) });
      if (e.event === "delta") {
        assert.equal((await stop(s, "stop-test", stranger)).status, 404);
        assert.equal((await get(s)).busy, true);
        stopResult = await (await stop(s, "stop-test")).json();
      }
    });
    assert.equal(stopResult.stopped, true); assert.equal(stopResult.restore.content, "请停止后回填这条问题");
    assert.equal(events.at(-1).event, "stopped");
    assert.deepEqual((await get(s)).messages, []); assert.equal((await get(s)).busy, false);
    for (let n = 0; n < 20 && !upstreamClosed; n++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(upstreamClosed, true, "停止必须取消上游连接");
    assert.equal((await memory(owner)).shortTerm.length, 0);
    const early = await create(), before = calls;
    await stop(early, "early-request");
    const cancelled = await (await send(early, "提前停止的提问", "early-request")).json();
    assert.equal(cancelled.stopped, true); assert.equal(cancelled.restore.content, "提前停止的提问"); assert.equal(calls, before);
    mode = "tools";
    const done = await collect(await send(s, "请记住回答先给操作步骤；我发现虚构学生有伤痕且害怕回家，希望报告", "tool-test"));
    assert.equal(done.at(-1).event, "done");
    const completedStop = await (await stop(s, "tool-test")).json();
    assert.equal(completedStop.stopped, false); assert.equal(completedStop.completed, true);
    const saved = await get(s);
    const trace = saved.messages.at(-1).activity;
    assert.deepEqual(trace.map(step => step.label), ["请求模型", "整理报告草稿", "准备记忆更新", "请求模型"]);
    assert.ok(trace.every(step => step.status === "done"));
    for (const step of trace.filter(step => step.kind === "tool")) {
      const transitions = done.filter(e => e.event === "activity" && e.value.step.id === step.id).map(e => e.value.step.status);
      assert.deepEqual(transitions, ["running", "done"]);
    }
    assert.ok(done.findIndex(e => e.event === "activity") < done.findIndex(e => e.event === "delta"));
    assert.doesNotMatch(JSON.stringify(trace), /虚构学生|回答先给操作步骤|PRIVATE_REASONING_SENTINEL|local-test-placeholder|arguments/);
    assert.doesNotMatch(JSON.stringify(done), /PRIVATE_REASONING_SENTINEL/);
    assert.equal(saved.messages.length, 2); assert.equal(saved.reportDraft.fields.identity, "教师/教育工作者");
    assert.equal(saved.reportDraft.fields.region, ""); assert.equal(saved.reportDraft.fields.age, "");
    assert.equal((await memory(owner)).longTerm, "回答先给操作步骤"); assert.equal((await memory(owner)).shortTerm.length, 1);
    assert.equal((await memory(stranger)).longTerm, ""); assert.equal((await memory(stranger)).shortTerm.length, 0);
    assert.equal((await request("/api/sessions?learnerId=public", undefined, stranger).then(r => r.json())).length, 0);
    const sameOwner = await (await request("/api/memory?learnerId=teacher-1")).json(); assert.equal(sameOwner.longTerm, "回答先给操作步骤", "客户端传入身份不能切换记忆所有者");
    assert.equal((await request("/api/reports").then(r => r.json())).length, 0, "工具只能准备草稿，不能提交");
    mode = "invalid-tool";
    const failedTool = await create(), failedEvents = await collect(await send(failedTool, "工具参数失败测试", "failed-tool"));
    assert.equal(failedEvents.at(-1).event, "done", "工具失败后允许模型解释失败");
    assert.equal((await get(failedTool)).messages.at(-1).activity.find(s => s.kind === "tool").status, "error");
    mode = "normal";
    const next = await create(); await collect(await send(next, "另一个虚构制度问题", "next"));
    assert.ok(lastRequest.messages.some(m => m.role === "system" && m.content.includes("回答先给操作步骤")), "长期记忆进入新会话上下文");
    assert.ok(lastRequest.messages.some(m => m.role === "system" && m.content.includes("虚构学生")), "短期记忆跨会话但按用户隔离");
    await request("/api/sessions/" + s.id + "?learnerId=public", undefined, owner, "DELETE");
    assert.equal((await memory(owner)).shortTerm.some(m => m.sessionId === s.id), false);
    mode = "unsupported";
    const fallback = await create(), fallbackEvents = await collect(await send(fallback, "虚构线索需要整理报告", "unsupported"));
    assert.equal(fallbackEvents.at(-1).event, "done"); assert.equal((await get(fallback)).toolsUnsupported, true);
    assert.ok(fallbackEvents.some(e => e.event === "activity" && e.value.step.status === "warning" && e.value.step.label === "工具兼容性检查"));
    const draft = await (await request("/api/sessions/" + fallback.id + "/report-draft", { learnerId: "public", model })).json();
    assert.equal(draft.fields.description, "用户明确提供的虚构事件");
    assert.equal(draft.fields.reporter.name, "");
    await request("/api/memory?learnerId=public", undefined, owner, "DELETE");
    assert.equal((await memory(owner)).longTerm, ""); assert.equal((await memory(owner)).shortTerm.length, 0);
  } finally {
    server.closeAllConnections(); upstream.closeAllConnections();
    await new Promise(resolve => server.close(resolve)); await new Promise(resolve => upstream.close(resolve));
    fs.unlinkSync(path.join(dir, "database.json")); fs.rmdirSync(dir);
  }
});
