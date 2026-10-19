import { api, setRecordOwner } from "/common.js";
let loading;
export let accountState;
export let bootstrapData;
export function loadAccount() { return loading ||= api("/api/portal/bootstrap").then(value => { bootstrapData = value; setRecordOwner(value.account.ownerId); return accountState = value.account; }).catch(error => { loading = null; throw error; }); }
export const storageOwner = () => accountState.ownerId;
window.addEventListener("pageshow", event => { if (event.persisted) location.reload(); });
document.addEventListener("visibilitychange", async () => { if (document.hidden || !accountState) return; try { const state = await api("/api/auth/me"); if (state.ownerId !== accountState.ownerId) location.reload(); } catch {} });
