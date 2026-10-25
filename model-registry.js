import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import { models as legacyModels } from "./content.js";
import { modelBrand, displayModelName, canonicalModelId, modelTraits } from "./public/model-brand.js";

const allowedSecrets = new Set(["FREE_API_KEY", "FREE_API_KEY_2", "FREE_API_KEY_3", "FREE_API_KEY_4", "DEEPSEEK_API_KEY"]);
const credentials = new Map();
function credential(name) {
  if (!allowedSecrets.has(name)) throw Error("无效的模型通道配置");
  if (credentials.has(name)) return credentials.get(name);
  let value = process.env[name]?.trim();
  if (!Object.hasOwn(process.env, name) && process.platform === "win32") {
    try {
      value = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$v=[Environment]::GetEnvironmentVariable('${name}','User'); if(!$v){$v=[Environment]::GetEnvironmentVariable('${name}','Machine')}; $v`], { encoding: "utf8", windowsHide: true, timeout: 5000 }).trim();
    } catch { /* Only availability, never a credential value, is exposed. */ }
  }
  credentials.set(name, value || ""); return value || "";
}
function apiBase(value) { const base = value.replace(/\/+$/, ""); return base.endsWith("/v1") ? base : base + "/v1"; }
const primary = apiBase(process.env.AI_BASE_URL || "https://api.fuka.win/v1");
const secondary = apiBase(process.env.AI_SECONDARY_BASE_URL || "https://jianzhile.vip/v1");
const third = apiBase(process.env.AI_KEY_3_BASE_URL || "https://api.fuka.win/v1");
const deepseek = apiBase(process.env.DEEPSEEK_API_BASE_URL || "https://api.deepseek.com");
const routes = new Map();
const identities = new Map();
const primaryKey = credential("FREE_API_KEY");
const deepseekKey = credential("DEEPSEEK_API_KEY");
const publicModels = legacyModels.map(model => {
  routes.set(model.id, [{ endpoint: primary, key: primaryKey, upstreamId: model.id }]);
  identities.set(canonicalModelId(model.id), model.id);
  return { ...model, ...modelBrand(model.id), provider: "api.fuka.win", available: !!primaryKey };
});
const channels = [];
const selectedClaude = new Set(["claude-5-opus"]);
const excludedModels = new Set([
  "claude-fable-5", "claude-fable-5.1", "claude-4.8-opus",
  "gemini-3-pro-preview", "gpt-5.5", "glm-5.1", "glm-5.3"
]);
const domesticBrands = new Set(["deepseek", "glm", "kimi", "minimax", "longcat"]);
const chatCapable = id => !/(?:embedding|rerank|whisper|tts|dall-e|image|imagen|veo|sora|stable-diffusion|flux)/i.test(id);
{
  let flashUpstreamId = "deepseek-flash-1017";
  if (deepseekKey && process.env.AI_CATALOG_ENABLED !== "0") {
    try {
      const response = await fetch(deepseek + "/models", { headers: { Authorization: `Bearer ${deepseekKey}` }, redirect: "error", signal: AbortSignal.timeout(15000) });
      const catalog = response.ok ? await response.json() : null;
      const ids = new Set((catalog?.data || []).map(model => model.id));
      if (!ids.has(flashUpstreamId) && ids.has("deepseek-flash")) flashUpstreamId = "deepseek-flash";
    } catch { /* Retain the requested dated ID when discovery is unavailable. */ }
  }
  for (const definition of [
    { upstreamId: flashUpstreamId, publicId: "deepseek-flash-1017", name: "DeepSeek V4.1 Flash" },
    { upstreamId: "deepseek-v4-pro", name: "DeepSeek V4 Pro" }
  ]) {
    const id = "deepseek:" + (definition.publicId || definition.upstreamId);
    routes.set(id, [{ endpoint: deepseek, key: deepseekKey, upstreamId: definition.upstreamId }]);
    identities.set(canonicalModelId(definition.upstreamId), id);
    publicModels.push({ id, name: definition.name, ...modelBrand(definition.upstreamId), provider: "api.deepseek.com", available: !!deepseekKey });
  }
  channels.push({ slot: "deepseek", configured: !!deepseekKey, state: deepseekKey ? "ready" : "missing", modelCount: 2 });
}
async function discover(slot) {
  const keyName = slot === 1 ? "FREE_API_KEY" : "FREE_API_KEY_" + slot;
  const key = credential(keyName);
  if (!key) return { slot, configured: false, state: "missing", models: [] };
  try {
    const configuredEndpoint = slot === 1 ? primary : slot === 3 ? third : secondary;
    let endpoint = configuredEndpoint, response = await fetch(endpoint + "/models", { headers: { Authorization: `Bearer ${key}` }, redirect: "error", signal: AbortSignal.timeout(15000) });
    if (response.status === 404) {
      endpoint = configuredEndpoint.replace(/\/v1$/, "");
      response = await fetch(endpoint + "/models", { headers: { Authorization: `Bearer ${key}` }, redirect: "error", signal: AbortSignal.timeout(15000) });
    }
    if (!response.ok) return { slot, configured: true, state: "error", status: response.status, models: [] };
    const body = await response.json();
    if (!Array.isArray(body.data)) return { slot, configured: true, state: "invalid", models: [] };
    const models = body.data.filter(m => typeof m?.id === "string" && m.id.length <= 200 && chatCapable(m.id));
    return { slot, configured: true, state: models.length ? "ready" : "empty", models, endpoint, key };
  } catch { return { slot, configured: true, state: "unreachable", models: [] }; }
}
// Tests explicitly disable discovery or point both gateways at local protocol servers.
if (process.env.AI_CATALOG_ENABLED !== "0") {
  const results = await Promise.all([1, 2, 3, 4].map(discover));
  const orderedResults = [...results].sort((a, b) => (a.slot === 1 ? 1 : 0) - (b.slot === 1 ? 1 : 0));
  for (const channel of orderedResults) {
    channels.push({ slot: channel.slot, configured: channel.configured, state: channel.state, modelCount: channel.models.length, ...(channel.status ? { status: channel.status } : {}) });
    for (const model of channel.models) {
      const identity = canonicalModelId(model.id);
      if (excludedModels.has(identity)) continue;
      if (modelBrand(model.id, model.owned_by).brand === "claude" && !selectedClaude.has(identity)) continue;
      // Key 3 adds only the selected Claude editions and domestic models.
      // Existing options may still use this channel as a fallback route.
      if (channel.slot === 3 && !identities.has(identity) &&
          !selectedClaude.has(identity) && !domesticBrands.has(modelBrand(model.id, model.owned_by).brand)) continue;
      const id = identities.get(identity) || (channel.slot === 3 ? "fuka:" : "jianzhile:") + model.id;
      const route = { endpoint: channel.endpoint, key: channel.key, upstreamId: model.id };
      if (routes.has(id)) { routes.get(id).push(route); publicModels.find(m => m.id === id).available = true; continue; }
      routes.set(id, [route]);
      identities.set(identity, id);
      publicModels.push({ id, name: displayModelName(model.id), ...modelBrand(model.id, model.owned_by), provider: channel.slot === 3 ? "api.fuka.win" : "jianzhile.vip", available: true });
    }
  }
}
export function modelRoutes(id) {
  const candidates = routes.get(id);
  if (!candidates) { const error = Error("请选择已配置的模型"); error.status = 400; throw error; }
  return candidates;
}
export const routeKey = route => crypto.createHash('sha256').update([route.endpoint, route.upstreamId, route.key].join('\n')).digest('hex');
export function verifiedImageRoutes(id, checks = []) { return modelRoutes(id).filter(route => checks.some(c => c.routeKey === routeKey(route) && c.status === 'verified' && Date.now() - Date.parse(c.checkedAt) < 30 * 86400000)).map(routeKey); }
export function modelConfig(checks = [], observations = []) {
  // Retain historical routes internally; only the two official models are selectable.
  const models = publicModels.filter(m => m.provider === "api.deepseek.com").map(m => {
    const verified = verifiedImageRoutes(m.id, checks), check = checks.filter(c => verified.length ? verified.includes(c.routeKey) : modelRoutes(m.id).some(r => routeKey(r) === c.routeKey)).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
    const observation = observations.find(o => o.modelId === m.id);
    const speedNote = observation ? `最近请求约${(observation.elapsedMs / 1000).toFixed(1)}秒（含工具，仅供参考）` : check?.elapsedMs ? `最近图片检测约${(check.elapsedMs / 1000).toFixed(1)}秒，仅供参考` : '速度暂无实测数据';
    return { ...m, available: !!deepseekKey, imageSupport: { status: verified.length ? 'verified' : 'unverified', checkedAt: check?.checkedAt || null }, description: modelTraits(m.id), speedNote };
  });
  return { configured: !!deepseekKey, models, defaultModel: "deepseek:deepseek-flash-1017", provider: "DeepSeek 官方服务", channels, knowledgeBase: false, capabilities: { search: { enabled: true, strength: "medium", mode: "application-tool", maxResults: 5 }, images: true, memory: true, reportDrafts: true } };
}
