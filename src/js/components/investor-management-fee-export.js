/**
 * Management Fee exports — PNG image and plain-text summary of selected
 * investors' fee rows. Visual language follows the financial report export
 * (dark base, accent haze, Noto Serif) via the shared theme tokens.
 */
import { getModeTokens, getNeutralTokens } from "../utils/financial-report-theme.js";
import {
  formatMoney,
  formatPercent,
  formatHoldingAddress,
  summarizeFeeRows,
} from "../utils/management-fee.js";
import { svgEscape as esc, fetchImagesAsDataUris, loadReportAssets } from "../utils/report-image-export.js";

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const countLabel = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Messenger-friendly text summary.
 * @param {object[]} rows       buildManagementFeeRows output (already filtered to selection)
 * @param {object}   opts       { monthLabel, ratePer100 }
 */
export function buildFeeSummaryText(rows, { monthLabel, ratePer100 }) {
  const totals = summarizeFeeRows(rows);
  const lines = [`PHÍ QUẢN LÝ / MANAGEMENT FEE — ${monthLabel.toUpperCase()}`, `Rate: ${formatMoney(ratePer100)} per 100% share`, ""];

  rows.forEach(({ investor, holdings, totalPercentage, totalFee }) => {
    lines.push(`👤 ${investor.name} — ${formatPercent(totalPercentage)} → ${formatMoney(totalFee)}`);
    holdings.forEach((h) => {
      lines.push(`- ${h.propertyId} · ${formatHoldingAddress(h)} — ${formatPercent(h.percentage)} → ${formatMoney(h.fee)}`);
    });
    lines.push("");
  });

  lines.push("─────────────────────");
  lines.push(`💰 TOTAL: ${formatMoney(totals.totalFee)} (${countLabel(totals.investors, "investor", "investors")})`);
  return lines.join("\n");
}

/**
 * SVG report: header with rate, grand-total summary, then one section per
 * investor listing each property's share and fee plus the investor's total.
 */
export async function generateFeeReportSVG(rows, { monthLabel, ratePer100 }) {
  const [{ fontFaceStyle, logo }, avatars] = await Promise.all([
    loadReportAssets(),
    fetchImagesAsDataUris(rows.map((r) => r.investor.avatar)),
  ]);

  const mode = getModeTokens(true);
  const neutral = getNeutralTokens();
  const C = {
    base: mode.base,
    panel: mode.panel,
    accent: mode.accent,
    accentSoft: mode.accentSoft,
    colHeaderBg: mode.colHeaderBg,
    colHeaderText: mode.colHeaderText,
    summaryBg: mode.summaryBg,
    footerBg: mode.footerBg,
    text: neutral.textPrimary,
    muted: neutral.textMuted,
    brand: neutral.brand,
  };

  // Layout
  const W = 800;
  const M = 24;
  const CW = W - M * 2;
  const HEADER_H = 96;
  const SUMMARY_H = 66;
  const SEC_GAP = 14;
  const INV_H = 52;
  const THDR_H = 26;
  const ROW_H = 32;
  const FOOTER_H = 40;
  const COL = {
    id: M + 14,
    address: M + 90,
    share: W - M - 130, // right-aligned
    fee: W - M - 14, // right-aligned
  };

  const totals = summarizeFeeRows(rows);
  const nodes = [];
  const defs = [
    `<radialGradient id="bgHaze" cx="50%" cy="0%" r="90%">
      <stop offset="0%" stop-color="${C.accent}" stop-opacity="0.22"/>
      <stop offset="45%" stop-color="${C.accent}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${C.accent}" stop-opacity="0"/>
    </radialGradient>`,
    `<linearGradient id="rowDivGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${C.accentSoft}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${C.accentSoft}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${C.accentSoft}" stop-opacity="0"/>
    </linearGradient>`,
  ];
  const p = (s) => nodes.push(s);
  let y = 0;

  const avatar = (investor, cx, cy, r, clipId) => {
    const uri = investor.avatar ? avatars[investor.avatar] : null;
    if (uri) {
      defs.push(`<clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`);
      p(`<image href="${uri}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`);
    } else {
      p(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#6c757d"/>`);
      p(`<text x="${cx}" y="${cy + Math.round(r * 0.44)}" font-size="${Math.round(r * 0.95)}" font-weight="700" fill="#fff" text-anchor="middle">${esc((investor.name || "?").charAt(0).toUpperCase())}</text>`);
    }
    p(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="1.5"/>`);
  };

  // ── Header ──
  p(`<rect x="0" y="0" width="${W}" height="${HEADER_H}" fill="${C.panel}"/>`);
  let titleX = M;
  if (logo) {
    p(`<image href="${logo}" x="${M}" y="${(HEADER_H - 48) / 2}" width="48" height="48" preserveAspectRatio="xMidYMid meet"/>`);
    titleX = M + 62;
  }
  p(`<text x="${titleX}" y="44" font-size="21" font-weight="700" fill="${C.text}" letter-spacing="0.5">MANAGEMENT FEE</text>`);
  p(`<text x="${titleX}" y="68" font-size="12" fill="${C.muted}" letter-spacing="1">${esc(monthLabel.toUpperCase())}</text>`);
  p(`<text x="${W - M}" y="40" font-size="10" fill="${C.muted}" text-anchor="end" letter-spacing="1">RATE PER 100% SHARE</text>`);
  p(`<text x="${W - M}" y="66" font-size="20" font-weight="700" fill="${C.accentSoft}" text-anchor="end">${esc(formatMoney(ratePer100))}</text>`);
  p(`<rect x="0" y="${HEADER_H - 2}" width="${W}" height="2" fill="${C.brand}" opacity="0.6"/>`);
  y = HEADER_H;

  // ── Summary ──
  p(`<rect x="0" y="${y}" width="${W}" height="${SUMMARY_H}" fill="${C.summaryBg}"/>`);
  const stats = [
    { label: "INVESTORS", value: String(totals.investors), x: M, anchor: "start" },
    { label: "TOTAL SHARE", value: formatPercent(totals.totalPercentage), x: W / 2, anchor: "middle" },
    { label: "TOTAL DUE", value: formatMoney(totals.totalFee), x: W - M, anchor: "end", accent: true },
  ];
  stats.forEach((s) => {
    p(`<text x="${s.x}" y="${y + 26}" font-size="10" fill="${C.muted}" text-anchor="${s.anchor}" letter-spacing="1">${s.label}</text>`);
    p(`<text x="${s.x}" y="${y + 50}" font-size="18" font-weight="700" fill="${s.accent ? C.accentSoft : C.text}" text-anchor="${s.anchor}">${esc(s.value)}</text>`);
  });
  y += SUMMARY_H;

  // ── Investor sections ──
  rows.forEach(({ investor, holdings, totalPercentage, totalFee }, index) => {
    y += SEC_GAP;

    // Investor bar
    p(`<rect x="${M}" y="${y}" width="${CW}" height="${INV_H}" rx="8" fill="${C.panel}"/>`);
    p(`<rect x="${M}" y="${y}" width="4" height="${INV_H}" rx="2" fill="${C.accent}"/>`);
    avatar(investor, M + 32, y + INV_H / 2, 16, `av${index}`);
    p(`<text x="${M + 58}" y="${y + 23}" font-size="14" font-weight="700" fill="${C.text}">${esc(truncate(investor.name || "", 40))}</text>`);
    p(`<text x="${M + 58}" y="${y + 40}" font-size="11" fill="${C.muted}">${esc(`${countLabel(holdings.length, "property", "properties")}  ·  ${formatPercent(totalPercentage)} share`)}</text>`);
    p(`<text x="${COL.fee}" y="${y + 22}" font-size="10" fill="${C.muted}" text-anchor="end" letter-spacing="1">MONTHLY FEE</text>`);
    p(`<text x="${COL.fee}" y="${y + 41}" font-size="16" font-weight="700" fill="${C.accentSoft}" text-anchor="end">${esc(formatMoney(totalFee))}</text>`);
    y += INV_H + 4;

    // Column header
    p(`<rect x="${M}" y="${y}" width="${CW}" height="${THDR_H}" rx="4" fill="${C.colHeaderBg}"/>`);
    [
      ["ID", COL.id, "start"],
      ["PROPERTY", COL.address, "start"],
      ["SHARE", COL.share, "end"],
      ["FEE", COL.fee, "end"],
    ].forEach(([label, x, anchor]) => {
      p(`<text x="${x}" y="${y + 17}" font-size="10" font-weight="700" fill="${C.colHeaderText}" text-anchor="${anchor}" letter-spacing="1">${label}</text>`);
    });
    y += THDR_H;

    // Property rows
    holdings.forEach((h, i) => {
      const mid = y + ROW_H / 2 + 4;
      p(`<text x="${COL.id}" y="${mid}" font-size="11" fill="${C.muted}">${esc(truncate(String(h.propertyId), 10))}</text>`);
      p(`<text x="${COL.address}" y="${mid}" font-size="12" fill="${C.text}">${esc(truncate(formatHoldingAddress(h), 68))}</text>`);
      p(`<text x="${COL.share}" y="${mid}" font-size="12" fill="${C.text}" text-anchor="end">${esc(formatPercent(h.percentage))}</text>`);
      p(`<text x="${COL.fee}" y="${mid}" font-size="12" font-weight="700" fill="${C.text}" text-anchor="end">${esc(formatMoney(h.fee))}</text>`);
      if (i < holdings.length - 1) {
        p(`<rect x="${M}" y="${y + ROW_H - 0.5}" width="${CW}" height="1" fill="url(#rowDivGrad)"/>`);
      }
      y += ROW_H;
    });
  });

  // ── Footer ──
  y += SEC_GAP + 6;
  const generated = new Date().toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });
  p(`<rect x="0" y="${y}" width="${W}" height="${FOOTER_H}" fill="${C.footerBg}"/>`);
  p(`<text x="${M}" y="${y + 25}" font-size="10" fill="${C.muted}">Generated ${esc(generated)}</text>`);
  p(`<text x="${W - M}" y="${y + 25}" font-size="10" fill="${C.muted}" text-anchor="end">Fee = rate × ownership share ÷ 100</text>`);
  const H = y + FOOTER_H;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Noto Serif', serif">
    ${fontFaceStyle}
    <defs>${defs.join("")}</defs>
    <rect width="${W}" height="${H}" fill="${C.base}"/>
    <rect width="${W}" height="${H}" fill="url(#bgHaze)"/>
    ${nodes.join("")}
  </svg>`;
}
