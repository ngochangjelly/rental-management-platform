/**
 * Shared helper for the small overlapping investor-avatar stack used as a
 * badge overlay on property preview card images across the dashboard.
 */

let _investorsPromise = null;

const escapeHtml = (str) =>
  String(str ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );

/**
 * Fetch (and cache for the session) the full investor list, including each
 * investor's linked `properties`, so property cards can look up their owners.
 */
export function fetchInvestorsForAvatarStack(force = false) {
  if (_investorsPromise && !force) return _investorsPromise;
  _investorsPromise = (async () => {
    try {
      const response = await API.get(API_CONFIG.ENDPOINTS.INVESTORS);
      const result = await response.json();
      if (result?.success === false) return [];
      return result.data || result.investors || (Array.isArray(result) ? result : []);
    } catch (error) {
      console.error("Failed to load investors for avatar stack:", error);
      return [];
    }
  })();
  return _investorsPromise;
}

/** Deterministic two-stop gradient (CSS `stop, stop` pair) so the same investor always gets the same color. */
export function avatarGradientColors(seed) {
  const palette = [
    "#6f42c1,#9d4edd", "#0d6efd,#6ea8fe", "#198754,#57cc99",
    "#fd7e14,#ffb26b", "#d63384,#ff8fab", "#20c997,#63e6be",
    "#0dcaf0,#66d9ef", "#dc3545,#ff6b6b",
  ];
  let hash = 0;
  const s = String(seed || "");
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

/** Overlapping avatar circles for the investors tied to a property. */
export function renderInvestorAvatarStack(investors, propertyId, { size = 26, overlap = 10, max = 4 } = {}) {
  const owners = (investors || []).filter(
    (inv) => Array.isArray(inv.properties) && inv.properties.some((pr) => pr.propertyId === propertyId),
  );
  if (owners.length === 0) return "";

  const visible = owners.slice(0, max);
  const extra = owners.length - visible.length;
  const fontSize = Math.max(9, Math.round(size * 0.38));

  const circles = visible
    .map((inv, i) => {
      const initials = (inv.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
      const inner = inv.avatar
        ? `<img src="${inv.avatar}" style="width:100%;height:100%;object-fit:cover;" alt="${escapeHtml(inv.name)}">`
        : `<span style="color:#fff;font-weight:700;font-size:${fontSize}px;">${initials}</span>`;
      const bg = inv.avatar ? "" : `background:linear-gradient(135deg,${avatarGradientColors(inv.investorId)});`;
      return `
        <div title="${escapeHtml(inv.name)}" style="
          width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.1);
          margin-left:${i === 0 ? 0 : -overlap}px;position:relative;z-index:${visible.length - i};${bg}">
          ${inner}
        </div>`;
    })
    .join("");

  const overflowBadge =
    extra > 0
      ? `<div style="
          width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.1);
          margin-left:${-overlap}px;position:relative;z-index:0;
          background:#e9ecef;color:#495057;font-weight:700;font-size:${fontSize}px;">+${extra}</div>`
      : "";

  return `<div class="d-flex align-items-center" style="flex-shrink:0;" title="${owners.length} investor${owners.length === 1 ? "" : "s"}">${circles}${overflowBadge}</div>`;
}

/** Absolute-positioned badge wrapper for the top-right corner of a property image overlay. */
export function renderPropertyImageAvatarBadge(investors, propertyId, opts = {}) {
  const stack = renderInvestorAvatarStack(investors, propertyId, opts);
  if (!stack) return "";
  return `<div class="position-absolute top-0 end-0 p-1" style="z-index:3;">${stack}</div>`;
}
