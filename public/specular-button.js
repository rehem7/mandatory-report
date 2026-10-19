// Native lifecycle adapter for React Bits Specular Button by David Haz.
// Source and retained license: /credits, /assets/visual/licenses/react-bits.txt.
import { PAD, UNIFORMS, loopPosition, rimPoint, link, wrap, clamp } from "/specular-light.js";

export function mountSpecularButton(button) {
  const canvas = button.querySelector(".specular-button__light");
  let gl;
  try { gl = canvas?.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false }); } catch {}
  const program = gl && link(gl);
  if (!program) { button.dataset.specular = "fallback"; if (canvas) canvas.hidden = true; return; }
  const uniforms = Object.fromEntries(UNIFORMS.map(name => [name, gl.getUniformLocation(program, name)]));
  const buffer = gl.createBuffer(), vao = gl.createVertexArray();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const view = { width: 1, height: 1, ratio: 1 };
  const pointer = { x: 0, y: 0, known: false };
  const state = { spot: 0, level: .35, press: 0, ready: false };
  let raf = 0, last = 0, visible = false, leaving = false, lost = false;
  const radius = () => Math.min(11, view.width / 2, view.height / 2);
  const restSpot = () => {
    const r = radius(), inset = r * (1 - Math.SQRT1_2);
    return loopPosition(inset - view.width / 2, view.height / 2 - inset, view.width / 2, view.height / 2, r);
  };
  const aim = () => {
    if (!pointer.known || button.disabled || motion.matches) return null;
    const rect = button.getBoundingClientRect(), scale = rect.width / view.width || 1;
    const halfX = view.width / 2, halfY = view.height / 2;
    const x = (pointer.x - rect.left - rect.width / 2) / scale, y = (rect.top + rect.height / 2 - pointer.y) / scale;
    const distance = Math.hypot(Math.max(Math.abs(x) - halfX, 0), Math.max(Math.abs(y) - halfY, 0));
    const t = clamp(1 - distance / 250, 0, 1), near = t * t * (3 - 2 * t);
    const nearest = loopPosition(x, y, halfX, halfY, radius());
    if (distance > 0) return { spot: nearest, near };
    const depth = clamp(Math.min(halfX - Math.abs(x), halfY - Math.abs(y)) / (halfY * .8), 0, 1);
    const sway = restSpot() - (x / halfX) * .06 - (y / halfY) * .02, offset = sway - nearest - Math.round(sway - nearest);
    return { spot: wrap(nearest + offset * depth * depth * (3 - 2 * depth)), near };
  };
  const draw = () => {
    const { width, height } = view, sx = canvas.width / (width + PAD * 2), sy = canvas.height / (height + PAD * 2);
    gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(program);
    gl.uniform2f(uniforms.uCenter, (PAD + width / 2) * sx, (PAD + height / 2) * sy);
    gl.uniform2f(uniforms.uHalf, width / 2 * sx, height / 2 * sy);
    gl.uniform1f(uniforms.uRadius, radius() * sx); gl.uniform1f(uniforms.uPx, view.ratio);
    const [rimX, rimY] = rimPoint(state.spot, width / 2, height / 2, radius());
    const pull = 1 - Math.min(.35 * height / 2, Math.hypot(rimX, rimY)) / Math.max(Math.hypot(rimX, rimY), .0001);
    gl.uniform1f(uniforms.uSpot, state.spot); gl.uniform2f(uniforms.uEntry, rimX * pull * sx, rimY * pull * sy);
    gl.uniform3fv(uniforms.uLineColor, [1, 1, .96]); gl.uniform3fv(uniforms.uBaseColor, [.39, .55, .27]);
    gl.uniform1f(uniforms.uIntensity, 1.25 * (state.level + state.press * .8));
    gl.uniform2f(uniforms.uWindow, 10 / 360 + state.press * .06, 34 / 360 + .0001);
    gl.uniform1f(uniforms.uThickness, 1.2); gl.uniform1f(uniforms.uGlow, 1);
    gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
  };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; last = 0; button.dataset.specularState = "idle"; };
  const frame = now => {
    raf = 0;
    if (!visible || document.hidden || leaving || lost) { stop(); return; }
    const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60; last = now;
    const target = aim(), steering = !!target && target.near > 0;
    if (!state.ready) { state.spot = restSpot(); state.ready = true; }
    const focused = button.matches(":focus-visible"), level = button.disabled ? 0 : .35 + .65 * (focused ? 1 : target?.near || 0);
    let diff = (steering ? target.spot : restSpot()) - state.spot; diff -= Math.round(diff);
    if (motion.matches || button.disabled) { state.spot = restSpot(); state.level = level; state.press = 0; diff = 0; }
    else { state.spot = wrap(state.spot + diff * (1 - Math.exp(-dt * 8))); state.level += (level - state.level) * (1 - Math.exp(-dt * 7)); state.press *= Math.exp(-dt * 5); }
    draw();
    const settling = Math.abs(diff) > .0002 || Math.abs(level - state.level) > .001 || state.press > .002;
    if (settling) raf = requestAnimationFrame(frame);
    else { last = 0; button.dataset.specularState = "idle"; }
  };
  const wake = () => {
    if (!raf && visible && !document.hidden && !leaving && !lost) { button.dataset.specularState = "moving"; raf = requestAnimationFrame(frame); }
  };
  const measure = () => {
    visible = button.offsetWidth > 0 && button.offsetHeight > 0;
    if (!visible) { stop(); return; }
    view.width = button.offsetWidth; view.height = button.offsetHeight; view.ratio = Math.min(devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round((view.width + PAD * 2) * view.ratio)); canvas.height = Math.max(1, Math.round((view.height + PAD * 2) * view.ratio)); wake();
  };
  const move = event => { if (button.disabled || motion.matches || !visible) return; pointer.x = event.clientX; pointer.y = event.clientY; pointer.known = true; wake(); };
  const release = event => { if (event.pointerType !== "mouse") { pointer.known = false; wake(); } };
  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerup", release, { passive: true }); window.addEventListener("pointercancel", release, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { pointer.known = false; wake(); });
  button.addEventListener("pointerdown", event => { if (button.disabled || motion.matches) return; pointer.x = event.clientX; pointer.y = event.clientY; pointer.known = true; state.press = 1; wake(); });
  button.addEventListener("keydown", event => { if (!button.disabled && !motion.matches && ["Enter", " "].includes(event.key)) { state.press = 1; wake(); } });
  button.addEventListener("focus", wake); button.addEventListener("blur", wake);
  motion.addEventListener("change", () => { pointer.known = false; state.press = 0; wake(); });
  new MutationObserver(() => { if (button.disabled) { pointer.known = false; state.press = 0; } wake(); }).observe(button, { attributes: true, attributeFilter: ["disabled"] });
  new ResizeObserver(measure).observe(button);
  new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting) && button.offsetWidth > 0; if (visible) wake(); else stop(); }).observe(button);
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : wake());
  window.addEventListener("pagehide", () => { leaving = true; stop(); }); window.addEventListener("pageshow", () => { leaving = false; measure(); });
  canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); lost = true; stop(); canvas.hidden = true; button.dataset.specular = "fallback"; });
  button.dataset.specular = "ready"; measure();
}
