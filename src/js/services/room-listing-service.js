/**
 * Room photos + public share links — API client.
 *
 * Photos go straight from the browser to Cloudinary with a short-lived
 * signature from our backend, then get registered with the backend. That
 * keeps the original quality and avoids the 4.5 MB request limit of our
 * serverless backend. All image URLs come back from the backend as absolute
 * CDN URLs, so nothing here differs between localhost and production.
 *
 * Every change fires a `room-listings:changed` window event
 * ({ detail: { propertyId, room } }) so any screen showing photos can refresh.
 */

const CACHE_TTL_MS = 60 * 1000;
const UPLOAD_CONCURRENCY = 3;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|heic|heif|gif|avif)$/i;

const cache = new Map(); // propertyId → { at, promise }

const endpoints = () => window.API_CONFIG.ENDPOINTS;

const readJson = async (response) => {
  let data = null;
  try {
    data = await response.json();
  } catch {
    // non-JSON error body
  }
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
  }
  return data;
};

const notifyChanged = (propertyId, room) => {
  cache.delete(propertyId);
  window.dispatchEvent(new CustomEvent('room-listings:changed', { detail: { propertyId, room } }));
};

export const isAcceptedImage = (file) =>
  file.type.startsWith('image/') || IMAGE_EXT_RE.test(file.name || '');

// Uploads one file straight to Cloudinary; resolves with Cloudinary's response
const uploadToCloudinary = (file, upload, onProgress) =>
  new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', upload.apiKey);
    form.append('timestamp', upload.timestamp);
    form.append('folder', upload.folder);
    form.append('signature', upload.signature);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', upload.uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // fall through to the error below
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.public_id) resolve(body);
      else reject(new Error(body?.error?.message || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading'));
    xhr.send(form);
  });

// Runs `worker` over `items`, at most `limit` at a time
const runPool = async (items, limit, worker) => {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  });
  await Promise.all(lanes);
};

export const roomListingService = {
  /** Rooms of a property with prices, photos and share link (cached briefly). */
  getPropertyRooms(propertyId, { fresh = false } = {}) {
    const hit = cache.get(propertyId);
    if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;

    const promise = window.API.get(endpoints().ROOM_LISTINGS_BY_PROPERTY(propertyId))
      .then(readJson)
      .then((data) => data.rooms || []);
    cache.set(propertyId, { at: Date.now(), promise });
    promise.catch(() => {
      if (cache.get(propertyId)?.promise === promise) cache.delete(propertyId);
    });
    return promise;
  },

  async getRoom(propertyId, room) {
    const rooms = await this.getPropertyRooms(propertyId);
    return rooms.find((r) => r.room === room) || null;
  },

  /**
   * Uploads files for one room. Each file reports progress through
   * `onFileProgress(index, fraction)`, then `onFileDone(index, error|null, photos)`
   * once it has been saved (photos = the room's full, updated photo list).
   */
  async uploadPhotos(propertyId, room, files, { onFileProgress, onFileDone } = {}) {
    const { upload } = await readJson(
      await window.API.post(endpoints().ROOM_UPLOAD_SIGNATURE(propertyId, room)),
    );

    // Registrations run one after another so the server never races itself
    let saveChain = Promise.resolve();
    const register = (result) => {
      saveChain = saveChain.then(async () => {
        const data = await readJson(
          await window.API.post(endpoints().ROOM_PHOTOS(propertyId, room), {
            photos: [
              {
                public_id: result.public_id,
                version: result.version,
                signature: result.signature,
                format: result.format,
                width: result.width,
                height: result.height,
                bytes: result.bytes,
              },
            ],
          }),
        );
        return data.photos;
      });
      return saveChain;
    };

    let failed = 0;
    await runPool(files, UPLOAD_CONCURRENCY, async (file, i) => {
      try {
        if (!isAcceptedImage(file)) throw new Error('Not an image file');
        if (file.size > MAX_FILE_BYTES) throw new Error('File is larger than 20 MB');
        const result = await uploadToCloudinary(file, upload, (f) => onFileProgress?.(i, f));
        const photos = await register(result);
        onFileDone?.(i, null, photos);
      } catch (error) {
        failed += 1;
        onFileDone?.(i, error, null);
      }
    });

    notifyChanged(propertyId, room);
    return { failed };
  },

  async deletePhoto(propertyId, room, photoId) {
    const data = await readJson(await window.API.delete(endpoints().ROOM_PHOTO(propertyId, room, photoId)));
    notifyChanged(propertyId, room);
    return data.photos;
  },

  /** Saves a new photo order; the first photo becomes the cover. */
  async reorderPhotos(propertyId, room, photoIds) {
    const data = await readJson(
      await window.API.put(endpoints().ROOM_PHOTOS_ORDER(propertyId, room), { photoIds }),
    );
    notifyChanged(propertyId, room);
    return data.photos;
  },

  /** Returns the room's public link, creating it the first time. */
  async enableShare(propertyId, room) {
    const data = await readJson(await window.API.post(endpoints().ROOM_SHARE(propertyId, room)));
    notifyChanged(propertyId, room);
    return { shareUrl: data.shareUrl, sharedAt: data.sharedAt };
  },

  async disableShare(propertyId, room) {
    await readJson(await window.API.delete(endpoints().ROOM_SHARE(propertyId, room)));
    notifyChanged(propertyId, room);
  },
};
