import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

test("官方 DeepSeek 读取独立密钥，兼容 Flash 官方别名并保持界面名称", async () => {
  const requests = [];
  const upstream = http.createServer(async (req, res) => {
    assert.equal(req.headers.authorization, "Bearer official-test-only");
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/v1/models") return res.end(JSON.stringify({ data: [{ id: "deepseek-flash" }, { id: "deepseek-v4-pro" }] }));
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    requests.push(JSON.parse(Buffer.concat(chunks)));
    res.end(JSON.stringify({ choices: [{ message: { content: "OK" } }] }));
  });
  await new Promise(resolve => upstream.listen(0, "127.0.0.1", resolve));
  Object.assign(process.env, {
    FREE_API_KEY: "", FREE_API_KEY_2: "", FREE_API_KEY_3: "", FREE_API_KEY_4: "",
    DEEPSEEK_API_KEY: "official-test-only", AI_CATALOG_ENABLED: "1",
    DEEPSEEK_API_BASE_URL: `http://127.0.0.1:${upstream.address().port}/v1`
  });
  try {
    const { complete, aiConfig } = await import("../ai.js");
    const config = aiConfig(), flash = config.models.find(model => model.id === config.defaultModel);
    assert.equal(flash.name, "DeepSeek V4.1 Flash");
    assert.match(flash.description, /高吞吐/);
    assert.equal(await complete(flash.id, [{ role: "user", content: "test" }]), "OK");
    assert.equal(await complete("deepseek:deepseek-v4-pro", [{ role: "user", content: "test" }]), "OK");
    assert.deepEqual(requests.map(request => request.model), ["deepseek-flash", "deepseek-v4-pro"]);
    assert.ok(!JSON.stringify(config).includes("official-test-only"));
  } finally {
    upstream.closeAllConnections();
    await new Promise(resolve => upstream.close(resolve));
  }
});
