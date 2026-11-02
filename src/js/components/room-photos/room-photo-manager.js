import i18next from '../../i18n.js';
import { mobileLayers } from '../../utils/mobile-ux.js';
import { roomListingService } from '../../services/room-listing-service.js';
import { openPhotoViewer } from './photo-viewer.js';
import { pickRoomPhotos, uploadRoomPhotos, getRoomUpload } from './room-photo-upload.js';
import { removeRoomPhoto, visiblePhotos } from './room-photo-remove.js';
import { dismissRoomSnackbar } from './room-snackbar.js';
import './room-photos.css';

const LAYER = 'room-photo-manager';

const esc = (text) => {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
};
const t = (key, opts) => i18next.t(`roomPhotos.${key}`, opts);
const toast = (message, type) => window.showToast?.(message, type);

/**
 * Dialog to manage one room's photos: view them, pick the cover, remove
 * (X, with Undo), add more. Adding closes the dialog as soon as photos are chosen; the
 * upload carries on in the background and ends by offering the room's
 * customer link (see room-photo-upload.js).
 *
 * @param {object} ctx
 * @param {string} ctx.propertyId
 * @param {string} ctx.room        room key, e.g. COMMON_1
 * @param {string} ctx.roomLabel   display name, e.g. "Common 1"
 * @param {string} [ctx.address]   shown under the title
 */
export function openRoomPhotoManager(ctx) {
  const { propertyId, room, roomLabel, address = '' } = ctx;
  // photos: the room's full list; removed ones are only left out when shown
  const state = { loading: true, error: null, photos: [] };
  dismissRoomSnackbar(); // an earlier "photos added" bar would cover the photos (Share stays on the room's row)

  const backdrop = document.createElement('div');
  backdrop.className = 'rp-backdrop';
  backdrop.innerHTML = `
    <div class="rp-dialog" role="dialog" aria-modal="true" aria-label="${esc(roomLabel)}">
      <div class="rp-head">
        <div class="rp-head-text">
          <div class="rp-head-title">${esc(roomLabel)} · ${t('title')}</div>
          <div class="rp-head-sub">${esc(address)}</div>
        </div>
        <button type="button" class="btn btn-primary btn-sm rp-head-add" data-action="add"><i class="bi bi-plus-lg me-1"></i>${t('addPhotos')}</button>
        <button type="button" class="rp-icon-btn" data-action="close" aria-label="${t('close')}"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="rp-body"></div>
      <div class="rp-drop-overlay"><i class="bi bi-cloud-arrow-up"></i>${t('dropToUpload')}</div>
    </div>`;
  document.body.appendChild(backdrop);

  const body = backdrop.querySelector('.rp-body');
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  // ─── Rendering ─────────────────────────────────────────────────────────

  const renderPhotoTile = (photo, index) => `
    <div class="rp-tile" data-id="${esc(photo.id)}">
      <button type="button" class="rp-tile-img" data-action="view" data-index="${index}" aria-label="${t('view')}">
        <img src="${esc(photo.thumbUrl)}" alt="" loading="lazy" decoding="async">
      </button>
      ${index === 0 ? `<span class="rp-cover-badge">${t('cover')}</span>` : ''}
      <div class="rp-tile-actions">
        ${index > 0 ? `<button type="button" class="rp-tile-cover" data-action="cover" title="${t('makeCover')}" aria-label="${t('makeCover')}"><i class="bi bi-star"></i></button>` : ''}
        <button type="button" class="rp-tile-x" data-action="remove" title="${t('remove')}" aria-label="${t('remove')}"><i class="bi bi-x-lg"></i></button>
      </div>
    </div>`;

  // Upload started from the room row (or an earlier visit) that's still going
  let statusText = '';
  let shown = []; // photos on screen, in order (the viewer opens at the same index)
  const uploadStatus = () => {
    const job = getRoomUpload(propertyId, room);
    return job ? t('uploadingStatus', { done: job.done, total: job.total }) : '';
  };

  const render = () => {
    if (state.loading) {
      body.innerHTML = '<div class="rp-empty"><div class="spinner-border spinner-border-sm"></div></div>';
      return;
    }
    if (state.error) {
      body.innerHTML = `<div class="rp-empty"><i class="bi bi-exclamation-circle"></i>${t('loadFailed')}<br><small>${esc(state.error)}</small></div>`;
      return;
    }
    statusText = uploadStatus();
    const status = statusText
      ? `<div class="rp-status" role="status"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>${esc(statusText)}</div>`
      : '';
    shown = visiblePhotos(state.photos);
    const content = shown.length
      ? `<div class="rp-grid">${shown.map(renderPhotoTile).join('')}</div>`
      : `<div class="rp-empty"><i class="bi bi-images"></i>${t('noPhotos')}<div class="rp-empty-hint">${t('dropHere')}</div></div>`;
    body.innerHTML = status + content;
  };

  // ─── Data ──────────────────────────────────────────────────────────────

  const load = async () => {
    try {
      const rooms = await roomListingService.getPropertyRooms(propertyId, { fresh: true });
      const current = rooms.find((r) => r.room === room);
      if (!current) throw new Error(t('roomMissing'));
      state.photos = getRoomUpload(propertyId, room)?.photos || current.photos;
    } catch (error) {
      state.error = error.message;
    } finally {
      state.loading = false;
      render();
    }
  };

  // New photos land here while the dialog is open; byte progress is ignored
  const onUpload = (e) => {
    const detail = e.detail || {};
    if (detail.propertyId !== propertyId || detail.room !== room || state.loading || state.error) return;
    const photos = detail.photos || getRoomUpload(propertyId, room)?.photos;
    const photosChanged = photos && photos !== state.photos;
    if (photosChanged) state.photos = photos;
    if (photosChanged || uploadStatus() !== statusText) render();
  };

  // A photo removed, or brought back with Undo
  const onRemoved = (e) => {
    const detail = e.detail || {};
    if (detail.propertyId === propertyId && detail.room === room && !state.loading && !state.error) render();
  };

  // ─── Actions ───────────────────────────────────────────────────────────

  const upload = (files) => {
    if (!files?.length) return;
    close();
    uploadRoomPhotos(ctx, files);
  };

  const actions = {
    close: () => close(),
    add: () => pickRoomPhotos(ctx, { onPicked: close }),
    view: (el) => openPhotoViewer({
      photos: shown,
      startIndex: Number(el.dataset.index) || 0,
      title: `${roomLabel}${address ? ` · ${address}` : ''}`,
    }),
    cover: async (el) => {
      const id = el.closest('[data-id]').dataset.id;
      // The full list: the server only accepts an order with every photo it has
      const order = [id, ...state.photos.map((p) => p.id).filter((x) => x !== id)];
      try {
        state.photos = await roomListingService.reorderPhotos(propertyId, room, order);
        render();
      } catch (error) {
        toast(error.message, 'error');
      }
    },
    remove: (el) => {
      const id = el.closest('[data-id]').dataset.id;
      removeRoomPhoto(ctx, state.photos.find((p) => p.id === id));
    },
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) return close();
    const el = e.target.closest('[data-action]');
    if (el) actions[el.dataset.action]?.(el);
  });

  // Computers: drop photos anywhere on the dialog
  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
  backdrop.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    backdrop.classList.add('rp-dragging');
  });
  backdrop.addEventListener('dragleave', (e) => {
    if (!backdrop.contains(e.relatedTarget)) backdrop.classList.remove('rp-dragging');
  });
  backdrop.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    backdrop.classList.remove('rp-dragging');
    upload(e.dataTransfer.files);
  });

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  let closed = false;
  const onKey = (e) => {
    if (e.key === 'Escape' && !document.querySelector('.rp-viewer')) close();
  };
  const teardown = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('room-photos:upload', onUpload);
    window.removeEventListener('room-photos:removed', onRemoved);
    document.body.style.overflow = previousOverflow;
    backdrop.remove();
  };
  function close() {
    teardown();
    mobileLayers.close(LAYER);
  }

  document.addEventListener('keydown', onKey);
  window.addEventListener('room-photos:upload', onUpload);
  window.addEventListener('room-photos:removed', onRemoved);
  mobileLayers.open(LAYER, teardown);
  render();
  load();
}
