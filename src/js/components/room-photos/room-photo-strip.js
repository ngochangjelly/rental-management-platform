import i18next from '../../i18n.js';
import { roomListingService } from '../../services/room-listing-service.js';
import { getRoomTypeDisplayName } from '../../utils/room-type-mapper.js';
import './room-photos.css';

// Compact photo row under each room price row in the property form:
// a few thumbnails, a "Photos" button that opens the manager, and a marker
// when the room has a live customer link. The manager dialog code is only
// downloaded the first time someone opens it.

const MAX_THUMBS = 3;
const t = (key, opts) => i18next.t(`roomPhotos.${key}`, opts);
const esc = (text) => {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
};

let lastSync = null; // { container, options } — re-rendered when photos change

export const openRoomPhotoManagerLazy = (options) =>
  import(/* webpackChunkName: "room-photo-manager" */ './room-photo-manager.js')
    .then(({ openRoomPhotoManager }) => openRoomPhotoManager(options))
    .catch((error) => window.showToast?.(error.message, 'danger'));

// Sits at the end of the price inputs line, so it shares the row with the prices
const stripFor = (row) => {
  let strip = row.querySelector('.rp-strip');
  if (!strip) {
    strip = document.createElement('div');
    strip.className = 'rp-strip rp-strip-inline';
    (row.querySelector('.room-price-fields') || row).appendChild(strip);
  }
  return strip;
};

const renderStrip = (strip, listing) => {
  const photos = listing?.photos || [];
  const extra = photos.length - MAX_THUMBS;
  const thumbs = photos.length
    ? `<div class="rp-strip-thumbs" data-rp-open>
        ${photos.slice(0, MAX_THUMBS).map((p) => `<img class="rp-strip-thumb" src="${esc(p.thumbUrl)}" alt="" loading="lazy" decoding="async">`).join('')}
        ${extra > 0 ? `<span class="rp-strip-more">+${extra}</span>` : ''}
      </div>`
    : '';
  strip.innerHTML = `
    ${thumbs}
    <button type="button" class="btn btn-outline-primary" data-rp-open>
      <i class="bi bi-camera me-1"></i>${photos.length ? t('photosCount', { count: photos.length }) : t('addPhotos')}
    </button>
    ${listing?.shareUrl ? `<span class="rp-shared-dot" title="${esc(t('sharedHint'))}"><i class="bi bi-link-45deg"></i> ${t('shared')}</span>` : ''}`;
};

/**
 * Adds/refreshes the photo strip on every `.room-price-row` in `container`.
 * @param {HTMLElement} container  #propertyRoomPricesContainer
 * @param {object} options
 * @param {string|null} options.propertyId  null in add-mode (strips are hidden)
 * @param {string[]} options.savedRooms     rooms already saved on the property
 * @param {string} [options.address]
 */
export function syncRoomPhotoStrips(container, { propertyId, savedRooms = [], address = '' }) {
  if (!container) return;
  lastSync = { container, options: { propertyId, savedRooms, address } };
  container.dataset.rpProperty = propertyId || '';

  const rows = Array.from(container.querySelectorAll('.room-price-row'));
  if (!propertyId) {
    rows.forEach((row) => row.querySelector('.rp-strip')?.remove());
    return;
  }

  const savedRows = [];
  rows.forEach((row) => {
    const strip = stripFor(row);
    if (savedRooms.includes(row.dataset.room)) {
      savedRows.push(row);
    } else {
      strip.innerHTML = `<span class="rp-strip-hint"><i class="bi bi-camera me-1"></i>${t('saveFirst')}</span>`;
    }
  });
  if (!savedRows.length) return;

  roomListingService
    .getPropertyRooms(propertyId)
    .then((rooms) => {
      if (container.dataset.rpProperty !== propertyId) return; // user moved on
      const byRoom = new Map(rooms.map((r) => [r.room, r]));
      savedRows.forEach((row) => renderStrip(stripFor(row), byRoom.get(row.dataset.room)));
    })
    .catch(() => {
      savedRows.forEach((row) => renderStrip(stripFor(row), null));
    });

  if (!container.dataset.rpBound) {
    container.dataset.rpBound = '1';
    container.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-rp-open]');
      if (!trigger || !lastSync) return;
      const room = trigger.closest('.room-price-row')?.dataset.room;
      if (!room) return;
      openRoomPhotoManagerLazy({
        propertyId: lastSync.options.propertyId,
        room,
        roomLabel: getRoomTypeDisplayName(room),
        address: lastSync.options.address,
        canEdit: true,
      });
    });
  }
}

window.addEventListener('room-listings:changed', (e) => {
  if (lastSync && e.detail?.propertyId === lastSync.options.propertyId) {
    syncRoomPhotoStrips(lastSync.container, lastSync.options);
  }
});
