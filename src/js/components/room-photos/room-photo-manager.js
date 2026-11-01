import i18next from '../../i18n.js';
import { mobileLayers } from '../../utils/mobile-ux.js';
import { roomListingService, isAcceptedImage } from '../../services/room-listing-service.js';
import { openPhotoViewer } from './photo-viewer.js';
import { shareRoomLink, copyRoomLink, formatPriceRange } from './room-share.js';
import './room-photos.css';

const LAYER = 'room-photo-manager';
const PREVIEWABLE_RE = /^image\/(jpeg|png|webp|gif|avif)$/;

const esc = (text) => {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
};
const t = (key, opts) => i18next.t(`roomPhotos.${key}`, opts);
const toast = (message, type) => window.showToast?.(message, type);

/**
 * Dialog to manage one room's photos and its customer link.
 *
 * @param {object} opts
 * @param {string} opts.propertyId
 * @param {string} opts.room          room key, e.g. COMMON_1
 * @param {string} opts.roomLabel     display name, e.g. "Common 1"
 * @param {string} [opts.address]     shown under the title and in shared messages
 * @param {boolean} [opts.canEdit]    false = view + share only (e.g. Sales Map users)
 */
export function openRoomPhotoManager({ propertyId, room, roomLabel, address = '', canEdit = true }) {
  const state = {
    loading: true,
    error: null,
    photos: [],
    minPrice: 0,
    maxPrice: 0,
    shareUrl: null,
    shareBusy: false,
    uploads: [], // { uid, name, previewUrl, progress, error }
  };

  const backdrop = document.createElement('div');
  backdrop.className = 'rp-backdrop';
  backdrop.innerHTML = `
    <div class="rp-dialog" role="dialog" aria-modal="true" aria-label="${esc(roomLabel)}">
      <div class="rp-head">
        <div class="rp-head-text">
          <div class="rp-head-title">${esc(roomLabel)} · ${t('title')}</div>
          <div class="rp-head-sub">${esc(address)}</div>
        </div>
        <button type="button" class="rp-icon-btn" data-action="close" aria-label="${t('close')}"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="rp-body"></div>
    </div>
    <input type="file" accept="image/*,.heic,.heif" multiple hidden>
  `;
  document.body.appendChild(backdrop);

  const body = backdrop.querySelector('.rp-body');
  const fileInput = backdrop.querySelector('input[type=file]');
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  // ─── Rendering ─────────────────────────────────────────────────────────

  const renderPhotoTile = (photo, index) => `
    <div class="rp-tile" data-id="${esc(photo.id)}">
      <button type="button" class="rp-tile-img" data-action="view" data-index="${index}" aria-label="${t('view')}">
        <img src="${esc(photo.thumbUrl)}" alt="" loading="lazy" decoding="async">
      </button>
      ${index === 0 ? `<span class="rp-cover-badge">${t('cover')}</span>` : ''}
      ${canEdit ? `
        <div class="rp-tile-actions">
          ${index > 0 ? `<button type="button" data-action="cover" title="${t('makeCover')}" aria-label="${t('makeCover')}"><i class="bi bi-star"></i></button>` : ''}
          <button type="button" class="rp-danger" data-action="delete" title="${t('delete')}" aria-label="${t('delete')}"><i class="bi bi-trash"></i></button>
        </div>` : ''}
    </div>`;

  const renderUploadTile = (u) => `
    <div class="rp-tile rp-tile-pending" data-uid="${u.uid}">
      ${u.previewUrl ? `<img src="${u.previewUrl}" alt="">` : '<i class="bi bi-image"></i>'}
      ${u.error
        ? `<div class="rp-tile-error"><div><i class="bi bi-exclamation-triangle"></i> ${esc(u.name)}</div><div>${esc(u.error)}</div>
             <button type="button" class="btn btn-sm btn-outline-danger" data-action="dismiss" data-uid="${u.uid}">${t('dismiss')}</button></div>`
        : `<div class="rp-progress"><span style="width:${Math.round(u.progress * 100)}%"></span></div>`}
    </div>`;

  const renderShare = () => {
    const price = formatPriceRange(state.minPrice, state.maxPrice);
    const head = `
      <div class="rp-share-title"><i class="bi bi-link-45deg"></i> ${t('shareTitle')}
        <span class="text-muted fw-normal small ms-auto">${price ? `${esc(price)} ${t('perMonth')}` : t('noPrice')}</span>
      </div>
      <div class="rp-share-hint">${t('shareHint')}</div>`;

    if (!state.shareUrl) {
      return `<div class="rp-share">${head}
        <button type="button" class="btn btn-primary btn-sm" data-action="share-create" ${state.shareBusy ? 'disabled' : ''}>
          <i class="bi bi-link-45deg me-1"></i>${t('createLink')}
        </button></div>`;
    }
    return `<div class="rp-share">${head}
      <div class="rp-share-row">
        <input type="text" class="form-control form-control-sm" readonly value="${esc(state.shareUrl)}" data-action="select">
        <button type="button" class="btn btn-sm btn-outline-secondary" data-action="share-copy"><i class="bi bi-clipboard me-1"></i>${t('copy')}</button>
        <button type="button" class="btn btn-sm btn-primary" data-action="share-send"><i class="bi bi-share me-1"></i>${t('share')}</button>
        <a class="btn btn-sm btn-outline-secondary" href="${esc(state.shareUrl)}" target="_blank" rel="noopener noreferrer"><i class="bi bi-box-arrow-up-right me-1"></i>${t('open')}</a>
        <button type="button" class="btn btn-sm btn-outline-danger" data-action="share-off" ${state.shareBusy ? 'disabled' : ''}>${t('turnOff')}</button>
      </div></div>`;
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

    const uploading = state.uploads.filter((u) => !u.error).length;
    const drop = canEdit ? `
      <div class="rp-drop">
        <button type="button" class="btn btn-primary btn-sm" data-action="pick"><i class="bi bi-cloud-arrow-up me-1"></i>${t('addPhotos')}</button>
        <div class="rp-drop-hint">${uploading ? t('uploading', { count: uploading }) : t('dropHint')}</div>
      </div>` : '';

    const tiles = state.photos.map(renderPhotoTile).join('') + state.uploads.map(renderUploadTile).join('');
    const grid = tiles
      ? `<div class="rp-grid">${tiles}</div>`
      : `<div class="rp-empty"><i class="bi bi-images"></i>${t('noPhotos')}</div>`;

    body.innerHTML = drop + grid + renderShare();
  };

  // ─── Data ──────────────────────────────────────────────────────────────

  const load = async () => {
    try {
      const rooms = await roomListingService.getPropertyRooms(propertyId, { fresh: true });
      const current = rooms.find((r) => r.room === room);
      if (!current) throw new Error(t('roomMissing'));
      Object.assign(state, {
        photos: current.photos,
        minPrice: current.minPrice,
        maxPrice: current.maxPrice,
        shareUrl: current.shareUrl,
      });
    } catch (error) {
      state.error = error.message;
    } finally {
      state.loading = false;
      render();
    }
  };

  const startUpload = async (fileList) => {
    const files = Array.from(fileList || []).filter(isAcceptedImage);
    if (!files.length) return;

    const batch = files.map((file, i) => ({
      uid: `${Date.now()}-${i}`,
      name: file.name,
      previewUrl: PREVIEWABLE_RE.test(file.type) ? URL.createObjectURL(file) : null,
      progress: 0,
      error: null,
    }));
    state.uploads.push(...batch);
    render();

    const releasePreview = (u) => u.previewUrl && URL.revokeObjectURL(u.previewUrl);
    const { failed } = await roomListingService.uploadPhotos(propertyId, room, files, {
      onFileProgress: (i, fraction) => {
        batch[i].progress = fraction;
        // Update just the bar; a full render per progress tick would be wasteful
        const bar = body.querySelector(`[data-uid="${batch[i].uid}"] .rp-progress span`);
        if (bar) bar.style.width = `${Math.round(fraction * 100)}%`;
      },
      onFileDone: (i, error, photos) => {
        const u = batch[i];
        if (error) {
          u.error = error.message;
        } else {
          releasePreview(u);
          state.uploads = state.uploads.filter((x) => x !== u);
          state.photos = photos;
        }
        if (!closed) render();
      },
    }).catch((error) => {
      // Could not even start (e.g. signature request failed)
      batch.forEach((u) => { u.error = error.message; });
      return { failed: batch.length };
    });

    if (!closed) render();
    if (failed) toast(t('uploadFailed', { count: failed }), 'danger');
    else toast(t('uploadDone', { count: files.length }), 'success');
  };

  // ─── Actions ───────────────────────────────────────────────────────────

  const actions = {
    close: () => close(),
    pick: () => fileInput.click(),
    select: (el) => el.select(),
    view: (el) => openPhotoViewer({
      photos: state.photos,
      startIndex: Number(el.dataset.index) || 0,
      title: `${roomLabel}${address ? ` · ${address}` : ''}`,
    }),
    dismiss: (el) => {
      state.uploads = state.uploads.filter((u) => u.uid !== el.dataset.uid);
      render();
    },
    cover: async (el) => {
      const id = el.closest('[data-id]').dataset.id;
      const order = [id, ...state.photos.map((p) => p.id).filter((x) => x !== id)];
      try {
        state.photos = await roomListingService.reorderPhotos(propertyId, room, order);
        render();
      } catch (error) {
        toast(error.message, 'danger');
      }
    },
    delete: async (el) => {
      if (!window.confirm(t('deleteConfirm'))) return;
      const tile = el.closest('[data-id]');
      tile.style.opacity = '0.4';
      try {
        state.photos = await roomListingService.deletePhoto(propertyId, room, tile.dataset.id);
        render();
      } catch (error) {
        tile.style.opacity = '';
        toast(error.message, 'danger');
      }
    },
    'share-create': async () => {
      state.shareBusy = true;
      render();
      try {
        const { shareUrl } = await roomListingService.enableShare(propertyId, room);
        state.shareUrl = shareUrl;
      } catch (error) {
        toast(error.message, 'danger');
      } finally {
        state.shareBusy = false;
        render();
      }
    },
    'share-copy': () => copyRoomLink(state.shareUrl),
    'share-send': () => shareRoomLink({
      url: state.shareUrl, roomLabel, address, minPrice: state.minPrice, maxPrice: state.maxPrice,
    }),
    'share-off': async () => {
      if (!window.confirm(t('turnOffConfirm'))) return;
      state.shareBusy = true;
      render();
      try {
        await roomListingService.disableShare(propertyId, room);
        state.shareUrl = null;
        toast(t('linkOff'), 'success');
      } catch (error) {
        toast(error.message, 'danger');
      } finally {
        state.shareBusy = false;
        render();
      }
    },
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) return close();
    const el = e.target.closest('[data-action]');
    if (el && el.tagName !== 'INPUT') actions[el.dataset.action]?.(el);
  });
  backdrop.addEventListener('focusin', (e) => {
    if (e.target.dataset?.action === 'select') e.target.select();
  });
  fileInput.addEventListener('change', () => {
    startUpload(fileInput.files);
    fileInput.value = '';
  });

  if (canEdit) {
    const dialog = backdrop.querySelector('.rp-dialog');
    const setDrag = (on) => body.querySelector('.rp-drop')?.classList.toggle('rp-drag', on);
    dialog.addEventListener('dragover', (e) => { e.preventDefault(); setDrag(true); });
    dialog.addEventListener('dragleave', (e) => { if (!dialog.contains(e.relatedTarget)) setDrag(false); });
    dialog.addEventListener('drop', (e) => {
      e.preventDefault();
      setDrag(false);
      startUpload(e.dataTransfer?.files);
    });
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  let closed = false;
  const onKey = (e) => {
    if (e.key === 'Escape' && !document.querySelector('.rp-viewer')) close();
  };
  const teardown = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = previousOverflow;
    state.uploads.forEach((u) => u.previewUrl && URL.revokeObjectURL(u.previewUrl));
    backdrop.remove();
    // Uploads still in flight keep going and save themselves in the background
  };
  function close() {
    teardown();
    mobileLayers.close(LAYER);
  }

  document.addEventListener('keydown', onKey);
  mobileLayers.open(LAYER, teardown);
  render();
  load();
}
