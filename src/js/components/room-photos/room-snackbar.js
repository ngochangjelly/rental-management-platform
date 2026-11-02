import i18next from '../../i18n.js';
import './room-photos.css';

// Bottom bar for room photo results, e.g. "5 photos added · Common 1 [Share]".
// One at a time (a newer bar replaces the old one). It hides after a while,
// but not while the pointer or keyboard focus is on it.

const DURATION_MS = 12000;
let active = null; // { el, dismiss }

const esc = (text) => {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
};

/** Hides the bar, e.g. when a full-screen view opens on top of the page. */
export const dismissRoomSnackbar = () => active?.dismiss('dismissed');

/**
 * @param {object} opts
 * @param {'ok'|'warn'|'error'} [opts.tone]
 * @param {string} [opts.thumbUrl]  room cover photo, shown instead of the icon
 * @param {string} opts.title
 * @param {string} [opts.text]
 * @param {Array<{label:string, icon?:string, primary?:boolean, onClick:Function}|null|false>} [opts.actions]
 * @param {Function} [opts.onHide]  called once when the bar goes, with why:
 *   'action' (one of its buttons), 'close', 'timeout', 'replaced' or 'dismissed'
 */
export function showRoomSnackbar({ tone = 'ok', thumbUrl, title, text, actions = [], onHide }) {
  active?.dismiss('replaced');

  const list = actions.filter(Boolean);
  const icon = tone === 'error' ? 'bi-exclamation-circle-fill' : tone === 'warn' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill';
  const el = document.createElement('div');
  el.className = `rp-snack rp-snack-${tone}`;
  el.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  el.innerHTML = `
    ${thumbUrl
      ? `<img class="rp-snack-thumb" src="${esc(thumbUrl)}" alt="">`
      : `<i class="rp-snack-icon bi ${icon}"></i>`}
    <div class="rp-snack-text">
      <div class="rp-snack-title">${esc(title)}</div>
      ${text ? `<div class="rp-snack-sub">${esc(text)}</div>` : ''}
    </div>
    <div class="rp-snack-actions">${list.map((a, i) => `
      <button type="button" class="rp-snack-btn${a.primary ? ' rp-primary' : ''}" data-i="${i}">
        ${a.icon ? `<i class="bi ${esc(a.icon)}"></i>` : ''}${esc(a.label)}
      </button>`).join('')}</div>
    <button type="button" class="rp-snack-close" aria-label="${esc(i18next.t('roomPhotos.close'))}"><i class="bi bi-x-lg"></i></button>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('rp-show'));

  let timer = 0;
  let held = false;
  let gone = false;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => !held && dismiss('timeout'), DURATION_MS);
  };
  const hold = (on) => {
    held = on;
    if (!on && !gone) arm();
  };
  function dismiss(reason = 'dismissed') {
    if (gone) return;
    gone = true;
    clearTimeout(timer);
    if (active?.el === el) active = null;
    el.classList.remove('rp-show');
    setTimeout(() => el.remove(), 250);
    onHide?.(reason);
  }

  el.addEventListener('pointerenter', () => hold(true));
  el.addEventListener('pointerleave', () => hold(false));
  el.addEventListener('focusin', () => hold(true));
  el.addEventListener('focusout', (e) => !el.contains(e.relatedTarget) && hold(false));
  el.addEventListener('click', (e) => {
    if (e.target.closest('.rp-snack-close')) return dismiss('close');
    const btn = e.target.closest('[data-i]');
    if (!btn) return;
    dismiss('action');
    // Still inside the tap: share sheets and clipboard writes need that
    list[Number(btn.dataset.i)].onClick?.();
  });

  arm();
  active = { el, dismiss };
  return { dismiss };
}
