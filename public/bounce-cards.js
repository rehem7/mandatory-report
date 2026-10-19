// Bounce Cards adapted from React Bits by David Haz, MIT + Commons Clause.
// https://github.com/DavidHDev/react-bits/blob/main/src/content/Components/BounceCards/BounceCards.jsx
// Retains the spring integration, staggered entrance and hover fan interaction.
const pattern = [1, .5, -.3, -1, .2];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const step = (value, velocity, target, stiffness, damping, dt) => {
  const next = velocity + ((target - value) * stiffness - velocity * damping) * dt;
  return [value + next * dt, next];
};

export function mountBounceCards(root) {
  if (!root) return;
  const cards = [...root.querySelectorAll(".bounce-card")];
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let raf = 0, last = 0, time = 0, hovered = -1, visible = false, imagesReady = false, imagesRequested = false, leaving = false, played = false, size = 0;
  let slots = [], bodies = [];
  const draw = (index, body) => {
    const card = cards[index];
    card.style.transform = `translate(-50%,-50%) translate3d(${body.x.toFixed(2)}px,${body.y.toFixed(2)}px,0) rotate(${body.rotate.toFixed(3)}deg) scale(${Math.max(0, body.scale).toFixed(4)})`;
    card.style.zIndex = index === hovered ? String(cards.length + 1) : String(index + 1);
    card.toggleAttribute("data-active", index === hovered);
  };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const settle = () => {
    stop(); hovered = -1;
    bodies = slots.map(slot => ({ ...slot, scale: 1, vx: 0, vy: 0, vr: 0, vs: 0 }));
    bodies.forEach((body, index) => draw(index, body)); root.dataset.motionState = "idle";
  };
  const frame = now => {
    raf = 0;
    if (!visible || document.hidden || leaving || !root.isConnected) return;
    const dt = clamp((now - last) / 1000, 1 / 240, 1 / 30); last = now; time += dt;
    const substeps = Math.ceil(dt / (1 / 240)), h = dt / substeps;
    const popDamping = 2 * (1 - .85 * .6) * Math.sqrt(170), moveDamping = 2 * .72 * Math.sqrt(210);
    let moving = 0;
    bodies.forEach((body, index) => {
      const slot = slots[index], appeared = time >= .5 + index * .06;
      let targetX = slot.x, targetY = slot.y, targetRotate = slot.rotate, targetScale = appeared ? 1 : 0;
      if (hovered >= 0 && appeared) {
        if (index === hovered) { targetY -= size * .04; targetRotate = 0; targetScale = 1.06; }
        else targetX += Math.sign(index - hovered) * size * .25;
      }
      for (let n = 0; n < substeps; n++) {
        [body.x, body.vx] = step(body.x, body.vx, targetX, 210, moveDamping, h);
        [body.y, body.vy] = step(body.y, body.vy, targetY, 210, moveDamping, h);
        [body.rotate, body.vr] = step(body.rotate, body.vr, targetRotate, 210, moveDamping, h);
        [body.scale, body.vs] = step(body.scale, body.vs, targetScale, 170, popDamping, h);
      }
      moving += Math.abs(body.vx) + Math.abs(body.vy) + Math.abs(body.vr) + Math.abs(body.vs) * 100 + Math.abs(targetX - body.x) + Math.abs(targetY - body.y) + Math.abs(targetRotate - body.rotate) + Math.abs(targetScale - body.scale) * 100 + (appeared ? 0 : 1);
      draw(index, body);
    });
    if (moving > .02) raf = requestAnimationFrame(frame);
    else root.dataset.motionState = "idle";
  };
  const wake = () => {
    if (raf || !visible || !imagesReady || document.hidden || leaving) return;
    if (motion.matches) { settle(); return; }
    root.dataset.motionState = "moving"; last = performance.now(); raf = requestAnimationFrame(frame);
  };
  const measure = () => {
    const rect = root.getBoundingClientRect(); visible = rect.width > 0 && rect.height > 0;
    if (!visible) { stop(); root.dataset.motionState = "hidden"; return; }
    if (!imagesRequested) {
      imagesRequested = true;
      const images = cards.map(card => card.querySelector("img"));
      images.forEach(image => { image.loading = "eager"; });
      Promise.allSettled(images.map(image => image.decode())).then(() => { imagesReady = true; wake(); });
    }
    const nextSize = parseFloat(getComputedStyle(cards[0]).width);
    if (nextSize !== size || !bodies.length) {
      size = nextSize; const middle = (cards.length - 1) / 2;
      slots = cards.map((_, index) => ({ x: (index - middle) * size * .32, y: 0, rotate: 10 * pattern[index % pattern.length] }));
      bodies = slots.map(slot => ({ ...slot, scale: played || motion.matches ? 1 : 0, vx: 0, vy: 0, vr: 0, vs: 0 }));
      bodies.forEach((body, index) => draw(index, body));
    }
    if (!played) { time = 0; played = true; }
    wake();
  };
  root.addEventListener("pointermove", event => {
    if (motion.matches || event.pointerType === "touch") return;
    const rect = root.getBoundingClientRect(), x = event.clientX - rect.left - rect.width / 2, y = event.clientY - rect.top - rect.height / 2;
    let closest = -1, distance = Infinity;
    slots.forEach((slot, index) => { const gap = Math.abs(x - slot.x); if (gap < distance) { distance = gap; closest = index; } });
    if (Math.abs(y) > size / 2 + 12 || distance > size / 2 + 12) closest = -1;
    if (closest !== hovered) { hovered = closest; wake(); }
  });
  root.addEventListener("pointerleave", () => { if (hovered !== -1) { hovered = -1; wake(); } });
  motion.addEventListener("change", () => { if (visible) settle(); });
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : wake());
  window.addEventListener("pagehide", () => { leaving = true; stop(); });
  window.addEventListener("pageshow", () => { leaving = false; wake(); });
  new ResizeObserver(measure).observe(root);
}
