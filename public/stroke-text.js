// Stroke Text adapted for this native app from React Bits by David Haz.
// Source: https://github.com/DavidHDev/react-bits/blob/main/src/content/TextAnimations/StrokeText/StrokeText.jsx
// License: /assets/visual/licenses/react-bits.txt (MIT + Commons Clause).
// Retains the demo's SVG glyph draw, left wipe, timing and hover redraw.
import { titleArtwork } from "/login-title-paths.js";
const svgNS = "http://www.w3.org/2000/svg";
const defaults = Object.freeze({ strokeWidth: 1.4, drawDuration: 1600, fillDelay: 200, stagger: 50 });
const element = (name, attributes = {}) => {
  const node = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};

export function mountStrokeText(root) {
  if (!root || !Element.prototype.animate) return;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const groups = [], strokes = [];
  let animations = [], running = false, ready = false;
  const cancel = () => { for (const animation of animations) animation.cancel(); animations = []; };
  const settled = () => {
    cancel(); running = false;
    for (const { node } of strokes) { node.style.strokeDasharray = "none"; node.style.strokeDashoffset = "0"; node.style.strokeOpacity = "1"; }
    for (const { rect, box } of groups) rect.style.width = box.width + "px";
  };
  const play = (redraw = false) => {
    if (motion.matches || running || !ready) return;
    cancel(); running = true;
    for (const { node, index } of strokes) {
      // Normalize each actual contour, rather than guessing a dash length per letter.
      node.style.strokeDasharray = "1 1";
      animations.push(node.animate(
        [{ strokeDashoffset: "1", strokeOpacity: 1 }, { strokeDashoffset: "0", strokeOpacity: 1 }],
        { duration: defaults.drawDuration * (redraw ? .8 : 1), delay: index * defaults.stagger, easing: "cubic-bezier(.215,.61,.355,1)", fill: "both" }
      ));
    }
    if (!redraw) {
      const totalWidth = groups.reduce((sum, group) => sum + group.box.width, 0);
      let offset = 0;
      for (const { rect, box } of groups) {
        // A single directional wipe across the complete, continuously spaced sentence.
        const frames = Array.from({ length: 41 }, (_, index) => {
          const t = index / 40, eased = t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
          return { offset: t, width: Math.max(0, Math.min(box.width, eased * totalWidth - offset)) + "px" };
        });
        animations.push(rect.animate(frames, {
          duration: defaults.drawDuration * .5, delay: defaults.drawDuration + defaults.fillDelay,
          easing: "linear", fill: "both"
        }));
        offset += box.width;
      }
    }
    // Once done, remove animation objects while preserving a fully readable title.
    Promise.all(animations.map(animation => animation.finished)).then(settled).catch(() => {});
  };
  const init = () => {
    if (!root.isConnected) return;
    try {
      for (const [lineIndex, segment] of [...root.querySelectorAll("[data-stroke-line]")].entries()) {
        if (segment.textContent !== titleArtwork.text) throw Error("Title artwork does not match heading");
        const box = titleArtwork.box;
        const svg = element("svg", { class: "stroke-title-svg", "aria-hidden": "true", focusable: "false", preserveAspectRatio: "xMidYMid meet", viewBox: `${box.x} ${box.y} ${box.width} ${box.height}` });
        const defs = element("defs"), clip = element("clipPath", { id: "login-stroke-wipe-" + lineIndex, clipPathUnits: "userSpaceOnUse" });
        const rect = element("rect"); clip.append(rect); defs.append(clip); svg.append(defs);
        const outline = element("g", { class: "stroke-title-outline", fill: "none", stroke: "var(--title-stroke)", "stroke-width": defaults.strokeWidth, "stroke-linejoin": "round", "stroke-linecap": "round" });
        const fill = element("g", { fill: "var(--title-fill)", stroke: "none", "clip-path": `url(#login-stroke-wipe-${lineIndex})` });
        for (const [index, glyph] of titleArtwork.glyphs.entries()) {
          const character = element("g", { "data-title-char": glyph.char });
          for (const d of glyph.contours) {
            const node = element("path", { d, pathLength: "1", class: "stroke-title-contour" });
            character.append(node); strokes.push({ node, index });
          }
          outline.append(character);
          fill.append(element("path", { d: glyph.contours.join(" ") }));
        }
        svg.append(outline, fill); segment.append(svg);
        segment.style.width = box.width / titleArtwork.fontSize + "em";
        for (const [key, value] of Object.entries(box)) rect.setAttribute(key, value);
        groups.push({ rect, box });
      }
      ready = true; root.classList.add("stroke-title-ready");
      if (motion.matches) settled(); else play();
    } catch {
      cancel(); root.classList.remove("stroke-title-ready");
      root.querySelectorAll(".stroke-title-svg").forEach(svg => svg.remove());
    }
  };
  // The HTML heading remains readable if animation setup fails.
  document.fonts.ready.then(init);
  root.addEventListener("pointerenter", event => { if (event.pointerType !== "touch") play(true); });
  motion.addEventListener("change", () => { if (ready) settled(); });
  window.addEventListener("pagehide", settled);
}
