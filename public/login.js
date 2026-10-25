import { post } from "/common.js";
const $ = id => document.getElementById(id);
// Keep the form usable immediately; decorate after the initial page has painted.
const enhance = () => {
  Promise.allSettled([
    import("/stroke-text.js").then(({ mountStrokeText }) => mountStrokeText($("login-title"))),
    import("/bounce-cards.js").then(({ mountBounceCards }) => mountBounceCards($("login-bounce-cards"))),
    import("/specular-button.js").then(({ mountSpecularButton }) => document.querySelectorAll(".auth-submit.specular-button").forEach(mountSpecularButton))
  ]);
};
requestAnimationFrame(() => requestAnimationFrame(() => {
  if ("requestIdleCallback" in window) window.requestIdleCallback(enhance, { timeout: 1000 });
  else setTimeout(enhance, 0);
}));
let pending = false;
function selectTab(register) {
  if (pending) return;
  document.querySelector(".login-card").dataset.mode = register ? "register" : "login";
  $("login-form").hidden = register; $("register-form").hidden = !register;
  $("login-tab").setAttribute("aria-selected", String(!register)); $("register-tab").setAttribute("aria-selected", String(register));
  $("login-tab").tabIndex = register ? -1 : 0; $("register-tab").tabIndex = register ? 0 : -1;
  $("auth-title").textContent = register ? "从这里开始" : "欢迎回来";
  $("auth-description").textContent = register ? "创建账号，让记录与保护行动持续相连。" : "登录后，继续您的对话与报告记录。";
  $("auth-error").hidden = true;
}
$("login-tab").onclick = () => selectTab(false); $("register-tab").onclick = () => selectTab(true);
for (const tab of [$("login-tab"), $("register-tab")]) tab.onkeydown = e => { if (["ArrowLeft", "ArrowRight"].includes(e.key)) { e.preventDefault(); const register = tab.id === "login-tab"; selectTab(register); $(register ? "register-tab" : "login-tab").focus(); } };
$("register-identity").onchange = () => { const other = $("register-identity").value === "其他"; $("register-other-field").hidden = !other; $("register-other").required = other; $("register-identity-details").classList.toggle("has-other", other); };
$("toggle-password").onclick = () => { const show = $("login-password").type === "password"; $("login-password").type = show ? "text" : "password"; $("toggle-password").textContent = show ? "隐藏" : "显示"; $("toggle-password").setAttribute("aria-label", show ? "隐藏密码" : "显示密码"); };
for (const kind of ["login", "register"]) $(kind + "-form").onsubmit = async e => {
  e.preventDefault(); if (pending) return;
  const form = e.currentTarget, button = form.querySelector("button[type=submit]"), label = button.querySelector(".auth-submit-text"), originalLabel = label.textContent;
  pending = true; button.disabled = true; label.textContent = kind === "login" ? "正在登录…" : "正在注册…"; $("auth-error").hidden = true;
  try { await post("/api/auth/" + kind, Object.fromEntries(new FormData(form))); const next = new URLSearchParams(location.search).get("next"); location.href = /^\/(ask|training|learning|report|records|ledger)(?:[?]|$)/.test(next || "") ? next : "/ask"; }
  catch (error) { $("auth-error").textContent = error.message; $("auth-error").hidden = false; }
  finally { pending = false; button.disabled = false; label.textContent = originalLabel; }
};
if (new URLSearchParams(location.search).get("mode") === "register") selectTab(true);
