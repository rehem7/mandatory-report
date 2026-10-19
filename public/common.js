import { iconPaths } from "/icons.js";
export const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const time = v => v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "—";
let recordOwner;
export const setRecordOwner = owner => { recordOwner = owner; };
export async function api(url, options = {}, role = "公安") { const r = await fetch(url, { ...options, headers: { "Content-Type": "application/json", "X-Demo-Role": encodeURIComponent(role), ...(recordOwner ? { "X-Record-Owner": recordOwner } : {}), ...options.headers } }); const data = await r.json(); if (!r.ok) throw Object.assign(Error(data.error || "请求失败"), { status: r.status }); return data; }
export const post = (url, data, role) => api(url, { method: "POST", body: JSON.stringify(data) }, role);
export function toast(message) { const t = document.getElementById("toast"); t.textContent = message; t.hidden = false; clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => t.hidden = true, 5000); }
export function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.file}</svg>`;
}
export function openDialog(dialog) {
  if (!dialog.open) { dialog.showModal(); document.body.style.overflow = "hidden"; }
}
export function bindDialog(dialog) {
  dialog.addEventListener("close", () => { document.body.style.overflow = ""; });
}
