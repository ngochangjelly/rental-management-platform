import i18next from '../../i18n.js';
import { roomListingService } from '../../services/room-listing-service.js';
import { showRoomSnackbar, dismissRoomSnackbar } from './room-snackbar.js';

/**
 * Removing a room photo (the X on a picture).
 *
 * The photo disappears at once and the bottom bar offers Undo. The server
 * delete runs only once that bar goes away (timeout, closed, replaced by
 * another bar, or the user leaving the page), because the server also deletes
 * the file from storage, so after that there's nothing to bring back.
 *
 * Screens list photos through visiblePhotos() and redraw on the
 * `room-photos:removed` window event ({ detail: { propertyId, room } }).
 */

// Texts end up in the bottom bar or a toast, which escape them, so i18next must not
const t = (key, opts) => i18next.t(`roomPhotos.${key}`, { ...opts, interpolation: { escapeValue: false } });

const hidden = new Set(); // ids of photos removed or about to be (ids are never reused)
let pending = null; // the removal Undo can still take back: { ctx, photo, state }
let chain = Promise.resolve();

/** `photos` without the ones the user removed. */
export const visiblePhotos = (photos) => (photos || []).filter((p) => !hidden.has(p.id));

const announce = (ctx) =>
  window.dispatchEvent(new CustomEvent('room-photos:removed', {
    detail: { propertyId: ctx.propertyId, room: ctx.room },
  }));

function commit(item, { keepalive = false } = {}) {
  if (item.state !== 'pending') return;
  item.state = 'done';
  if (pending === item) pending = null;
  const { ctx, photo } = item;
  const run = () => roomListingService
    .deletePhoto(ctx.propertyId, ctx.room, photo.id, { keepalive })
    .catch((error) => {
      hidden.delete(photo.id);
      announce(ctx);
      window.showToast?.(t('removeFailed', { reason: error.message }), 'error');
    });
  // One at a time: the server turns down two edits to the same room at once.
  // A page that's closing can't wait for its turn, though.
  if (keepalive) run();
  else chain = chain.then(run);
}

function undo(item) {
  if (item.state !== 'pending') return;
  item.state = 'undone';
  if (pending === item) pending = null;
  hidden.delete(item.photo.id);
  announce(item.ctx);
}

/**
 * Removes a photo from a room, with Undo (see the top of this file).
 * @param {object} ctx    { propertyId, room, roomLabel }
 * @param {object} photo  { id, thumbUrl, ... }
 */
export function removeRoomPhoto(ctx, photo) {
  if (!photo || hidden.has(photo.id)) return;
  hidden.add(photo.id);
  const item = { ctx, photo, state: 'pending' };
  pending = item; // set first: the bar shown next replaces (and so commits) an earlier removal
  announce(ctx);
  showRoomSnackbar({
    thumbUrl: photo.thumbUrl,
    title: t('removedTitle', { room: ctx.roomLabel }),
    actions: [{ label: t('undo'), icon: 'bi-arrow-counterclockwise', primary: true, onClick: () => undo(item) }],
    onHide: (reason) => {
      if (reason !== 'action') commit(item);
    },
  });
}

// Leaving the page or switching away (phones may never come back to this
// tab): send the delete now, in a request that outlives the page.
const sendPendingNow = () => {
  if (!pending) return;
  commit(pending, { keepalive: true });
  dismissRoomSnackbar();
};
window.addEventListener('pagehide', sendPendingNow);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') sendPendingNow();
});
