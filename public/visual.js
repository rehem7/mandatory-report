// Native adaptations of React Bits Fade Content / Spotlight Card interaction ideas.
// Upstream license: /assets/visual/licenses/react-bits.txt (David Haz).
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const observed = new WeakSet();
let installed = false, frame = 0, lastCard = null;
export const art = (name, className = '', eager = false) => {
  // Project-supplied artwork; the sheet's bottom-right pose greets new visitors.
  if (name === 'mascot-wave') return `<span class="theme-art mascot-art mascot-sprite ${className}" aria-hidden="true"><img src="/assets/mascot/guardian-expressions.jpg" width="1254" height="1254" alt="" decoding="async" loading="${eager ? 'eager' : 'lazy'}"></span>`;
  const mascots = { 'mascot-question': ['/assets/mascot/guardian-question.png', 1078, 1459], 'mascot-confident': ['/assets/mascot/guardian-confident.png', 1254, 1254] };
  if (mascots[name]) { const [src, width, height] = mascots[name]; return `<img class="theme-art mascot-art ${className}" src="${src}" width="${width}" height="${height}" alt="" aria-hidden="true" decoding="async" loading="${eager ? 'eager' : 'lazy'}">`; }
  const files = { support: '/assets/visual/children-support.svg', learning: '/assets/visual/children-learning.svg', reading: '/assets/visual/children-reading.svg' };
  return `<img class="theme-art ${className}" src="${files[name] || files.reading}" width="500" height="500" alt="" aria-hidden="true" decoding="async" loading="${eager ? 'eager' : 'lazy'}">`;
};
export function banner(kind) {
  const training = kind === 'training';
  return `<section class="children-banner ${training ? 'training-banner' : 'learning-banner'}" data-reveal><div class="children-banner-copy"><span class="visual-eyebrow">${training ? '学会倾听，练习守护' : '把保护孩子的知识，变成行动'}</span><h2>${training ? '站在孩子身边，听见每一句需要。' : '多了解一点，孩子就多一份保护。'}</h2><p>${training ? '在虚构情景中练习识别、沟通与报告，让真实的保护更有准备。' : '从报告制度到沟通方法，读懂保护未成年人的每一个关键环节。'}</p><div class="banner-points"><span>${training ? '倾听与回应' : '制度要点'}</span><i></i><span>${training ? '风险识别' : '真实来源'}</span><i></i><span>${training ? '五步实训' : '行动指引'}</span></div></div>${art(training ? 'mascot-confident' : 'reading', 'banner-art', true)}</section>`;
}
export function emptyArtwork(title, description) {
  return `<div class="empty illustrated-empty">${art('mascot-wave')}<div><span class="visual-eyebrow">每一次行动，都值得留下记录</span><h3>${title}</h3><p class="muted">${description}</p></div></div>`;
}
export const artCredit = '<a class="art-credit" href="https://storyset.com/people" target="_blank" rel="noopener noreferrer">儿童主题插画：Storyset</a>';
export function installVisuals(root) {
  if (installed) return; installed = true;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      observer.unobserve(entry.target);
      if (!motion.matches) entry.target.animate([{ opacity: .35, transform: 'translateY(9px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 420, delay: Number(entry.target.dataset.revealDelay || 0), easing: 'cubic-bezier(.2,.7,.25,1)' });
    }
  }, { threshold: .06 });
  const enhance = node => {
    if (!(node instanceof Element)) return;
    for (const el of [...(node.matches('[data-reveal]') ? [node] : []), ...node.querySelectorAll('[data-reveal]')]) if (!observed.has(el)) { observed.add(el); observer.observe(el); }
  };
  enhance(root);
  new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) enhance(node); }).observe(root, { childList: true });
  root.addEventListener('pointermove', event => {
    if (motion.matches || event.pointerType !== 'mouse') return;
    const card = event.target.closest('[data-spotlight]');
    if (lastCard && card !== lastCard) lastCard.classList.remove('spotlight-active');
    lastCard = card;
    if (!card || frame) return;
    const x = event.clientX, y = event.clientY;
    frame = requestAnimationFrame(() => {
      frame = 0; if (!card.isConnected || card !== lastCard) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--spot-x', `${x - rect.left}px`); card.style.setProperty('--spot-y', `${y - rect.top}px`); card.classList.add('spotlight-active');
    });
  }, { passive: true });
  root.addEventListener('pointerleave', () => { lastCard?.classList.remove('spotlight-active'); lastCard = null; });
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; });
}
