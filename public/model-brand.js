// Provider identity is independent of model version and gateway route.
const brands = {
  gemini: { name: "Gemini", icon: "/assets/Gemini.svg" },
  openai: { name: "OpenAI", icon: "/assets/OpenAI.svg" },
  claude: { name: "Claude", icon: "/assets/Claude.svg" },
  deepseek: { name: "DeepSeek", icon: "/assets/deepseek.svg" },
  grok: { name: "xAI", icon: "/assets/GROK.svg" },
  glm: { name: "智谱", icon: "/assets/GLM.svg" },
  kimi: { name: "Moonshot", icon: "/assets/kimi.svg" },
  minimax: { name: "MiniMax", icon: "/assets/minimax-color.svg" },
  longcat: { name: "LongCat", icon: "/assets/longcat-bright.svg" },
  generic: { name: "AI", icon: "/assets/AI.svg" }
};
export const rawModelId = id => String(id || "").replace(/^(?:jianzhile|fuka):/, "");
export const canonicalModelId = id => rawModelId(id).replace(/^\[[^\]]+\]/, "").replace(/[\u2460-\u2473\u3251-\u325f\u32b1-\u32bf]+$/u, "").toLowerCase();
export function modelTraits(id) {
  const label = canonicalModelId(id).replace(/^deepseek:/, "");
  const traits = [
    [/^gemini-3\.8-flash(?:[-/:]|$)/, "轻快响应，适合日常问答与快速整理"],
    [/^gemini-2\.5-pro(?:[-/:]|$)/, "长上下文与多模态分析，适合复杂资料研读"],
    [/^gemini-3\.1-pro-preview(?:[-/:]|$)/, "强化复杂推理与工具协作，适合多步骤任务"],
    [/^claude-5-opus(?:[-/:]|$)/, "高强度推理与代码处理，适合复杂专业任务"],
    [/^deepseek-(?:v4(?:\.1)?-)?flash(?:-1017)?(?:[-/:]|$)/, "轻快响应与高吞吐，适合批量问答和快速梳理"],
    [/^deepseek-v4-pro(?:[-/:]|$)/, "偏重深度推理与代码分析，适合难题拆解"],
    [/^glm-5\.1(?:[-/:]|$)/, "擅长智能体编程，适合持续试验与迭代"],
    [/^glm-5\.2(?:[-/:]|$)/, "长上下文与任务执行兼顾，适合大型资料和代码"],
    [/^glm-5\.3(?:[-/:]|$)/, "强化复杂编程与漏洞分析，适合高难度工程任务"],
    [/(?:^|[-/:])(?:flash|haiku|mini|lite|turbo|instant)(?:[-/:]|$)/, "轻快响应，适合日常问答与快速整理"],
    [/opus|pro|reason|thinking|deepseek-r|(?:^|[/:])o[1-9](?:-|$)/, "注重推理与分析，适合复杂问题和长文梳理"],
    [/claude/, "注重文字表达，适合细致沟通与内容整理"],
    [/deepseek/, "侧重分析与代码理解，适合技术问题梳理"],
    [/glm/, "兼顾推理与执行，适合结构化任务处理"],
    [/grok/, "擅长快速交流与信息归纳，适合开放式问答"],
    [/kimi/, "长文本阅读与整理能力突出，适合资料汇总"],
    [/minimax|longcat/, "兼顾表达与内容生成，适合日常创作和问答"]
  ];
  return traits.find(([pattern]) => pattern.test(label))?.[1] || "兼顾问答与内容整理，适合日常咨询";
}
export function modelBrand(id, owner = "") {
  const label = canonicalModelId(id);
  const brand = /gemini/.test(label) ? "gemini" : /gpt|chatgpt|codex|(?:^|[\/:])o[1-9](?:-|$)/.test(label) ? "openai" : /claude/.test(label) ? "claude" : /deepseek/.test(label) ? "deepseek" : /grok/.test(label) ? "grok" : /glm/.test(label) ? "glm" : /kimi|moonshot/.test(label) ? "kimi" : /minimax/.test(label) ? "minimax" : /longcat/.test(label) ? "longcat" : /openai/i.test(owner) ? "openai" : "generic";
  return { brand, brandName: brands[brand].name, icon: brands[brand].icon };
}
export function displayModelName(id) {
  const raw = canonicalModelId(id).replace(/^deepseek:/, "");
  if (raw === "deepseek-flash-1017") return "DeepSeek V4.1 Flash";
  if (/^gpt-/i.test(raw)) return "GPT-" + raw.slice(4).split("-").map(word => word[0]?.toUpperCase() + word.slice(1)).join(" ");
  if (/^gemini-/i.test(raw)) return "Gemini " + raw.slice(7).split("-").map(word => word[0]?.toUpperCase() + word.slice(1)).join(" ");
  if (/^claude-/i.test(raw)) return "Claude " + raw.slice(7).split("-").map(word => word[0]?.toUpperCase() + word.slice(1)).join(" ");
  if (/^deepseek-/i.test(raw)) return "DeepSeek " + raw.slice(9).split("-").map(word => word[0]?.toUpperCase() + word.slice(1)).join(" ");
  if (/^glm-/i.test(raw)) return "GLM-" + raw.slice(4);
  return raw;
}
