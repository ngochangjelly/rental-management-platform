/**
 * Financial Report Theme Tokens
 *
 * Single source of truth for every color used by the financial report
 * module — the live Income/Expenses/Investor Calculations panels and
 * surrounding cards (dashboard.html + financial-reports.js), and the
 * exported report image (_generateReportSVG). Before this module existed,
 * the same "dark base + green/red haze" decisions were hand-typed in three
 * places and drifted out of sync every time one of them changed.
 *
 * How to extend:
 *   - Add a new palette object (e.g. `light`) alongside DARK_THEME below,
 *     register it in THEMES, and call `setFinancialReportTheme('light')`
 *     followed by `applyFinancialReportCSSVariables()` — every consumer
 *     that reads through the getters/CSS vars picks it up automatically,
 *     no call site elsewhere needs to change.
 *   - Never hand-write a hex/rgba color in dashboard.html or
 *     financial-reports.js for this module — add a token here instead and
 *     reference it via `var(--fr-*)` (CSS) or the getters below (JS/SVG).
 */

const DARK_THEME = {
  // Generic text/divider colors used across the module regardless of mode.
  neutral: {
    textPrimary: "#e2e8f0",
    textMuted: "#94a3b8",
    brand: "#2dd4bf",
    dividerNeutral: "rgba(255,255,255,0.08)",
  },

  // Neutral dark card surface (Month Navigation and other non profit/loss
  // cards inside the financial report tab).
  surface: {
    bg: "#141a20",
    border: "rgba(255,255,255,0.08)",
    text: "#e2e8f0",
    textMuted: "#94a3b8",
  },

  // "Pending" item state (amber) — also reused for warning-style banners
  // (Unpaid Rent Reminder) since it's the same visual language.
  pending: {
    bg: "rgba(245,158,11,0.10)",
    bgStrong: "rgba(245,158,11,0.14)",
    border: "rgba(245,158,11,0.4)",
    dividerBorder: "rgba(245,158,11,0.35)",
    text: "#fbbf24",
    badgeBg: "#f59e0b",
    badgeText: "#7c2d12",
  },

  // Alert/banner surfaces (PUB overage, unpaid rent, all-paid confirmation).
  banner: {
    danger: { bg: "rgba(239,68,68,0.12)", border: "#ef4444", text: "#f87171" },
    success: { bg: "rgba(34,197,94,0.12)", border: "#22c55e", text: "#4ade80" },
  },

  // Neutral chip (room-type badge, etc.)
  badge: {
    bg: "rgba(148,163,184,0.16)",
    text: "#cbd5e1",
  },

  // Translucent "glass" buttons (header icon buttons — export/print/etc.)
  glass: {
    bg: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.14)",
    bgHover: "rgba(255,255,255,0.14)",
    borderHover: "rgba(255,255,255,0.28)",
  },

  // Opaque per-action gradient buttons (Edit/Delete/Category/Evidence) —
  // opaque so the sticky Actions column never lets the Amount column
  // bleed through underneath during horizontal scroll.
  action: {
    secondary: { from: "#1f2937", to: "#111827", border: "#475569", text: "#cbd5e1" },
    success: { from: "#14532d", to: "#082016", border: "#22c55e", text: "#4ade80" },
    primary: { from: "#1e3a5f", to: "#0f2036", border: "#3b82f6", text: "#60a5fa" },
    danger: { from: "#4c1d1d", to: "#260d0d", border: "#ef4444", text: "#f87171" },
    info: { from: "#164e5c", to: "#0a262d", border: "#22d3ee", text: "#22d3ee" },
  },

  // Profit/loss dependent surfaces — Income is always "profit" (green),
  // Expenses is always "loss" (red); Investor Calculations and the export
  // image pick whichever matches the actual net profit sign.
  mode: {
    profit: {
      accent: "#22c55e",
      accentSoft: "#4ade80",
      base: "#0a120d",
      panel: "#0e1f16",
      hazeAlpha: 0.16,
      colHeaderBg: "#132a1d",
      colHeaderText: "#86efac",
      rowDivider: "rgba(134,239,172,0.16)",
      rowDividerFade: "rgba(134,239,172,0.14)",
      summaryBg: "#0f2419",
      footerBg: "#0a1a12",
    },
    loss: {
      accent: "#ef4444",
      accentSoft: "#f87171",
      base: "#140a0a",
      panel: "#20100f",
      hazeAlpha: 0.16,
      colHeaderBg: "#2c1414",
      colHeaderText: "#fca5a5",
      rowDivider: "rgba(252,165,165,0.16)",
      rowDividerFade: "rgba(252,165,165,0.14)",
      summaryBg: "#241010",
      footerBg: "#1c0d0d",
    },
  },
};

// Only one palette exists today; the indirection means a future light theme
// (or a per-user accent) is a new object + one line in THEMES, not a rewrite
// of every consumer.
const THEMES = { dark: DARK_THEME };
let activeThemeName = "dark";

export function setFinancialReportTheme(name) {
  if (!THEMES[name]) throw new Error(`Unknown financial report theme: ${name}`);
  activeThemeName = name;
}

export function getActiveTheme() {
  return THEMES[activeThemeName];
}

export function getModeTokens(isProfit) {
  const theme = getActiveTheme();
  return isProfit ? theme.mode.profit : theme.mode.loss;
}

export const getNeutralTokens = () => getActiveTheme().neutral;
export const getSurfaceTokens = () => getActiveTheme().surface;
export const getPendingTokens = () => getActiveTheme().pending;
export const getWarningTokens = () => getActiveTheme().pending; // alias — same amber language
export const getBannerTokens = () => getActiveTheme().banner;
export const getBadgeTokens = () => getActiveTheme().badge;
export const getGlassTokens = () => getActiveTheme().glass;
export const getActionTokens = () => getActiveTheme().action;

/** `#rrggbb` -> `rgba(r,g,b,alpha)` — lets mode haze colors derive from one accent hex. */
export function withAlpha(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * The two-layer "dark base + accent haze" background shared by every
 * profit/loss-aware surface (Income/Expenses/Investor Calculations headers
 * & bodies, exported SVG background).
 * @param {boolean} isProfit
 * @param {'header'|'body'} variant - 'header' = compact bar (brighter/
 *   tighter haze), 'body' = larger card area (softer/wider haze).
 */
export function modeBackground(isProfit, variant = "header") {
  const t = getModeTokens(isProfit);
  const haze = withAlpha(t.accent, t.hazeAlpha);
  const base = variant === "header" ? t.panel : t.base;
  const geometry =
    variant === "header"
      ? `radial-gradient(140% 160% at 100% 0%, ${haze} 0%, transparent 60%)`
      : `radial-gradient(120% 140% at 100% 0%, ${haze} 0%, transparent 55%)`;
  return `${geometry}, ${base}`;
}

/**
 * Pushes every token onto `:root` as `--fr-*` CSS custom properties, so
 * dashboard.html's markup/styles can consume `var(--fr-x)` instead of
 * duplicating literals — this module stays the only place colors are ever
 * hand-written. Call once on app init (and again after
 * `setFinancialReportTheme()` to live-switch).
 */
export function applyFinancialReportCSSVariables() {
  const root = document.documentElement.style;
  const theme = getActiveTheme();
  const set = (name, value) => root.setProperty(`--fr-${name}`, value);

  set("text-primary", theme.neutral.textPrimary);
  set("text-muted", theme.neutral.textMuted);
  set("brand", theme.neutral.brand);
  set("divider-neutral", theme.neutral.dividerNeutral);

  set("surface-bg", theme.surface.bg);
  set("surface-border", theme.surface.border);
  set("surface-text", theme.surface.text);
  set("surface-text-muted", theme.surface.textMuted);

  set("pending-bg", theme.pending.bg);
  set("pending-bg-strong", theme.pending.bgStrong);
  set("pending-border", theme.pending.border);
  set("pending-divider-border", theme.pending.dividerBorder);
  set("pending-text", theme.pending.text);
  set("pending-badge-bg", theme.pending.badgeBg);
  set("pending-badge-text", theme.pending.badgeText);

  set("banner-danger-bg", theme.banner.danger.bg);
  set("banner-danger-border", theme.banner.danger.border);
  set("banner-danger-text", theme.banner.danger.text);
  set("banner-success-bg", theme.banner.success.bg);
  set("banner-success-border", theme.banner.success.border);
  set("banner-success-text", theme.banner.success.text);

  set("badge-bg", theme.badge.bg);
  set("badge-text", theme.badge.text);

  set("glass-bg", theme.glass.bg);
  set("glass-border", theme.glass.border);
  set("glass-bg-hover", theme.glass.bgHover);
  set("glass-border-hover", theme.glass.borderHover);

  Object.entries(theme.action).forEach(([name, a]) => {
    set(`action-${name}-from`, a.from);
    set(`action-${name}-to`, a.to);
    set(`action-${name}-border`, a.border);
    set(`action-${name}-text`, a.text);
  });

  ["profit", "loss"].forEach((mode) => {
    const isProfit = mode === "profit";
    const t = getModeTokens(isProfit);
    set(`${mode}-accent`, t.accent);
    set(`${mode}-accent-soft`, t.accentSoft);
    set(`${mode}-base`, t.base);
    set(`${mode}-panel`, t.panel);
    set(`${mode}-col-header-bg`, t.colHeaderBg);
    set(`${mode}-col-header-text`, t.colHeaderText);
    set(`${mode}-row-divider`, t.rowDivider);
    set(`${mode}-row-divider-fade`, t.rowDividerFade);
    set(`${mode}-summary-bg`, t.summaryBg);
    set(`${mode}-footer-bg`, t.footerBg);
    set(`${mode}-header-bg`, modeBackground(isProfit, "header"));
    set(`${mode}-body-bg`, modeBackground(isProfit, "body"));
  });
}
