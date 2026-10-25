import { api, esc, time, post, toast, icon, openDialog, bindDialog } from "/common.js";
import { mountShell, learnerId } from "/shell.js";
import { activeDraft, getDraft, saveDraft, removeDraft, clearActiveDraft, storeAttachments, loadAttachments, syncDrafts, flushDrafts } from "/report-drafts.js";
import { accountState } from "/account.js";
import { art, emptyArtwork, installVisuals } from "/visual.js";
import { ATTACHMENT_ACCEPT, ATTACHMENT_HINT, attachmentMime, validateFiles, fileToAttachment } from "/attachment-policy.js";
import { regionPicker } from "/region-picker.js";

const $ = id => document.getElementById(id);
const form = $("report-form");
const locationPicker = regionPicker(form);
installVisuals(document.querySelector(".report-container"));
document.getElementById("report-support-art").innerHTML = art('mascot-protect', '', true);
const identities = ["未成年本人", "家长/监护人", "教师/教育工作者", "医护人员", "社区工作人员", "其他"];
const types = ["身体虐待", "性侵害", "情感/精神虐待", "忽视/疏于照料", "家庭暴力", "暴力伤害", "拐卖", "遗弃", "组织乞讨", "自杀/自残", "其他"];
const owner = learnerId();
let draft = null, ready = false, restoring = false, attachmentWork = Promise.resolve(), attachmentFailed = false, scrollTimer, selectedFiles = [];
$("identities").innerHTML = identities.map(x => `<label><input type="radio" name="identity" value="${x}" required><span>${x}</span></label>`).join("");
$("types").innerHTML = types.map(x => `<label><input type="checkbox" name="types" value="${x}"><span>${x}</span></label>`).join("");
bindDialog($("confirm"));

function payload() {
  const f = new FormData(form);
  return {
    identity: accountState.authenticated ? accountState.user.identity : f.get("identity"), types: f.getAll("types"), region: f.get("region"), regionCodes: locationPicker.codes, regionLegacy: locationPicker.legacyText, address: f.get("address"),
    occurredAt: f.get("occurredAt"), age: f.get("age"), description: f.get("description"),
    identityOther: accountState.authenticated ? accountState.user.identityOther : $("identity-other").value, typeOther: $("type-other").value,
    reporter: { name: f.get("reporterName"), organization: f.get("organization"), phone: f.get("phone") }
  };
}

function persistDraft(contentChanged = true) {
  if (!ready || restoring) return;
  const fields = payload();
  const hasContent = !accountState.authenticated && fields.identity || fields.types.length || fields.regionCodes.province || [fields.region, fields.regionLegacy, fields.address, fields.occurredAt, fields.age, fields.description, fields.typeOther, ...Object.values(fields.reporter)].some(v => v?.trim()) || selectedFiles.length;
  if (!draft && !hasContent) return;
  draft = { ...draft, id: draft?.id || crypto.randomUUID(), fields, attachmentName: selectedFiles[0]?.name || "", attachmentNames: selectedFiles.map(file => file.name), scrollY: window.scrollY, updatedAt: contentChanged || !draft ? new Date().toISOString() : draft.updatedAt };
  try { saveDraft(owner, draft); $("draft-status").textContent = attachmentFailed ? "文字已保存；附件未保存，请重新选择" : draft._attachmentsDirty ? "文字已保存；附件正在保存，请稍候…" : "草稿已自动保存 · 可从“我的记录”继续填写"; }
  catch { $("draft-status").textContent = "草稿保存失败，请检查浏览器存储空间后重试"; }
}
function saveAttachment() {
  persistDraft();
  if (!draft) return;
  const id = draft.id, files = [...selectedFiles], version = crypto.randomUUID();
  draft._attachmentsDirty = true; draft._attachmentVersion = version; saveDraft(owner, draft);
  $("draft-status").textContent = "文字已保存；附件正在保存，请稍候…";
  attachmentWork = attachmentWork.then(() => storeAttachments(owner, id, files, version)).then(() => { if (draft?.id === id) { if (draft._attachmentVersion === version) draft._attachmentsDirty = false; attachmentFailed = false; persistDraft(false); } }).catch(() => { attachmentFailed = true; $("draft-status").textContent = "文字已保存；附件未保存，请重新选择或直接提交"; });
}
async function restoreDraft() {
  const query = new URLSearchParams(location.search);
  try {
    draft = query.has("new") ? null : query.has("draft") ? getDraft(owner, query.get("draft")) : activeDraft(owner);
    if (query.has("new")) { clearActiveDraft(owner); history.replaceState(null, "", "/report"); }
    if (!draft) { if (query.has("draft")) toast("草稿已删除或不属于当前身份"); return; }
    const b = draft.fields;
    form.elements.identity.value = b.identity || "";
    // Keep older combined event types editable when restoring existing drafts.
    for (const type of b.types || []) if (!types.includes(type)) $("types").insertAdjacentHTML("beforeend", `<label><input type="checkbox" name="types" value="${esc(type)}"><span>${esc(type)}</span></label>`);
    for (const c of form.querySelectorAll('[name="types"]')) c.checked = (b.types || []).includes(c.value);
    locationPicker.restore(b);
    for (const key of ["address", "occurredAt", "age", "description"]) form.elements[key].value = b[key] || "";
    $("identity-other").value = b.identityOther || ""; $("type-other").value = b.typeOther || "";
    for (const [name, key] of [["reporterName", "name"], ["organization", "organization"], ["phone", "phone"]]) form.elements[name].value = b.reporter?.[key] || "";
    saveDraft(owner, draft);
    $("draft-status").textContent = draft.origin === "chat" ? "已从智能问答预填 · 请核对已有内容并补充空白信息，再确认提交" : "已恢复草稿，继续填写时会自动保存";
    const attachmentNames = draft.attachmentNames || (draft.attachmentName ? [draft.attachmentName] : []);
    if (attachmentNames.length) {
      try { const files = await loadAttachments(owner, draft.id); if (files.length !== attachmentNames.length) throw Error(); validateFiles(files); selectedFiles = files; }
      catch { attachmentFailed = true; $("draft-status").textContent = `文字已恢复；${attachmentNames.length}个附件需重新选择：${attachmentNames.join('、')}`; }
    }
    updateForm(); updateAttachment();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.scrollTo({ top: draft.scrollY || 0, behavior: "instant" });
  } catch { $("draft-status").textContent = "无法恢复草稿，请检查浏览器存储设置"; }
}
form.addEventListener("input", () => persistDraft());
form.addEventListener("change", () => persistDraft());
window.addEventListener("scroll", () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(() => persistDraft(false), 150); }, { passive: true });
window.addEventListener("pagehide", () => { persistDraft(false); flushDrafts(owner, true).catch(() => {}); });
document.addEventListener("visibilitychange", () => { if (document.hidden) persistDraft(false); });
// Save position before navigation or identity switching changes the active learner.
async function flushReport() { persistDraft(false); await attachmentWork; if (attachmentFailed && selectedFiles.length) throw Error('附件尚未保存，请重新选择或先提交当前报告'); await flushDrafts(owner); }
document.addEventListener("click", async e => { const link = e.target.closest("a[href]"); if (!link || link.origin !== location.origin || link.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return; e.preventDefault(); try { await flushReport(); location.href = link.href; } catch (error) { toast(error.message); } }, true);
window.addEventListener("account-leaving", event => { persistDraft(false); event.detail?.waitUntil?.(flushReport()); });
window.addEventListener("draft-sync-error", e => { $("draft-status").textContent = e.detail || "草稿已保存在本机；账号同步失败，请稍后重试"; });
$("new-report").onclick = async () => { try { await flushReport(); location.href = "/report?new=1"; } catch (error) { toast(error.message); } };

function lockIdentity() {
  if (!accountState.authenticated) return;
  $("identities").innerHTML = `<label class="locked-identity"><input type="radio" name="identity" value="${esc(accountState.user.identity)}" checked disabled><span>${esc(accountState.user.identity)}</span><small>已使用注册身份 · 不可修改</small></label>`;
  $("identity-other").value = accountState.user.identityOther; $("identity-other").readOnly = true;
}

function updateForm() {
  const b = payload();
  $("identity-other").hidden = b.identity !== "其他";
  $("identity-other").required = b.identity === "其他";
  $("type-other").hidden = !b.types.includes("其他");
  $("type-other").required = b.types.includes("其他");
  const complete = [b.identity && (b.identity !== "其他" || b.identityOther.trim()), b.types.length && (!b.types.includes("其他") || b.typeOther.trim()), b.region.trim(), b.address.trim(), b.occurredAt, b.age, b.description.trim()].filter(Boolean).length;
  $("progress-bar").style.width = `${complete / 7 * 100}%`;
  $("progress-text").textContent = `已完成 ${complete} / 7 项必填信息`;
  $("report-mode").textContent = b.reporter.name.trim() || b.reporter.phone.trim() ? "已提供联系信息" : "匿名报告";
}
form.addEventListener("input", updateForm);
form.addEventListener("change", updateForm);

function updateAttachment() {
  $("attachment-label").textContent = selectedFiles.length ? `已添加${selectedFiles.length}个文件，点击继续添加` : "点击添加证据文件";
  $("attachment-hint").textContent = selectedFiles.length ? `合计 ${(selectedFiles.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2)} MB · ${ATTACHMENT_HINT}` : ATTACHMENT_HINT;
  $("remove-attachment").hidden = !selectedFiles.length;
  $("attachment-list").innerHTML = selectedFiles.map((file, index) => { const mime = attachmentMime(file); const type = mime.startsWith('audio/') ? '录音' : mime.startsWith('video/') ? '视频' : mime.startsWith('image/') ? '照片' : '文档'; return `<li><span class="attachment-file">${icon('file')}<span><strong>${esc(file.name)}</strong><small>${type} · ${(file.size / 1024 / 1024).toFixed(2)} MB</small></span></span><button type="button" class="text-button mini" data-remove-attachment="${index}" aria-label="移除${esc(file.name)}">移除</button></li>`; }).join('');
}
$("attachment").accept = ATTACHMENT_ACCEPT;
$("attachment").addEventListener("change", () => {
  const next = [...selectedFiles];
  for (const file of $("attachment").files) if (!next.some(old => old.name === file.name && old.size === file.size && old.lastModified === file.lastModified && old.type === file.type)) next.push(file);
  $("attachment").value = "";
  try { validateFiles(next); } catch (error) { return toast(error.message); }
  selectedFiles = next;
  updateAttachment();
  saveAttachment();
});
$("attachment-list").onclick = event => { const button = event.target.closest('[data-remove-attachment]'); if (!button) return; selectedFiles.splice(Number(button.dataset.removeAttachment), 1); updateAttachment(); saveAttachment(); };
$("remove-attachment").onclick = () => { selectedFiles = []; $("attachment").value = ""; updateAttachment(); saveAttachment(); };

form.addEventListener("submit", e => {
  e.preventDefault();
  const b = payload();
  if (!b.types.length) { $("types").querySelector("input").focus(); return toast("请至少选择一种事件类型"); }
  if ((b.identity === "其他" && !b.identityOther.trim()) || (b.types.includes("其他") && !b.typeOther.trim())) return toast("请补充其他选项说明");
  try { validateFiles(selectedFiles); } catch (error) { return toast(error.message); }
  $("consent").checked = false;
  openDialog($("confirm"));
});
$("cancel").onclick = () => $("confirm").close();
$("send").onclick = async () => {
  if (!$("consent").checked) { $("consent").focus(); return toast("请先勾选阅读并知晓提示"); }
  $("send").disabled = true;
  $("send").textContent = "正在提交…";
  try {
    await attachmentWork;
    const b = payload(); b.consent = true;
    validateFiles(selectedFiles);
    b.attachments = await Promise.all(selectedFiles.map(fileToAttachment));
    const r = await post("/api/reports", b);
    let stored = true;
    try { const key = "reportReceipts:v2:" + owner; const history = JSON.parse(localStorage.getItem(key) || "[]"); history.unshift(r); localStorage.setItem(key, JSON.stringify(history)); } catch { stored = false; }
    $("confirm").close();
    $("receipt").hidden = false;
    $("receipt").innerHTML = `<div class="receipt-top"><span class="receipt-check animated-check" aria-hidden="true">${icon("check")}</span><h2>已提交至接收工作台</h2></div><p>线索编号 <strong>${esc(r.id)}</strong> <span class="badge">${esc(r.status)}</span></p><p>系统接收时间：${time(r.receivedAt)}</p><div class="soft-callout reporter-privacy"><strong>报告者个人信息保密</strong><p>您提供的姓名、工作单位、联系电话等个人信息仅供内部核实与联系使用，不对外公开。</p></div><p class="muted">${accountState.authenticated ? "上报记录已保存到您的账号，可在我的记录查看。" : stored ? "查询凭证已保存在当前浏览器。" : "请另行保存查询凭证：" + esc(r.receipt)}</p><a class="text-link" href="/records">查看我的记录 ↗</a>`;
    ready = false;
    if (draft) { try { await removeDraft(owner, draft.id); } catch { toast("报告已提交，草稿清理未完成，请在我的记录中删除"); } }
    draft = null; attachmentFailed = false; selectedFiles = [];
    history.replaceState(null, "", "/report");
    $("draft-status").textContent = "草稿自动保存 · 未完成线索可在“我的记录”继续填写";
    form.reset(); locationPicker.reset(); lockIdentity(); updateForm(); updateAttachment();
    ready = true;
    $("receipt").scrollIntoView({ behavior: "smooth", block: "start" });
    await records();
  } catch (e) { toast(e.message); }
  finally { $("send").disabled = false; $("send").innerHTML = '确认提交 <span aria-hidden="true">→</span>'; }
};

async function records() {
  const history = await api("/api/my-reports");
  if (!history.length) {
    $("records").innerHTML = emptyArtwork("还没有上报记录", "提交线索后，您可以在这里查看处理进度。");
    return;
  }
  const results = history;
  $("records").innerHTML = results.map(r => `<div class="record record-row"><div><strong>${esc(r.id)}</strong><div class="muted">提交于 ${time(r.receivedAt)}</div></div><span class="badge">${esc(r.status)}</span></div>`).join("");
}
$("refresh-records").onclick = async () => {
  $("refresh-records").disabled = true;
  try { await records(); } finally { $("refresh-records").disabled = false; }
};

restoring = true;
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
try { await mountShell("report"); lockIdentity(); try { await syncDrafts(owner); } catch (e) { toast(e.message); } await restoreDraft(); } catch (e) { toast(e.message); }
finally { restoring = false; ready = true; }
updateForm(); records();
if (draft?._attachmentsDirty && !attachmentFailed) saveAttachment();
