import i18next from '../../i18n.js';
import { roomListingService, isAcceptedImage, MAX_FILE_BYTES } from '../../services/room-listing-service.js';
import { offerRoomLink } from './room-share.js';
import { showRoomSnackbar } from './room-snackbar.js';
import { visiblePhotos } from './room-photo-remove.js';

/**
 * Room photo uploads that run on their own.
 *
 * Picking photos is all the user does: any dialog closes right away, the
 * upload carries on in the background (the room's row shows progress), the
 * room's customer link is made at the same time, and once the photos are
 * saved a bottom bar offers that link (already copied when the browser
 * allows it).
 *
 * Progress is announced with a `room-photos:upload` window event
 * ({ detail: { propertyId, room, photos?, shareUrl? } }); read the current
 * state with getRoomUpload(). `photos` / `shareUrl` come with the final
 * events, once the upload is over.
 */

// Texts end up in the bottom bar or a toast, which escape them, so i18next must not
const t = (key, opts) => i18next.t(`roomPhotos.${key}`, { ...opts, interpolation: { escapeValue: false } });
const toast = (message, type) => window.showToast?.(message, type);

const jobs = new Map(); // "propertyId|room" → job
const keyOf = (propertyId, room) => `${propertyId}|${room}`;

/** The room's running upload, or null: { total, done, failed[], photos, ... } */
export const getRoomUpload = (propertyId, room) => jobs.get(keyOf(propertyId, room)) || null;

/** How far along the upload is, 0…1, counting bytes of every file. */
export const uploadFraction = (job) =>
  job.total ? job.fractions.reduce((sum, f) => sum + f, 0) / job.total : 0;

const announce = (ctx, extra) =>
  window.dispatchEvent(new CustomEvent('room-photos:upload', {
    detail: { propertyId: ctx.propertyId, room: ctx.room, ...extra },
  }));

// Byte progress fires constantly; pass it on at most once per frame
let frame = 0;
const progressed = new Set();
const announceProgress = (job) => {
  progressed.add(job);
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    progressed.forEach((j) => announce(j.ctx));
    progressed.clear();
  });
};

// Closing the tab would cut uploads off, so the browser asks first
const warnOnLeave = (e) => {
  e.preventDefault();
  e.returnValue = '';
};
const syncLeaveWarning = () => {
  if (jobs.size) window.addEventListener('beforeunload', warnOnLeave);
  else window.removeEventListener('beforeunload', warnOnLeave);
};

let input = null;

/**
 * Opens the photo picker for a room; the photos chosen upload in the
 * background. Must run inside a tap or click (browsers only open pickers then).
 *
 * @param {object} ctx  { propertyId, room, roomLabel, address }
 * @param {object} [opts]
 * @param {Function} [opts.onPicked]  runs once photos are chosen, e.g. to close a dialog
 */
export function pickRoomPhotos(ctx, { onPicked } = {}) {
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif';
    input.multiple = true;
    input.hidden = true;
    document.body.appendChild(input);
  }
  input.onchange = () => {
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    onPicked?.();
    uploadRoomPhotos(ctx, files);
  };
  input.click();
}

/** Uploads photos to a room in the background (see the top of this file). */
export async function uploadRoomPhotos(ctx, fileList) {
  const images = Array.from(fileList || []).filter(isAcceptedImage);
  const files = images.filter((file) => file.size <= MAX_FILE_BYTES);
  const tooBig = images.length - files.length;
  if (!files.length) {
    toast(tooBig ? t('skippedTooBig', { count: tooBig }) : t('notImages'), 'warning');
    return;
  }

  // More photos for a room that's still uploading join the same job
  const key = keyOf(ctx.propertyId, ctx.room);
  let job = jobs.get(key);
  if (!job) {
    job = {
      ctx,
      total: 0,
      done: 0,
      failed: [], // { file, reason }
      tooBig: 0,
      fractions: [],
      photos: null, // the room's photo list after the latest save
      running: 0,
      // The link doesn't depend on the photos, so it's made now and is ready when they are
      link: roomListingService.enableShare(ctx.propertyId, ctx.room)
        .then((share) => share.shareUrl)
        .catch(() => null),
    };
    jobs.set(key, job);
    syncLeaveWarning();
  }
  const offset = job.total;
  job.total += files.length;
  job.tooBig += tooBig;
  job.fractions.push(...files.map(() => 0));
  job.running += 1;
  announce(ctx);

  try {
    await roomListingService.uploadPhotos(ctx.propertyId, ctx.room, files, {
      onFileProgress: (i, fraction) => {
        job.fractions[offset + i] = fraction;
        announceProgress(job);
      },
      onFileDone: (i, error, photos) => {
        job.fractions[offset + i] = 1;
        if (error) {
          job.failed.push({ file: files[i], reason: error.message });
        } else {
          job.done += 1;
          job.photos = photos;
        }
        announce(ctx);
      },
    });
  } catch (error) {
    // Couldn't start at all (e.g. the upload permission request failed)
    files.forEach((file, i) => {
      job.fractions[offset + i] = 1;
      job.failed.push({ file, reason: error.message });
    });
  }

  job.running -= 1;
  if (!job.running) finish(job);
}

async function finish(job) {
  const { ctx, done, failed } = job;
  jobs.delete(keyOf(ctx.propertyId, ctx.room));
  syncLeaveWarning();
  announce(ctx, { photos: job.photos });

  const retry = failed.length > 0 && {
    label: t('retry'),
    icon: 'bi-arrow-clockwise',
    onClick: () => uploadRoomPhotos(ctx, failed.map((f) => f.file)),
  };
  const reason = failed[0]?.reason;

  if (!done) {
    showRoomSnackbar({
      tone: 'error',
      title: t('failedTitle', { room: ctx.roomLabel }),
      text: reason,
      actions: [retry],
    });
    return;
  }

  const notes = [];
  if (failed.length) notes.push(t('someFailed', { count: failed.length, reason }));
  if (job.tooBig) notes.push(t('skippedTooBig', { count: job.tooBig }));
  const bar = {
    tone: failed.length ? 'warn' : 'ok',
    thumbUrl: visiblePhotos(job.photos)[0]?.thumbUrl,
    title: failed.length
      ? t('partialTitle', { done, total: done + failed.length, room: ctx.roomLabel })
      : t('addedTitle', { count: done, room: ctx.roomLabel }),
  };

  // Usually ready long ago; one more try if making it failed the first time
  const shareUrl = (await job.link)
    || (await roomListingService.enableShare(ctx.propertyId, ctx.room).then((s) => s.shareUrl).catch(() => null));
  if (!shareUrl) {
    showRoomSnackbar({ ...bar, text: [...notes, t('linkFailed')].join(' · '), actions: [retry] });
    return;
  }
  announce(ctx, { shareUrl });

  // Prices for the message sent with the link (the room's saved asking range)
  const listing = await roomListingService.getRoom(ctx.propertyId, ctx.room).catch(() => null);
  await offerRoomLink(
    {
      url: shareUrl,
      roomLabel: ctx.roomLabel,
      address: ctx.address,
      minPrice: listing?.minPrice,
      maxPrice: listing?.maxPrice,
    },
    { ...bar, notes, actions: [retry] },
  );
}
