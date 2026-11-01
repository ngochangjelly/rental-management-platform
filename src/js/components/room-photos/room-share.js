import i18next from '../../i18n.js';

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
  document.execCommand('copy');
  area.remove();
}

const toast = (message, type) => window.showToast?.(message, type);

/**
 * Hands a room link to the customer: the phone's share sheet (WhatsApp,
 * Telegram…) when available, otherwise copies a ready-to-paste message.
 */
export async function shareRoomLink({ url, roomLabel, address, minPrice, maxPrice }) {
  const price = formatPriceRange(minPrice, maxPrice);
  const title = [roomLabel, address].filter(Boolean).join(' · ');
  const text = [title, price ? `${price} / month` : null].filter(Boolean).join('\n');

  if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return; // user closed the share sheet
    }
  }

  try {
    await copyText(`${text}\n${url}`);
    toast(i18next.t('roomPhotos.linkCopied'), 'success');
  } catch {
    window.prompt(i18next.t('roomPhotos.copyManually'), url);
  }
}

export async function copyRoomLink(url) {
  try {
    await copyText(url);
    toast(i18next.t('roomPhotos.linkCopied'), 'success');
  } catch {
    window.prompt(i18next.t('roomPhotos.copyManually'), url);
  }
}
