import i18next from '../../i18n.js';
import { roomListingService } from '../../services/room-listing-service.js';
import { getRoomTypeDisplayName } from '../../utils/room-type-mapper.js';
import { pickRoomPhotos, uploadRoomPhotos, getRoomUpload, uploadFraction } from './room-photo-upload.js';
import { removeRoomPhoto, visiblePhotos } from './room-photo-remove.js';
import { shareRoom } from './room-share.js';
import './room-photos.css';

// Photo controls at the end of each saved room's price row in the property form:
//   no photos  → "Add photos" opens the photo picker straight away
//   has photos → thumbnails (tap to manage, X to remove), "+" to add more, Share
// While photos upload (room-photo-upload.js), the button that started it
// shows the progress in its own spot, so nothing around it moves. The upload
// ends by offering the room's customer link.
// On a computer, photos can also be dropped onto a room's row. The manager
// dialog is only downloaded the first time someone opens it.

const MAX_THUMBS = 3;
const t = (key, opts) => i18next.t(`roomPhotos.${key}`, opts);
const esc = (text) => {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
};

// The property the strips show: { container, propertyId, savedRooms, address,
// listings: Map(room → { photos, shareUrl, minPrice, maxPrice }), loaded }
let current = null;

export const openRoomPhotoManagerLazy = (ctx) =>
  import(/* webpackChunkName: "room-photo-manager" */ './room-photo-manager.js')
    .then(({ openRoomPhotoManager }) => openRoomPhotoManager(ctx))
    .catch((error) => window.showToast?.(error.message, 'error'));

const ctxFor = (room) => ({
  propertyId: current.propertyId,
  room,
  roomLabel: getRoomTypeDisplayName(room),
  address: current.address,
});

// Sits at the end of the price inputs line, so it shares the row with the prices
const stripFor = (row) => {
  let strip = row.querySelector('.rp-strip');
  if (!strip) {
    strip = document.createElement('div');
    strip.className = 'rp-strip';
    // Photos save on their own: tapping these isn't an unsaved form edit
    strip.dataset.savesItself = '';
    (row.querySelector('.room-price-fields') || row).appendChild(strip);
  }
  return strip;
};

// The last thumbnail stands for the photos not shown ("+2"), so it gets no X.
// Phones show only the cover, with the photo count on it.
const thumbsHtml = (photos) => {
  if (!photos.length) return '';
  const shown = photos.slice(0, MAX_THUMBS);
  const extra = photos.length - shown.length;
  return `
    <div class="rp-strip-thumbs">
      ${shown.map((p, i) => {
        const more = extra > 0 && i === shown.length - 1;
        return `
        <div class="rp-strip-thumb">
          <button type="button" class="rp-strip-open" data-rp-act="manage" title="${esc(t('manage'))}" aria-label="${esc(t('manage'))}">
            <img src="${esc(p.thumbUrl)}" alt="" loading="lazy" decoding="async">
            ${more ? `<span class="rp-strip-more">+${extra}</span>` : ''}
            ${i === 0 && photos.length > 1 ? `<span class="rp-strip-count">${photos.length}</span>` : ''}
          </button>
          ${more ? '' : `<button type="button" class="rp-strip-x" data-rp-act="remove" data-photo-id="${esc(p.id)}" title="${esc(t('remove'))}" aria-label="${esc(t('remove'))}"><i class="bi bi-x-lg"></i></button>`}
        </div>`;
      }).join('')}
    </div>`;
};

// While uploading, the add button turns into its own progress indicator: same
// element classes, so exactly the same size (the hidden label keeps the width)
const progressAttrs = 'role="progressbar" aria-valuemin="0" aria-valuemax="100"';
const controlsHtml = (photos, uploading) => {
  if (!photos.length) {
    const label = `<span class="rp-add-label"><i class="bi bi-camera me-1"></i>${esc(t('addPhotos'))}</span>`;
    return uploading
      ? `<span class="btn rp-strip-camera rp-loading" ${progressAttrs}>${label}
          <span class="rp-loading-face"><span class="spinner-border" aria-hidden="true"></span><span class="rp-pct"></span></span>
        </span>`
      : `<button type="button" class="btn btn-outline-primary rp-strip-camera" data-rp-act="add">${label}</button>`;
  }
  const add = uploading
    ? `<span class="btn rp-strip-add rp-loading" ${progressAttrs}><span class="rp-pct"></span></span>`
    : `<button type="button" class="btn btn-outline-secondary rp-strip-add" data-rp-act="add" title="${esc(t('addMore'))}" aria-label="${esc(t('addMore'))}"><i class="bi bi-camera"></i></button>`;
  return `${add}
    <button type="button" class="btn btn-primary rp-strip-share" data-rp-act="share" title="${esc(t('share'))}" aria-label="${esc(t('share'))}"><i class="bi bi-share"></i><span class="rp-share-text ms-1">${esc(t('share'))}</span></button>`;
};

// Photos the row shows. Mid-upload it keeps showing the ones from before, so
// the row stays put until the upload is over.
const photosOf = (room) => visiblePhotos(current.listings.get(room)?.photos);

// Rebuilds the strip only when what it shows changes; upload progress just
// updates the indicator (rebuilding would reload the thumbnails every frame).
const renderStrip = (strip, photos, job) => {
  const signature = `${job ? 'uploading' : 'idle'}|${photos.map((p) => p.id).join(',')}`;
  if (strip.dataset.sig !== signature) {
    strip.dataset.sig = signature;
    strip.innerHTML = thumbsHtml(photos) + controlsHtml(photos, !!job);
  }
  const loader = job && strip.querySelector('.rp-loading');
  if (loader) {
    const percent = Math.round(uploadFraction(job) * 100);
    const label = t('uploadProgress', { done: job.done, total: job.total });
    loader.style.setProperty('--p', percent / 100);
    loader.setAttribute('aria-valuenow', percent);
    loader.setAttribute('aria-label', label);
    loader.title = label;
    loader.querySelector('.rp-pct').textContent = `${percent}%`;
  }
};

const setStripHtml = (strip, signature, html) => {
  if (strip.dataset.sig === signature) return;
  strip.dataset.sig = signature;
  strip.innerHTML = html;
};

const renderRow = (row) => {
  const strip = stripFor(row);
  const { room } = row.dataset;
  if (!current.savedRooms.includes(room)) {
    setStripHtml(strip, 'unsaved', `<span class="rp-strip-hint"><i class="bi bi-camera me-1"></i>${esc(t('saveFirst'))}</span>`);
    return;
  }
  const job = getRoomUpload(current.propertyId, room);
  if (!current.loaded && !job) {
    setStripHtml(strip, 'loading', ''); // avoids flashing "Add photos" on rooms that have photos
    return;
  }
  renderStrip(strip, photosOf(room), job);
};

const rowOf = (room) =>
  current?.container.querySelector(`.room-price-row[data-room="${CSS.escape(room)}"]`);

/**
 * Adds/refreshes the photo controls on every `.room-price-row` in `container`.
 * @param {HTMLElement} container  #propertyRoomPricesContainer
 * @param {object} options
 * @param {string|null} options.propertyId  null in add-mode (no controls)
 * @param {string[]} options.savedRooms     rooms already saved on the property
 * @param {string} [options.address]
 */
export function syncRoomPhotoStrips(container, { propertyId, savedRooms = [], address = '' }) {
  if (!container) return;
  const sameProperty = current?.container === container && current.propertyId === propertyId;
  current = {
    container,
    propertyId,
    savedRooms,
    address,
    listings: sameProperty ? current.listings : new Map(),
    loaded: sameProperty ? current.loaded : false,
  };
  bindOnce(container);

  const rows = Array.from(container.querySelectorAll('.room-price-row'));
  if (!propertyId) {
    rows.forEach((row) => row.querySelector('.rp-strip')?.remove());
    return;
  }
  rows.forEach(renderRow);
  if (!rows.some((row) => savedRooms.includes(row.dataset.room))) return;

  roomListingService
    .getPropertyRooms(propertyId)
    .then((rooms) => {
      if (current?.propertyId === propertyId) current.listings = new Map(rooms.map((r) => [r.room, r]));
    })
    .catch(() => {}) // rooms then just offer "Add photos"
    .finally(() => {
      if (current?.propertyId !== propertyId) return; // user moved on
      current.loaded = true;
      current.container.querySelectorAll('.room-price-row').forEach(renderRow);
    });
}

function bindOnce(container) {
  if (container.dataset.rpBound) return;
  container.dataset.rpBound = '1';

  container.addEventListener('click', (e) => {
    const el = e.target.closest('[data-rp-act]');
    const room = el?.closest('.room-price-row')?.dataset.room;
    if (!room || !current?.propertyId) return;
    const ctx = ctxFor(room);
    // All of these stay inside the tap: pickers and share sheets need it
    const act = el.dataset.rpAct;
    if (act === 'add') pickRoomPhotos(ctx);
    else if (act === 'share') shareRoom({ ...ctx, listing: current.listings.get(room) });
    else if (act === 'manage') openRoomPhotoManagerLazy(ctx);
    else if (act === 'remove') removeRoomPhoto(ctx, photosOf(room).find((p) => p.id === el.dataset.photoId));
  });

  // Computers: drop photos onto a saved room's row to upload them. Any file
  // dropped elsewhere here is swallowed, so a near miss doesn't make the
  // browser open the photo and leave the app.
  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
  const savedRowAt = (e) => {
    const row = e.target.closest?.('.room-price-row');
    return row && current?.propertyId && current.savedRooms.includes(row.dataset.room) ? row : null;
  };
  let dropRow = null;
  const highlight = (row) => {
    if (row === dropRow) return;
    dropRow?.classList.remove('rp-drop-target');
    dropRow = row;
    dropRow?.classList.add('rp-drop-target');
  };
  container.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    const row = savedRowAt(e);
    e.dataTransfer.dropEffect = row ? 'copy' : 'none';
    highlight(row);
  });
  container.addEventListener('dragleave', (e) => {
    if (!container.contains(e.relatedTarget)) highlight(null);
  });
  container.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    const row = savedRowAt(e);
    highlight(null);
    if (row) uploadRoomPhotos(ctxFor(row.dataset.room), e.dataTransfer.files);
  });
}

// Photos added, deleted or reordered anywhere: reload this property's rooms
window.addEventListener('room-listings:changed', (e) => {
  if (current?.propertyId && e.detail?.propertyId === current.propertyId) {
    syncRoomPhotoStrips(current.container, current);
  }
});

// A photo removed (or brought back with Undo)
window.addEventListener('room-photos:removed', (e) => {
  const { propertyId, room } = e.detail || {};
  const row = propertyId === current?.propertyId && rowOf(room);
  if (row) renderRow(row);
});

// Upload progress, and the final photo list / link once it's over
window.addEventListener('room-photos:upload', (e) => {
  const { propertyId, room, photos, shareUrl } = e.detail || {};
  if (!current?.propertyId || propertyId !== current.propertyId) return;
  if (photos || shareUrl) {
    const listing = current.listings.get(room) || { room, photos: [] };
    current.listings.set(room, { ...listing, ...(photos && { photos }), ...(shareUrl && { shareUrl }) });
  }
  const row = rowOf(room);
  if (row) renderRow(row);
});
