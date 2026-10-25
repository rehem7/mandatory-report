import { api, esc, icon } from "/common.js";
import { loadAccount, bootstrapData } from "/account.js";
import { flushDrafts } from "/report-drafts.js";
import { installGuide } from "/help-tour.js";
const account = await loadAccount();
const avatars = ["/assets/visual/adult-avatar-1.png", "/assets/visual/adult-avatar-2.png", "/assets/visual/adult-avatar-3.png", "/assets/visual/adult-avatar-4.png", "/assets/visual/adult-avatar-5.png"];
// The owner contains a random guest/account ID. Hashing keeps its random
// portrait stable across navigation, reloads, and account sessions.
let avatarSeed = 2166136261;
for (const character of account.ownerId) avatarSeed = Math.imul(avatarSeed ^ character.charCodeAt(0), 16777619);
const avatar = avatars[(avatarSeed >>> 0) % avatars.length];
const glassIcon = (symbol, tone) => `<span class="nav-glass-icon" data-tone="${tone}" aria-hidden="true"><span class="nav-glass-plate"></span><span class="nav-glass-surface"></span><span class="nav-glass-face">${icon(symbol)}</span></span>`;
let cached;
export const catalog = () => cached ||= Promise.resolve(bootstrapData.catalog);
export const learnerId = () => account.profile.id;
export async function mountShell(active) {
  const data = await catalog();
  const who = account.profile;
  const nav = [
    ["ask", "智能问答", "spark", "/ask", "blue"], ["training", "情景实训", "review", "/training", "purple"],
    ["learning", "普法学习", "book", "/learning", "amber"], ["report", "报告表单", "file", "/report", "teal"],
    ["records", "我的记录", "clock", "/records", "pink"], ["ledger", "培训台账", "inbox", "/ledger", "green"]
  ];
  document.getElementById("public-sidebar").innerHTML = `<a class="brand" href="/ask"><span class="brand-mark"><img src="/assets/visual/guardian-mark.svg" width="27" height="27" alt=""></span><span>强制报告智能体<span class="brand-caption">保护，从看见开始</span></span></a><div class="public-nav-label">公众服务</div><nav class="public-nav" aria-label="公众页面">${nav.map(([id, label, symbol, url, tone]) => `<a href="${url}" ${id === active ? 'class="active" aria-current="page"' : ""}>${glassIcon(symbol, tone)}<span class="nav-label">${label}</span><span class="nav-next">↗</span></a>`).join("")}</nav><div class="public-sidebar-space"></div><div class="profile-card"><span class="profile-avatar"><img src="${avatar}" width="36" height="36" alt=""></span><div class="profile-info"><strong class="account-name" title="${esc(who.name)}">${esc(who.name)}</strong><p title="${esc(account.user?.identity || "访客使用")}">${esc(account.user?.identity || "访客使用")}</p>${account.authenticated ? `<button type="button" id="account-logout" class="text-button">退出登录 ↗</button>` : `<a class="account-login" href="/login?next=${encodeURIComponent(location.pathname)}">登录 / 注册 ↗</a>`}</div></div>`;
  document.getElementById("account-logout")?.addEventListener("click", async e => { const button = e.currentTarget; button.disabled = true; try { const leaving = []; window.dispatchEvent(new CustomEvent("account-leaving", { detail: { waitUntil: value => leaving.push(value) } })); await Promise.all(leaving); await flushDrafts(learnerId()); await api("/api/auth/logout", { method: "POST", body: "{}" }); location.href = "/login"; } catch (error) { button.disabled = false; document.getElementById("toast").textContent = error.message; document.getElementById("toast").hidden = false; } });
  const navElement = document.querySelector(".public-nav"), activeElement = navElement.querySelector(".active");
  if (activeElement && navElement.scrollWidth > navElement.clientWidth) navElement.scrollLeft = Math.max(0, activeElement.offsetLeft - navElement.offsetLeft - (navElement.clientWidth - activeElement.offsetWidth) / 2);
  const label = nav.find(n => n[0] === active)?.[1] || "公众服务";
  document.getElementById("public-topbar").innerHTML = `<div class="public-breadcrumb">公众服务 <span>/</span> <strong>${label}</strong></div><div class="public-topbar-right"><span class="badge subtle">${esc(account.user?.identity || "访客")}</span><span class="account-state"><i></i>${account.authenticated ? "已登录" : "无需登录即可使用"}</span></div>`;
  installGuide();
  return { ...data, who };
}
export function activateShell(active) {
  const links = [...document.querySelectorAll('.public-nav a')];
  for (const link of links) { const selected = link.pathname === '/' + active; link.classList.toggle('active', selected); if (selected) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); }
  const selected = links.find(link => link.pathname === '/' + active);
  document.querySelector('.public-breadcrumb strong').textContent = selected?.querySelector('.nav-label')?.textContent || '公众服务';
  const login = document.querySelector('.account-login'); if (login) login.href = '/login?next=' + encodeURIComponent('/' + active);
  const nav = document.querySelector('.public-nav');
  if (selected && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, selected.offsetLeft - nav.offsetLeft - (nav.clientWidth - selected.offsetWidth) / 2);
}
