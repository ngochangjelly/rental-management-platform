import i18next from '../../i18n.js';
import { roomListingService } from '../../services/room-listing-service.js';
import { showRoomSnackbar } from './room-snackbar.js';

// Texts end up in the bottom bar or a toast, which escape them, so i18next must not
const t = (key, opts) => i18next.t(`roomPhotos.${key}`, { ...opts, interpolation: { escapeValue: false } });
const toast = (message, type) => window.showToast?.(message, type);

/** "S$900 – S$1,100", "S$1,000", or null when no price is set. */
export function formatPriceRange(minPrice, maxPrice) {
  const min = Number(minPrice) || 0;
  const max = Number(maxPrice) || 0;
  const hi = Math.max(min, max);
  if (!hi) return null;
  const lo = Math.min(min || max, max || min);
  const money = (n) => `S$${Math.round(n).toLocaleString('en-SG')}`;
  return lo === hi ? money(hi) : `${money(lo)} – ${money(hi)}`;
}

// Title "Common 1 · 12 Foo St" and the message sent with the link
const buildMessage = ({ roomLabel, address, minPrice, maxPrice }) => {
  const price = formatPriceRange(minPrice, maxPrice);
  const title = [roomLabel, address].filter(Boolean).join(' · ');
  const text = [title, price ? `${price} / month` : null].filter(Boolean).join('\n');
  return { title, text };
};

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;opacity:0;';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('Copy failed');
}

/** Phones hand links to the share sheet (WhatsApp, Telegram…); computers copy them. */
export const usesShareSheet = () =>
  Boolean(navigator.share) && window.matchMedia('(pointer: coarse)').matches;

/**
 * Hands a room link to the customer: the phone's share sheet when available,
 * otherwise copies a ready-to-paste message. Call it inside a tap.
 */
export async function shareRoomLink({ url, roomLabel, address, minPrice, maxPrice }) {
  const { title, text } = buildMessage({ roomLabel, address, minPrice, maxPrice });

  if (usesShareSheet()) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return; // user closed the share sheet
    }
  }

  try {
    await copyText(`${text}\n${url}`);
    toast(t('linkCopied'), 'success');
  } catch {
    window.prompt(t('copyManually'), url);
  }
}

// Copies the message without a tap. Chrome allows that; Safari and Firefox
// only right after a tap, so this just reports whether it worked.
async function tryCopyWithoutTap(info) {
  if (!navigator.clipboard?.writeText || !document.hasFocus()) return false;
  try {
    await navigator.clipboard.writeText(`${buildMessage(info).text}\n${info.url}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Bottom bar offering a room's link: copies it right away when the browser
 * allows, and always has a Share (phones) / Copy link (computers) button.
 *
 * @param {object} info  { url, roomLabel, address, minPrice, maxPrice }
 * @param {object} bar   { title, thumbUrl, notes: string[], tone, actions: extra buttons before Share }
 */
export async function offerRoomLink(info, { title, thumbUrl, notes = [], tone = 'ok', actions = [] }) {
  const copied = await tryCopyWithoutTap(info);
  const sheet = usesShareSheet();
  showRoomSnackbar({
    tone,
    thumbUrl,
    title,
    text: [...notes, t(copied ? 'linkCopiedHint' : 'linkReadyHint')].join(' · '),
    actions: [
      ...actions,
      {
        label: t(sheet ? 'share' : 'copyLink'),
        icon: sheet ? 'bi-share' : 'bi-clipboard',
        primary: true,
        onClick: () => shareRoomLink(info),
      },
    ],
  });
}

/**
 * Share button of a room. Instant when the room's link is already known;
 * otherwise the link is made first and offered in the bottom bar (the tap
 * may have expired by then, and share sheets need a fresh one).
 *
 * @param {object} opts  { propertyId, room, roomLabel, address, listing }
 */
export async function shareRoom({ propertyId, room, roomLabel, address, listing }) {
  const info = { roomLabel, address, minPrice: listing?.minPrice, maxPrice: listing?.maxPrice };
  if (listing?.shareUrl) {
    await shareRoomLink({ ...info, url: listing.shareUrl });
    return;
  }
  try {
    const { shareUrl } = await roomListingService.enableShare(propertyId, room);
    await offerRoomLink(
      { ...info, url: shareUrl },
      { title: t('linkReadyTitle', { room: roomLabel }), thumbUrl: listing?.photos?.[0]?.thumbUrl },
    );
  } catch (error) {
    toast(error.message, 'error');
  }
}
