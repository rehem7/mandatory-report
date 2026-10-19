import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Load the same browser module with its absolute web import resolved for Node.
const source = fs.readFileSync(new URL("../public/markdown.js", import.meta.url), "utf8")
  .replace('from "/vendor/markdown-it.js"', `from ${JSON.stringify(new URL("../public/vendor/markdown-it.js", import.meta.url).href)}`);
const { renderMarkdown } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

test("复盘 Markdown 支持中文标点加粗、嵌套强调、段落列表和流式补全", () => {
  const content = "## 报告判断\n\n**扣分原因：**未填写依据。\n\n你应**立即报告（无需等待调查）**并保护孩子。\n\n- **保留*已有*原始记录**\n  - 时间、地点和原话\n\n1. 确认安全\n2. 及时报告\n\n---\n\n**跨行\n重点**\n\n`**原样星号**`\n\n\\*\\*转义星号\\*\\*";
  const html = renderMarkdown(content);
  for (const expected of ["<h2>报告判断</h2>", "<strong>扣分原因：</strong>未填写依据。", "<strong>立即报告（无需等待调查）</strong>并保护孩子。", "<strong>保留<em>已有</em>原始记录</strong>", "<ul>", "<ol>", "<hr>", "<strong>跨行<br>", "<code>**原样星号**</code>", "**转义星号**"]) assert.ok(html.includes(expected), expected);
  const stream = "**扣分原因：**缺少安全措施。";
  for (let i = 0; i <= stream.length; i++) assert.doesNotThrow(() => renderMarkdown(stream.slice(0, i)));
  assert.ok(renderMarkdown(stream).includes("<strong>扣分原因：</strong>"));
  assert.ok(renderMarkdown("```text\n**不要加粗**\n<script>alert(1)</script>\n```").includes("**不要加粗**\n&lt;script&gt;"));
});

test("Markdown 保持 HTML 和危险链接为纯文本，普通链接安全打开", () => {
  const html = renderMarkdown('<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n[危险](javascript:alert(1))\n![图片](https://example.com/tracking.png)\n[来源](https://example.com/law?q=1&x=2)');
  assert.ok(!html.includes("<script") && !html.includes("<img") && !html.includes('href="javascript:'));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes('href="https://example.com/law?q=1&amp;x=2" target="_blank" rel="noopener noreferrer"'));
});
