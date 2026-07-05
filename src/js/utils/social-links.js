/**
 * Social Links Utility
 * Converts social profile URLs into action links (Messenger, WhatsApp, etc.)
 * Reusable across all modules.
 */

/**
 * Detect whether a group URL is a WhatsApp link (chat.whatsapp.com, wa.me, whatsapp.com).
 */
export function isWhatsAppGroupUrl(url) {
  if (!url || typeof url !== "string") return false;
  return /(?:chat\.)?whatsapp\.com|wa\.me/i.test(url);
}

/**
 * Get display metadata (icon class, label, brand color) for a group link that
 * may be either a Facebook group or a WhatsApp group.
 */
export function getGroupLinkMeta(url) {
  if (isWhatsAppGroupUrl(url)) {
    return { icon: "bi-whatsapp", brand: "WhatsApp", color: "#25D366" };
  }
  return { icon: "bi-facebook", brand: "Facebook", color: "#1877F2" };
}

/**
 * Convert a Facebook profile URL to a Messenger link.
 * Handles formats:
 *   https://www.facebook.com/username
 *   https://www.facebook.com/profile.php?id=123456789
 *   https://m.me/username  (already a Messenger link — returned as-is)
 */
export function facebookToMessengerUrl(fbUrl) {
  if (!fbUrl || typeof fbUrl !== "string") return null;

  const url = fbUrl.trim();

  // Already a Messenger link
  if (/^https?:\/\/(www\.)?m\.me\//i.test(url)) return url;

  // facebook.com/profile.php?id=NUMERIC_ID  →  m.me/NUMERIC_ID
  const profileIdMatch = url.match(
    /facebook\.com\/profile\.php\?id=(\d+)/i,
  );
  if (profileIdMatch) {
    return `https://m.me/${profileIdMatch[1]}`;
  }

  // facebook.com/USERNAME  →  m.me/USERNAME
  const usernameMatch = url.match(
    /facebook\.com\/(?:people\/[^/?#]+\/)?([^/?#]+)/i,
  );
  if (usernameMatch) {
    const username = usernameMatch[1];
    // Skip false positives like "pg", "groups", "events", etc.
    const reserved = new Set([
      "pg", "groups", "events", "marketplace", "watch", "gaming",
      "pages", "people", "login", "sharer",
    ]);
    if (!reserved.has(username.toLowerCase())) {
      return `https://m.me/${username}`;
    }
  }

  return null;
}

/**
 * Build a WhatsApp chat URL pre-filled with a contract signing message.
 * @param {string} phoneNumber  - Raw phone string (may contain spaces, dashes, +)
 * @param {string} tenantName   - Tenant's name for personalisation
 * @returns {string|null}
 */
export function buildWhatsAppSignContractUrl(phoneNumber, tenantName = "") {
  if (!phoneNumber) return null;

  const rawDigits = phoneNumber.replace(/[^0-9]/g, "");
  if (!rawDigits) return null;

  // Local SG mobile numbers are stored without a country code — without it,
  // wa.me can't resolve the exact contact and silently drops the ?text= param.
  const digits =
    rawDigits.length === 8 && /^[893]/.test(rawDigits)
      ? "65" + rawDigits
      : rawDigits;

  const message = buildSignContractMessage(tenantName);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Build a Messenger URL pre-filled with a contract signing message.
 * Note: Messenger deep-links do not support pre-filled text natively,
 * so this returns the chat link only (user must type manually).
 * @param {string} fbUrl  - Facebook profile URL
 * @returns {string|null}
 */
export function buildMessengerSignContractUrl(fbUrl) {
  return facebookToMessengerUrl(fbUrl);
}

/**
 * Compose the contract signing message sent via WhatsApp / Messenger.
 */
export function buildSignContractMessage(tenantName = "") {
  const greeting = tenantName ? `Hi ${tenantName},\n\n` : "Hi,\n\n";
  return (
    greeting +
    "Please find the rental contract attached. Kindly sign it and send the signed PDF back to us at your earliest convenience.\n\n" +
    "Thank you!"
  );
}

/**
 * Render social action badges HTML for a tenant.
 * Returns an HTML string with Facebook, Messenger and WhatsApp badges.
 *
 * @param {object} tenant - tenant object with optional facebookUrl and phoneNumber
 * @param {object} [opts]
 * @param {string} [opts.size]  - 'sm' | 'md' (default 'sm')
 * @returns {string} HTML string
 */
export function renderTenantSocialBadges(tenant, { size = "sm" } = {}) {
  if (!tenant) return "";

  const parts = [];
  const badgeClass = size === "md" ? "badge fs-6 px-3 py-2" : "badge";

  if (tenant.facebookUrl) {
    const escaped = escapeHtml(tenant.facebookUrl);
    parts.push(
      `<a href="${escaped}" target="_blank" rel="noopener noreferrer"
          class="${badgeClass} bg-primary text-white text-decoration-none"
          title="View Facebook Profile">
        <i class="bi bi-facebook me-1"></i>Facebook
      </a>`,
    );

    const messengerUrl = facebookToMessengerUrl(tenant.facebookUrl);
    if (messengerUrl) {
      const escapedMsg = escapeHtml(messengerUrl);
      parts.push(
        `<a href="${escapedMsg}" target="_blank" rel="noopener noreferrer"
            class="${badgeClass} text-white text-decoration-none"
            style="background:#0084ff;"
            title="Send Messenger message (type your message in the chat)">
          <i class="bi bi-messenger me-1"></i>Messenger
        </a>`,
      );
    }
  }

  if (tenant.phoneNumber) {
    const waUrl = buildWhatsAppSignContractUrl(tenant.phoneNumber, tenant.name);
    if (waUrl) {
      const escaped = escapeHtml(waUrl);
      parts.push(
        `<a href="${escaped}" target="_blank" rel="noopener noreferrer"
            class="${badgeClass} bg-success text-white text-decoration-none"
            title="Send WhatsApp message asking to sign contract">
          <i class="bi bi-whatsapp me-1"></i>WhatsApp
        </a>`,
      );
    }
  }

  return parts.join("\n");
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
