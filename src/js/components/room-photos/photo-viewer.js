import i18next from '../../i18n.js';
import { mobileLayers } from '../../utils/mobile-ux.js';
import './room-photos.css';

const LAYER = 'room-photo-viewer';

const esc = (text) => {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
};

/**
 * Full-screen swipeable photo viewer.
 * photos: [{ displayUrl, fullUrl }]. Only the current photo and its
 * neighbours are downloaded; "Original" opens the full-resolution file.
 */
export function openPhotoViewer({ photos, startIndex = 0, title = '' }) {
  if (!photos?.length) return;
  const t = (k) => i18next.t(`roomPhotos.${k}`);

  const root = document.createElement('div');
  root.className = 'rp-viewer';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML = `
    <div class="rp-viewer-bar">
      <span class="rp-viewer-title">${esc(title)}</span>
      <span class="rp-viewer-count"></span>
      <a class="rp-viewer-original" target="_blank" rel="noopener noreferrer">${t('original')}</a>
      <button type="button" class="rp-viewer-close" aria-label="${t('close')}"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="rp-viewer-track">
      ${photos.map((p, i) => `<div class="rp-viewer-slide"><img data-src="${esc(p.displayUrl)}" alt="${i + 1}" decoding="async"></div>`).join('')}
    </div>
    ${photos.length > 1 ? `
      <button type="button" class="rp-viewer-nav prev" aria-label="Previous">‹</button>
      <button type="button" class="rp-viewer-nav next" aria-label="Next">›</button>` : ''}
  `;
  document.body.appendChild(root);

  const track = root.querySelector('.rp-viewer-track');
  const slides = Array.from(track.children);
  const count = root.querySelector('.rp-viewer-count');
  const original = root.querySelector('.rp-viewer-original');
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const currentIndex = () => Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
  const sync = () => {
    const i = currentIndex();
    for (let k = i - 1; k <= i + 1; k++) {
      const img = slides[k]?.querySelector('img');
      if (img && !img.src) img.src = img.dataset.src;
    }
    count.textContent = `${i + 1} / ${photos.length}`;
    original.href = photos[i]?.fullUrl || photos[i]?.displayUrl || '#';
  };
  const step = (dir) => track.scrollBy({ left: dir * track.clientWidth, behavior: 'smooth' });

  let closed = false;
  const teardown = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    document.body.style.overflow = previousOverflow;
    root.remove();
  };
  const close = () => {
    teardown();
    mobileLayers.close(LAYER);
  };
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  }

  root.querySelector('.rp-viewer-close').addEventListener('click', close);
  root.querySelector('.rp-viewer-nav.prev')?.addEventListener('click', () => step(-1));
  root.querySelector('.rp-viewer-nav.next')?.addEventListener('click', () => step(1));
  track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  document.addEventListener('keydown', onKey, true);
  mobileLayers.open(LAYER, teardown);

  // Jump to the chosen photo after layout
  requestAnimationFrame(() => {
    track.scrollLeft = startIndex * track.clientWidth;
    sync();
  });
}
