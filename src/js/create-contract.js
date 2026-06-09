/**
 * Public Contract Creator — no authentication required.
 * Client-side only: data stored in localStorage, PDF generated with jsPDF.
 */

import {
  formatDate,
  formatDateForFilename,
  formatRoomType,
  formatPaymentMethod,
  formatMonthsText,
  formatLeasePeriod,
  formatTenancyPeriod,
  calculateTotalRental,
  hasAircon,
  numberToWords,
  getSection1BaseClauseTexts,
  buildSection2Clauses,
} from "./components/contract-clauses.js";
import { jsPDF } from "jspdf";

// ─── Signature Pad ────────────────────────────────────────────────────────────

class SignaturePad {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.drawing = false;
    this.lastPoint = null;
    this._initCtx();
    this._bindEvents();
  }

  _initCtx() {
    this.ctx.strokeStyle = "#000";
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
  }

  _getPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  }

  _start(e) {
    e.preventDefault();
    this.drawing = true;
    this.lastPoint = this._getPoint(e);
  }

  _move(e) {
    if (!this.drawing) return;
    e.preventDefault();
    const pt = this._getPoint(e);
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
    this.ctx.lineTo(pt.x, pt.y);
    this.ctx.stroke();
    this.lastPoint = pt;
  }

  _end() {
    this.drawing = false;
  }

  _bindEvents() {
    const c = this.canvas;
    c.addEventListener("mousedown", this._start.bind(this));
    c.addEventListener("mousemove", this._move.bind(this));
    c.addEventListener("mouseup", this._end.bind(this));
    c.addEventListener("mouseleave", this._end.bind(this));
    c.addEventListener("touchstart", this._start.bind(this), { passive: false });
    c.addEventListener("touchmove", this._move.bind(this), { passive: false });
    c.addEventListener("touchend", this._end.bind(this));
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  isEmpty() {
    const d = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    return !Array.prototype.some.call(d, (v) => v !== 0);
  }

  toDataURL() {
    return this.canvas.toDataURL("image/png");
  }
}

// ─── Toast helper ─────────────────────────────────────────────────────────────

const TOAST_ICONS = { success: "bi-check-circle-fill", error: "bi-x-circle-fill", warning: "bi-exclamation-triangle-fill", info: "bi-info-circle-fill" };

function showToast(msg, type = "info", duration = 3000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `toast-item ${type}`;
  el.innerHTML = `<i class="bi ${TOAST_ICONS[type] || TOAST_ICONS.info} t-icon"></i><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.25s, transform 0.25s";
    el.style.opacity = "0";
    el.style.transform = "translateX(20px)";
    setTimeout(() => el.remove(), 260);
  }, duration);
}

// ─── Ripple effect ─────────────────────────────────────────────────────────────

function addRipple(btn) {
  btn.addEventListener("pointerdown", (e) => {
    const rect = btn.getBoundingClientRect();
    const r = document.createElement("span");
    const size = Math.max(rect.width, rect.height) * 2;
    r.className = "ripple";
    r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px;`;
    btn.appendChild(r);
    setTimeout(() => r.remove(), 520);
  });
}

// ─── OneMap address lookup ────────────────────────────────────────────────────

async function lookupPostcode(postcode) {
  const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(postcode)}&returnGeom=N&getAddrDetails=Y&pageNum=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OneMap API error ${res.status}`);
  const data = await res.json();
  return (data.results || []).map((r) => ({
    address: r.ADDRESS || "",
    block: r.BLK_NO || "",
    road: r.ROAD_NAME || "",
    building: r.BUILDING || "",
    postal: r.POSTAL || postcode,
  }));
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

const LS_KEY = "publicContractDraft";
const LS_DRAFTS_KEY = "publicContractDrafts";
const MAX_SAVED_DRAFTS = 15;

function saveDraft(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...state, _savedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildDraftName(state) {
  const tA = state.tenantA?.name?.trim();
  const bNames = (state.tenantsB || []).map((t) => t.name?.trim()).filter(Boolean);
  const unit = state.unit?.trim();
  const postcode = state.postcode?.trim();

  const tenants = [tA, ...bNames].filter(Boolean).join(" & ");
  const location = [unit && `#${unit.replace(/^#/, "")}`, postcode].filter(Boolean).join(" · ");
  if (tenants && location) return `${tenants} · ${location}`;
  if (tenants) return tenants;
  if (location) return location;
  return "Bản nháp";
}

// Safe clause letter: a–z, then aa, ab… handles any index
function clauseLetter(n) {
  let s = "";
  n++;
  while (n > 0) {
    s = String.fromCharCode(96 + (n % 26 || 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Identity key: postcode + unit + tenantA name + all tenantB names
function buildDraftKey(state) {
  const bNames = (state.tenantsB || []).map((t) => t.name?.trim()).filter(Boolean).join(",");
  return [
    state.postcode?.trim() || "",
    state.unit?.trim() || "",
    state.tenantA?.name?.trim() || "",
    bNames,
  ].join("|");
}

// All four identity fields must be filled to qualify for saving
function isDraftSaveable(state) {
  const hasPostcode = Boolean(state.postcode?.trim());
  const hasUnit = Boolean(state.unit?.trim());
  const hasTenantA = Boolean(state.tenantA?.name?.trim());
  const hasTenantB = (state.tenantsB || []).some((t) => t.name?.trim());
  return hasPostcode && hasUnit && hasTenantA && hasTenantB;
}

function isDraftKeyEmpty(key) {
  return !key.replace(/\|/g, "").trim();
}

// Upsert by session ID — same editing session always updates the same entry
function upsertNamedDraft(state, sessionId) {
  // Only save tenant B rows that have a name — ignore empty rows
  const saveState = {
    ...state,
    tenantsB: (state.tenantsB || []).filter((t) => t.name?.trim()),
  };
  if (!isDraftSaveable(saveState)) return false;
  const key = buildDraftKey(saveState);
  try {
    const drafts = loadNamedDrafts();
    // Match by session ID first (stable across key changes), then fall back to key
    let idx = sessionId ? drafts.findIndex((d) => d.sessionId === sessionId) : -1;
    if (idx < 0) idx = drafts.findIndex((d) => d.key === key);
    const entry = {
      id: idx >= 0 ? drafts[idx].id : Date.now().toString(36),
      sessionId: sessionId || (idx >= 0 ? drafts[idx].sessionId : Date.now().toString(36)),
      key,
      name: buildDraftName(saveState),
      savedAt: new Date().toISOString(),
      state: saveState,
    };
    if (idx >= 0) {
      drafts[idx] = entry; // update in-place, keep list position
    } else {
      drafts.unshift(entry);
      if (drafts.length > MAX_SAVED_DRAFTS) drafts.splice(MAX_SAVED_DRAFTS);
    }
    localStorage.setItem(LS_DRAFTS_KEY, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}

function loadNamedDrafts() {
  try {
    const raw = localStorage.getItem(LS_DRAFTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function deleteNamedDraft(id) {
  try {
    const drafts = loadNamedDrafts().filter((d) => d.id !== id);
    localStorage.setItem(LS_DRAFTS_KEY, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}

function relativeTime(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(isoStr).toLocaleDateString("vi-VN");
}

// ─── PDF filename builder ─────────────────────────────────────────────────────

function buildFilename(state) {
  const unit = (state.unit || "").replace(/[^a-zA-Z0-9#-]/g, "_");
  const tenantB = (state.tenantsB || [])
    .map((t) => t.name || "")
    .filter(Boolean)
    .join("_")
    .replace(/[^a-zA-Z0-9_]/g, "_") || "TenantB";
  const room = formatRoomType(state.room).replace(/[^a-zA-Z0-9]/g, "_");
  const rent = state.monthlyRental || "0";
  const mi = formatDateForFilename(state.moveInDate);
  const mo = formatDateForFilename(state.moveOutDate);
  const dateRange = mi && mo ? `${mi}-${mo}` : mi || mo || "";
  let addr = (state.address || "Address")
    .replace(/,?\s*Singapore\s*\d*/i, "")
    .replace(/,?\s*\d{6}$/, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 40);
  const parts = [];
  if (unit) parts.push(unit);
  parts.push(tenantB, room, rent);
  if (dateRange) parts.push(dateRange);
  parts.push(addr);
  return `${parts.join("-")}.pdf`;
}

// ─── PDF generator ────────────────────────────────────────────────────────────

async function generatePDF(state) {
  const pdf = new jsPDF("p", "mm", "a4");

  // Load NotoSerif for full Unicode support
  const loadFont = async (path) => {
    const buf = await (await fetch(path)).arrayBuffer();
    const bytes = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  };
  const [regB64, boldB64] = await Promise.all([
    loadFont("/fonts/NotoSerif-Regular.ttf"),
    loadFont("/fonts/NotoSerif-Bold.ttf"),
  ]);
  pdf.addFileToVFS("NotoSerif-Regular.ttf", regB64);
  pdf.addFont("NotoSerif-Regular.ttf", "NotoSerif", "normal");
  pdf.addFileToVFS("NotoSerif-Bold.ttf", boldB64);
  pdf.addFont("NotoSerif-Bold.ttf", "NotoSerif", "bold");
  pdf.setFont("NotoSerif", "normal");

  const pageW = 210, pageH = 297, margin = 20;
  const contentW = pageW - margin * 2;
  let y = margin;
  const lh = 5;

  const addText = (text, opts = {}) => {
    if (!text || String(text).trim() === "") {
      y += opts.spacing || 0;
      return;
    }
    const fs = opts.fontSize || 10;
    const bold = opts.bold || false;
    const center = opts.center || false;
    const leftX = opts.indent ? margin + 10 : margin;

    pdf.setFontSize(fs);
    pdf.setFont("NotoSerif", bold ? "bold" : "normal");

    if (y > pageH - margin - 20) { pdf.addPage(); y = margin; }

    const maxW = contentW - (opts.indent ? 10 : 0);
    const lines = pdf.splitTextToSize(String(text), maxW);
    for (const line of lines) {
      if (y > pageH - margin - 20) { pdf.addPage(); y = margin; }
      if (center) {
        pdf.text(line, (pageW - pdf.getTextWidth(line)) / 2, y);
      } else {
        pdf.text(line, leftX, y);
      }
      y += lh;
    }
    y += opts.spacing || 0;
  };

  const addPageNumbers = () => {
    const total = pdf.internal.getNumberOfPages();
    const fs = pdf.internal.getFontSize();
    const fnt = pdf.internal.getFont();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.setFont("NotoSerif", "normal");
      const txt = String(i);
      pdf.text(txt, (pageW - pdf.getTextWidth(txt)) / 2, pageH - 10);
    }
    pdf.setFontSize(fs);
    pdf.setFont(fnt.fontName, fnt.fontStyle);
  };

  // ── Derive display data ────────────────────────────────────────────────────
  const unit = state.unit || "";
  let cleanAddr = (state.address || "[Property Address]");
  if (unit) {
    const suffix = `, ${unit}`;
    if (cleanAddr.endsWith(suffix)) cleanAddr = cleanAddr.slice(0, -suffix.length).trim();
  }
  const propertyAddr = unit ? `${unit}, ${cleanAddr}` : cleanAddr;

  const tenantAInfo = {
    name: state.tenantA?.name || "[Tenant A Name]",
    fin: state.tenantA?.fin || "",
    passport: state.tenantA?.passport || "",
    email: state.tenantA?.email || "",
  };
  const tenantBList = (state.tenantsB || []).length > 0
    ? state.tenantsB.map((t) => ({ name: t.name || "[Tenant B Name]", fin: t.fin || "", passport: t.passport || "" }))
    : [{ name: "[Tenant B Name]", fin: "", passport: "" }];

  // ── Header ─────────────────────────────────────────────────────────────────
  addText("HOUSE SHARING AGREEMENT", { fontSize: 16, bold: true, center: true, spacing: 10 });
  addText(`Full address: ${propertyAddr}`, { center: true });
  addText(`Room: ${formatRoomType(state.room)}`, { center: true });
  addText(`THIS AGREEMENT is made on: ${state.agreementDate || new Date().toISOString().split("T")[0]}`, { center: true, spacing: 15 });

  // ── Parties ────────────────────────────────────────────────────────────────
  addText("BETWEEN", { bold: true, spacing: 5 });
  addText(`Main tenant: ${tenantAInfo.name}`, { indent: true });
  if (tenantAInfo.passport) addText(`Passport: ${tenantAInfo.passport}`, { indent: true });
  if (tenantAInfo.fin) addText(`FIN: ${tenantAInfo.fin}`, { indent: true });
  if (tenantAInfo.email) addText(`Email: ${tenantAInfo.email}`, { indent: true });
  if (state.showSettlementAccounts) {
    const sgd = state.settlementSgd || {};
    const vnd = state.settlementVnd || {};
    const hasSgd = sgd.bankName || sgd.accountNumber || sgd.accountHolderName;
    const hasVnd = vnd.bankName || vnd.accountNumber || vnd.accountHolderName;
    if (hasSgd || hasVnd) {
      addText("Settlement Accounts:", { indent: true, bold: true });
      if (hasSgd) {
        const parts = [sgd.bankName && `Bank: ${sgd.bankName}`, sgd.accountHolderName && `Name: ${sgd.accountHolderName}`, sgd.accountNumber && `Account No: ${sgd.accountNumber}`].filter(Boolean);
        addText(`SGD — ${parts.join(", ")}`, { indent: true, fontSize: 9 });
      }
      if (hasVnd) {
        const parts = [vnd.bankName && `Bank: ${vnd.bankName}`, vnd.accountHolderName && `Name: ${vnd.accountHolderName}`, vnd.accountNumber && `Account No: ${vnd.accountNumber}`].filter(Boolean);
        addText(`VND — ${parts.join(", ")}`, { indent: true, fontSize: 9 });
      }
    }
  }
  addText(
    "(Hereinafter called \"TenantA\" which expresses together where the context so admits, shall include all persons having title under 'TenantA') of the one part.",
    { indent: true, spacing: 10 },
  );

  addText("AND", { bold: true, spacing: 5 });
  for (let i = 0; i < tenantBList.length; i++) {
    const tb = tenantBList[i];
    const last = i === tenantBList.length - 1;
    if (tenantBList.length > 1) addText(`Tenant ${i + 1}:`, { indent: true, bold: true, spacing: 2 });
    addText(`Name: ${tb.name}`, { indent: true });
    if (tb.passport) addText(`Passport: ${tb.passport}`, { indent: true });
    if (tb.fin) addText(`FIN: ${tb.fin}`, { indent: true, spacing: last ? 0 : 5 });
    else if (!last) addText("", { spacing: 5 });
  }
  addText(
    "(Hereinafter called \"Tenant B\", which expresses together with where the context so admits, shall include all persons having title under ' Tenant B') of the one part.",
    { indent: true, spacing: 10 },
  );

  addText(`Payment method: ${formatPaymentMethod(state.paymentMethod)}`, { spacing: 10 });

  // ── Agreement terms ────────────────────────────────────────────────────────
  addText("NOW IT IS HEREBY AGREED AS FOLLOWS:", { bold: true, spacing: 8 });
  addText(`Lease Period: ${formatLeasePeriod(state)}`, { bold: true, spacing: 8 });
  addText(`Tenancy Period: ${formatTenancyPeriod(state)}`, { bold: true, spacing: 8 });
  addText("Moving Time: Move in after 15:00, Move out before 11:00", { bold: true, spacing: 8 });

  addText(`Monthly Rental: $${state.monthlyRental || "[Monthly Rental]"}`, { bold: true, spacing: 5 });
  addText("*Room rental rate is strictly confidential", { fontSize: 9, indent: true });
  addText("*Renewal contract is subject to mutual agreement by Tenant A and Tenant B", { fontSize: 9, indent: true });
  addText('*Payable by the 1st Day of each calendar month to "Tenant A"', {
    fontSize: 9, indent: true, spacing: state.fullPaymentReceived ? 0 : 8,
  });
  if (state.fullPaymentReceived) {
    addText(
      `*Tenant A hereby confirms receipt of full rental payment for the entire tenancy period (S$${calculateTotalRental(state).toFixed(2)})`,
      { fontSize: 12, bold: true, indent: true, spacing: 8 },
    );
  }

  addText(
    `Security Deposit: $${state.securityDeposit || state.monthlyRental || "[Security Deposit]"}${state.partialDepositReceived && state.partialDepositAmount ? ` (Partial deposit received: $${state.partialDepositAmount})` : ""}`,
    { bold: true, spacing: 5 },
  );
  addText("*This deposit shall not be utilised to set off rent due and payable during the currency of this Agreement", {
    fontSize: 9, indent: true, spacing: 10,
  });
  addText("Monthly rentals include Wi-Fi, utilities, gas, usage of condominium facilities such as swimming pool, barbequepit and multi-purpose hall.", {
    fontSize: 9, spacing: 10,
  });

  // ── Section 1 ──────────────────────────────────────────────────────────────
  addText("1. TENANT B(S) HEREBY AGREE(S) WITH TENANT A AS FOLLOWS:", { bold: true, fontSize: 12, spacing: 10 });

  const section1Clauses = [];
  if (!state.fullPaymentReceived) {
    const depText = formatMonthsText(state.depositMonths || 1);
    const advText = formatMonthsText(state.advanceMonths || 1);
    const agDate = state.agreementDate ? formatDate(state.agreementDate) : "[Agreement Date]";
    const miDate = state.moveInDate ? formatDate(state.moveInDate) : "[Move-in Date]";
    section1Clauses.push(
      `a) To pay the equivalent of ${depText}'s rent as a deposit on the agreement date (${agDate}) and ${advText}'s rent as an advance on the move-in date (${miDate}). The deposit is to be held by TenantA as security for the due performance and observance by TenantB of all covenants, conditions, and stipulations on the part of Tenant B herein contained, failing which TenantB shall forfeit to TenantA the said deposit or such part thereof as may be necessary to remedy such default.`,
      "b) In addition, and without prejudice to any other right power or remedy of Tenant A if the rent hereby reserved or any part thereof shall remain unpaid for 7 (SEVEN) days after the same shall have become due then, Tenant A shall forfeit the security deposit and at anytime thereafter, repossess The Room and remove all Tenant B's belongings from The Room without being liable for any loss or damage of such removal.",
    );
  }

  const baseClauseTexts = getSection1BaseClauseTexts({ ...state, pestControlClause: true });
  let clauseOffset = 0;
  baseClauseTexts.forEach((text, idx) => {
    const isAircon = text.includes("air-conditioner servicing");
    if (isAircon && !hasAircon(state.room)) { clauseOffset = 1; return; }
    const li = state.fullPaymentReceived ? idx - clauseOffset : idx + 2 - clauseOffset;
    section1Clauses.push(`${clauseLetter(li)}) ${text}`);
  });

  section1Clauses.forEach((c) => addText(c, { indent: true, spacing: 3 }));
  y += 15;

  // ── Section 2 ──────────────────────────────────────────────────────────────
  addText("2) AND PROVIDED ALWAYS AS IT IS HEREBY AGREED AS FOLLOWS:", { bold: true, fontSize: 12, spacing: 10 });
  const section2Clauses = buildSection2Clauses(state);
  section2Clauses.forEach((c) => addText(c, { indent: true, spacing: 5 }));

  y += 20;

  // ── Signature section ──────────────────────────────────────────────────────
  if (y + 80 > pageH - margin) { pdf.addPage(); y = margin; }

  addText("By signing below, both parties agree to abide by all the above terms and conditions", {
    bold: true, center: true, spacing: 15,
  });

  const sigH = 20;
  try {
    if (state.signatureA) {
      await addImgToPDF(pdf, state.signatureA, 30, y, 60, sigH);
    }
  } catch (e) {
    console.warn("Could not add signature to PDF:", e);
  }
  y += sigH + 15;

  pdf.setFontSize(12);
  pdf.text("Tenant A", 30, y);
  pdf.text("Tenant B", 120, y);
  y += 10;
  pdf.setFontSize(10);
  pdf.text(tenantAInfo.name, 30, y);
  let tbY = y;
  tenantBList.forEach((tb) => { pdf.text(tb.name, 120, tbY); tbY += 5; });

  addPageNumbers();
  return pdf;
}

async function addImgToPDF(pdf, src, x, y, w, h) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = w * 4;
        canvas.height = h * 4;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.8), "JPEG", x, y, w, h);
        resolve();
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = src;
  });
}

// ─── Main controller ──────────────────────────────────────────────────────────

class PublicContractCreator {
  constructor() {
    this.signaturePad = null;
    this.signatureDataURL = null; // final resolved signature (draw or upload)
    this.tenantsB = []; // array of { name, fin, passport }
    this._sessionId = Date.now().toString(36); // stable ID for current editing session
    this._init();
  }

  _init() {
    this._setupSignature();
    this._setupTenantB();
    this._setupPostcode();
    this._setupActions();
    this._setupAutoSave();
    this._setupSettlementToggle();
    this._setupAdditionalOptionsChevron();
    this._setupRipples();
    this._setupFieldFillTracking();
    this._setupAutoLeasePeriod();
    this._syncToggleRowsFromState();

    // Try to restore last draft automatically
    const draft = loadDraft();
    if (draft) this._restoreState(draft);

    // Set today after restore so empty date always shows today
    this._setDefaultDates();
    this._renderPreview();
    this._updateProgress();
  }

  // ── Defaults ────────────────────────────────────────────────────────────────
  _setDefaultDates() {
    const today = new Date().toISOString().split("T")[0];
    const el = document.getElementById("ccAgreementDate");
    if (el && !el.value) el.value = today;
  }

  // ── Signature ───────────────────────────────────────────────────────────────
  _setupSignature() {
    const canvas = document.getElementById("signaturePadCanvas");
    // Size canvas to its CSS container
    canvas.width = 400;
    canvas.height = 140;
    this.signaturePad = new SignaturePad(canvas);

    // Tab switching
    document.querySelectorAll("#sigTabs .nav-link").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll("#sigTabs .nav-link").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const which = tab.dataset.tab;
        document.getElementById("sigTabDraw").style.display = which === "draw" ? "" : "none";
        document.getElementById("sigTabUpload").style.display = which === "upload" ? "" : "none";
      });
    });

    // Clear button
    document.getElementById("clearSigBtn").addEventListener("click", () => {
      this.signaturePad.clear();
      this.signatureDataURL = null;
      this._updateSigIndicator(false);
      const hint = document.getElementById("sigHint");
      if (hint) hint.classList.remove("hidden");
    });

    // Helper: read file input into dataURL
    const readSigFile = (input) => {
      input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.signatureDataURL = ev.target.result;
          this._drawDataURLToCanvas(this.signatureDataURL);
          this._updateSigIndicator(true);
          this._renderPreview();
        };
        reader.readAsDataURL(file);
        // Reset so same file can be re-selected
        input.value = "";
      });
    };
    readSigFile(document.getElementById("ccSigUpload"));
    readSigFile(document.getElementById("ccSigCamera"));

    // Button triggers for gallery and camera
    document.getElementById("ccSigUploadBtn").addEventListener("click", () => {
      document.getElementById("ccSigUpload").click();
    });
    document.getElementById("ccSigCameraBtn").addEventListener("click", () => {
      document.getElementById("ccSigCamera").click();
    });

    // Signing state — add glow border, hide hint
    const hint = document.getElementById("sigHint");
    const markSigning = () => canvas.classList.add("signing");
    const onStrokeEnd = () => {
      this._captureDrawnSig();
      if (hint && !this.signaturePad.isEmpty()) hint.classList.add("hidden");
    };
    canvas.addEventListener("mousedown", markSigning);
    canvas.addEventListener("touchstart", markSigning, { passive: true });
    canvas.addEventListener("mouseup", onStrokeEnd);
    canvas.addEventListener("touchend", onStrokeEnd);
  }

  _captureDrawnSig() {
    if (!this.signaturePad.isEmpty()) {
      this.signatureDataURL = this.signaturePad.toDataURL();
      this._updateSigIndicator(true);
      this._renderPreview();
    }
  }

  _updateSigIndicator(visible) {
    const el = document.getElementById("sigIndicator");
    if (el) el.style.display = visible ? "" : "none";
  }

  // Draw an image dataURL onto the signature canvas (for uploads and draft restore)
  _drawDataURLToCanvas(dataURL) {
    if (!dataURL) return;
    const canvas = document.getElementById("signaturePadCanvas");
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.85;
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    };
    img.src = dataURL;
    const hint = document.getElementById("sigHint");
    if (hint) hint.classList.add("hidden");
  }

  // ── Tenant B ─────────────────────────────────────────────────────────────────
  _setupTenantB() {
    this.tenantsB = [];
    this._addTenantBRow(); // start with one row

    document.getElementById("addTenantBBtn").addEventListener("click", () => {
      this._addTenantBRow();
    });
  }

  _addTenantBRow(data = {}) {
    const idx = this.tenantsB.length;
    this.tenantsB.push({ name: data.name || "", fin: data.fin || "", passport: data.passport || "" });

    const container = document.getElementById("tenantBList");
    const row = document.createElement("div");
    row.className = "tenant-b-row";
    row.dataset.idx = idx;
    row.innerHTML = `
      <div class="tenant-b-number">Bên B${idx + 1}</div>
      ${idx > 0 ? `<button class="btn btn-sm btn-outline-danger remove-tenant-btn" data-idx="${idx}"><i class="bi bi-x"></i></button>` : ""}
      <div class="mb-2">
        <label class="form-label">Họ và Tên <span class="text-danger">*</span></label>
        <input type="text" class="form-control tb-name" placeholder="Họ và tên đầy đủ" value="${data.name || ""}" />
      </div>
      <div class="row g-2">
        <div class="col-6">
          <label class="form-label">Số FIN</label>
          <input type="text" class="form-control tb-fin" placeholder="Ví dụ: G1234567X" value="${data.fin || ""}" />
        </div>
        <div class="col-6">
          <label class="form-label">Số Hộ Chiếu</label>
          <input type="text" class="form-control tb-passport" placeholder="Số hộ chiếu" value="${data.passport || ""}" />
        </div>
      </div>
    `;

    // Sync inputs to state
    row.querySelector(".tb-name").addEventListener("input", (e) => {
      this.tenantsB[idx].name = e.target.value;
      this._updateProgress();
      this._updateSectionDone();
    });
    row.querySelector(".tb-fin").addEventListener("input", (e) => {
      this.tenantsB[idx].fin = e.target.value;
    });
    row.querySelector(".tb-passport").addEventListener("input", (e) => {
      this.tenantsB[idx].passport = e.target.value;
    });

    const removeBtn = row.querySelector(".remove-tenant-btn");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => this._removeTenantBRow(idx));
    }

    container.appendChild(row);
    return row;
  }

  _removeTenantBRow(idx) {
    this.tenantsB.splice(idx, 1);
    const container = document.getElementById("tenantBList");
    container.innerHTML = "";
    const snapshot = [...this.tenantsB];
    this.tenantsB = [];
    snapshot.forEach((d) => this._addTenantBRow(d));
  }

  // ── Postcode search ──────────────────────────────────────────────────────────
  _setupPostcode() {
    const searchBtn = document.getElementById("ccSearchBtn");
    const input = document.getElementById("ccPostcode");

    const doSearch = async () => {
      const pc = input.value.trim().replace(/\D/g, "");
      if (pc.length !== 6) {
        showToast("Vui lòng nhập mã bưu chính 6 chữ số hợp lệ.", "warning");
        return;
      }
      searchBtn.disabled = true;
      searchBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang tìm...';
      try {
        const results = await lookupPostcode(pc);
        this._showAddressResults(results, pc);
      } catch (e) {
        showToast("Không tra được địa chỉ. Vui lòng nhập thủ công.", "error");
        console.error("OneMap lookup error:", e);
      } finally {
        searchBtn.disabled = false;
        searchBtn.innerHTML = '<i class="bi bi-search me-1"></i>Tìm';
      }
    };

    searchBtn.addEventListener("click", doSearch);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });
  }

  _showAddressResults(results, postcode) {
    const container = document.getElementById("ccAddressResults");
    const addressInput = document.getElementById("ccAddress");

    if (!results.length) {
      container.style.display = "";
      container.innerHTML = `<div class="text-muted" style="font-size:0.83rem;">Không tìm thấy địa chỉ cho mã ${postcode}. Vui lòng nhập thủ công.</div>`;
      return;
    }

    container.style.display = "";
    container.innerHTML = results
      .slice(0, 5)
      .map(
        (r, i) => `
        <div class="address-result-item" data-idx="${i}" data-address="${r.address}">
          <i class="bi bi-geo-alt text-primary me-1"></i>
          <strong>${r.address}</strong>
        </div>
      `,
      )
      .join("");

    container.querySelectorAll(".address-result-item").forEach((item) => {
      item.addEventListener("click", () => {
        container.querySelectorAll(".address-result-item").forEach((i) => i.classList.remove("selected"));
        item.classList.add("selected");
        // Populate address field (strip trailing Singapore + postcode for cleanliness)
        let addr = item.dataset.address;
        addr = addr.replace(/,?\s*SINGAPORE\s*\d*/i, "").trim();
        addressInput.value = addr;
      });
    });

    // Auto-select first result
    if (results.length === 1) {
      container.querySelector(".address-result-item")?.click();
    }
  }

  // ── Settlement accounts toggle ───────────────────────────────────────────────
  _setupSettlementToggle() {
    document.getElementById("ccShowSettlement").addEventListener("change", (e) => {
      const wrap = document.getElementById("ccSettlementWrap");
      wrap.style.display = e.target.checked ? "" : "none";
    });
  }

  // ── Accordion chevron ────────────────────────────────────────────────────────
  _setupAdditionalOptionsChevron() {
    const el = document.getElementById("additionalOptions");
    if (el) {
      el.addEventListener("show.bs.collapse", () => {
        document.getElementById("additionalChevron")?.classList.replace("bi-chevron-down", "bi-chevron-up");
      });
      el.addEventListener("hide.bs.collapse", () => {
        document.getElementById("additionalChevron")?.classList.replace("bi-chevron-up", "bi-chevron-down");
      });
    }

    const preview = document.getElementById("contractPreviewCollapse");
    if (preview) {
      preview.addEventListener("show.bs.collapse", () => {
        document.getElementById("previewChevron")?.classList.add("open");
      });
      preview.addEventListener("hide.bs.collapse", () => {
        document.getElementById("previewChevron")?.classList.remove("open");
      });
    }
  }

  // ── Auto-save on any input change ────────────────────────────────────────────
  _setupAutoSave() {
    let upsertTimer = null;
    const onAnyChange = () => {
      const state = this._collectState();
      saveDraft(state);
      this._renderPreview();
      this._updateProgress();
      this._updateFieldFill();
      // Debounced upsert to named drafts by identity key (avoids duplicate entries)
      clearTimeout(upsertTimer);
      upsertTimer = setTimeout(() => upsertNamedDraft(state, this._sessionId), 1500);
    };
    document.querySelector(".container-fluid").addEventListener("input", onAnyChange);
    document.querySelector(".container-fluid").addEventListener("change", onAnyChange);
  }

  // ── Ripple on all ripple-host buttons ─────────────────────────────────────────
  _setupRipples() {
    document.querySelectorAll(".ripple-host").forEach(addRipple);
  }

  // ── Field fill state (green border + tick) ────────────────────────────────────
  _setupFieldFillTracking() {
    document.querySelectorAll(".input-wrap .form-control").forEach((el) => {
      el.addEventListener("input", () => this._updateFieldFill());
      el.addEventListener("change", () => this._updateFieldFill());
    });
  }

  _updateFieldFill() {
    document.querySelectorAll(".input-wrap .form-control, .form-control").forEach((el) => {
      el.classList.toggle("is-filled", Boolean(el.value?.trim()));
    });
    // Section done badges
    this._updateSectionDone();
  }

  _updateSectionDone() {
    const has = (id) => Boolean(document.getElementById(id)?.value?.trim());
    const badge = (id, done) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("visible", done);
    };
    badge("done1", has("ccAddress") && has("ccUnit") && has("ccRoom"));
    badge("done2", has("ccMoveIn") && has("ccMoveOut") && has("ccRental"));
    badge("done3", has("ccTenantAName"));
    badge("done4", (this.tenantsB || []).some((t) => t.name?.trim()));
  }

  // ── Progress bar ──────────────────────────────────────────────────────────────
  _updateProgress() {
    const fields = ["ccAddress", "ccUnit", "ccRoom", "ccMoveIn", "ccMoveOut",
      "ccRental", "ccAgreementDate", "ccTenantAName"];
    const filled = fields.filter((id) => Boolean(document.getElementById(id)?.value?.trim())).length;
    const hasTenantB = (this.tenantsB || []).some((t) => t.name?.trim());
    const total = fields.length + 1;
    const done = filled + (hasTenantB ? 1 : 0);
    const pct = Math.round((done / total) * 100);
    const bar = document.getElementById("progressBarFill");
    if (bar) bar.style.width = `${pct}%`;
  }

  // ── Auto lease period from dates ──────────────────────────────────────────────
  _setupAutoLeasePeriod() {
    const calc = () => {
      const mi = document.getElementById("ccMoveIn")?.value;
      const mo = document.getElementById("ccMoveOut")?.value;
      const lp = document.getElementById("ccLeasePeriod");
      if (!mi || !mo || !lp) return;
      const diff = new Date(mo) - new Date(mi);
      if (diff <= 0) return;
      const months = diff / (1000 * 60 * 60 * 24 * 30.44);
      const rounded = Math.round(months * 2) / 2;
      lp.value = `${rounded} month${rounded === 1 ? "" : "s"}`;
      lp.classList.add("is-filled");
    };
    document.getElementById("ccMoveIn")?.addEventListener("change", calc);
    document.getElementById("ccMoveOut")?.addEventListener("change", calc);
  }

  // ── Sync toggle row checked state from underlying checkbox ────────────────────
  _syncToggleRowsFromState() {
    document.querySelectorAll(".toggle-row").forEach((row) => {
      const cbId = row.getAttribute("onclick")?.match(/'([^']+)'\)/)?.[1];
      if (!cbId) return;
      const cb = document.getElementById(cbId);
      if (cb) row.classList.toggle("checked", cb.checked);
    });
  }

  // ── Action buttons ────────────────────────────────────────────────────────────
  _setupActions() {
    document.getElementById("newContractBtn").addEventListener("click", () => this._resetContract());

    document.getElementById("loadDraftBtn").addEventListener("click", () => {
      this._toggleDraftsPanel();
    });

    // Close panel when clicking outside
    document.addEventListener("click", (e) => {
      if (!document.getElementById("draftsPanelWrap").contains(e.target) &&
          !document.getElementById("loadDraftBtn").contains(e.target)) {
        this._closeDraftsPanel();
      }
    });

    document.getElementById("exportPdfBtn").addEventListener("click", () => this._exportPDF("download"));
    document.getElementById("shareBtn").addEventListener("click", () => this._exportPDF("share"));
    document.getElementById("whatsappBtn").addEventListener("click", () => this._exportPDF("whatsapp"));
  }

  // ── Drafts panel ─────────────────────────────────────────────────────────────
  _toggleDraftsPanel() {
    const wrap = document.getElementById("draftsPanelWrap");
    if (wrap.classList.contains("open")) {
      this._closeDraftsPanel();
    } else {
      this._renderDraftsList();
      wrap.classList.add("open");
      document.getElementById("loadDraftBtn").classList.add("panel-open");
    }
  }

  _closeDraftsPanel() {
    document.getElementById("draftsPanelWrap").classList.remove("open");
    document.getElementById("loadDraftBtn").classList.remove("panel-open");
  }

  _renderDraftsList() {
    const list = document.getElementById("draftsList");
    const empty = document.getElementById("draftsEmpty");
    const drafts = loadNamedDrafts();

    if (!drafts.length) {
      list.innerHTML = "";
      empty.style.display = "";
      return;
    }

    // Highlight whichever draft key matches the current editing state
    const currentState = this._collectState();
    const activeKey = isDraftSaveable(currentState) ? buildDraftKey(currentState) : null;

    empty.style.display = "none";
    list.innerHTML = drafts.map((d, i) => {
      const isActive = activeKey && d.key === activeKey;
      return `
        <div class="draft-item${isActive ? " draft-item-current" : ""}" style="animation-delay:${i * 40}ms" data-id="${d.id}">
          <div class="draft-item-icon">
            <i class="bi ${isActive ? "bi-pencil-square" : "bi-file-earmark-text"}"></i>
          </div>
          <div class="draft-item-body">
            <div class="draft-item-name">${d.name}${isActive ? ' <span class="draft-auto-badge">đang soạn</span>' : ""}</div>
            <div class="draft-item-meta">${relativeTime(d.savedAt)}</div>
          </div>
          <button class="draft-item-load" data-load="${d.id}">Tải</button>
          <button class="draft-item-del" title="Xoá" data-del="${d.id}"><i class="bi bi-x"></i></button>
        </div>
      `;
    }).join("");

    list.querySelectorAll("[data-load]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.load;
        const draft = drafts.find((d) => d.id === id);
        if (!draft) return;
        this._restoreState(draft.state, draft.sessionId);
        this._closeDraftsPanel();
        showToast(`Đã tải: ${draft.name}`, "success");
      });
    });

    list.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.del;
        deleteNamedDraft(id);
        const row = btn.closest(".draft-item");
        row.style.transition = "opacity 0.2s, transform 0.2s";
        row.style.opacity = "0";
        row.style.transform = "translateX(20px)";
        setTimeout(() => this._renderDraftsList(), 220);
      });
    });
  }

  // ── State collection ──────────────────────────────────────────────────────────
  _collectState() {
    return {
      // Address
      postcode: document.getElementById("ccPostcode")?.value || "",
      address: document.getElementById("ccAddress")?.value || "",
      unit: document.getElementById("ccUnit")?.value || "",
      room: document.getElementById("ccRoom")?.value || "",
      // Contract terms
      agreementDate: document.getElementById("ccAgreementDate")?.value || "",
      moveInDate: document.getElementById("ccMoveIn")?.value || "",
      moveOutDate: document.getElementById("ccMoveOut")?.value || "",
      leasePeriod: document.getElementById("ccLeasePeriod")?.value || "",
      monthlyRental: document.getElementById("ccRental")?.value || "",
      securityDeposit: document.getElementById("ccDeposit")?.value || "",
      depositMonths: parseFloat(document.getElementById("ccDepositMonths")?.value) || 1,
      advanceMonths: parseFloat(document.getElementById("ccAdvanceMonths")?.value) || 1,
      paymentMethod: document.getElementById("ccPaymentMethod")?.value || "BANK_TRANSFER",
      electricityBudget: document.getElementById("ccElecBudget")?.value || "400",
      electricityFree: document.getElementById("ccElecFree")?.checked || false,
      cleaningFee: document.getElementById("ccCleaningFee")?.value || "",
      // Options
      airconFreeOfCharge: document.getElementById("ccAirconFree")?.checked || false,
      // Tenant A
      tenantA: {
        name: document.getElementById("ccTenantAName")?.value || "",
        fin: document.getElementById("ccTenantAFin")?.value || "",
        passport: document.getElementById("ccTenantAPassport")?.value || "",
        email: document.getElementById("ccTenantAEmail")?.value || "",
      },
      // Settlement accounts
      showSettlementAccounts: document.getElementById("ccShowSettlement")?.checked || false,
      settlementSgd: {
        bankName: document.getElementById("ccSgdBank")?.value || "",
        accountHolderName: document.getElementById("ccSgdHolder")?.value || "",
        accountNumber: document.getElementById("ccSgdAccNo")?.value || "",
      },
      settlementVnd: {
        bankName: document.getElementById("ccVndBank")?.value || "",
        accountHolderName: document.getElementById("ccVndHolder")?.value || "",
        accountNumber: document.getElementById("ccVndAccNo")?.value || "",
      },
      signatureA: this.signatureDataURL || null,
      tenantsB: this.tenantsB.map((t) => ({ ...t })),
    };
  }

  // ── State restoration ─────────────────────────────────────────────────────────
  _restoreState(s, sessionId) {
    // Inherit the session ID from the loaded draft so further edits update the same entry
    this._sessionId = sessionId || s._sessionId || Date.now().toString(36);

    // Always sets value — clears field if val is null/undefined
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === "checkbox") el.checked = Boolean(val);
      else el.value = val ?? "";
    };

    // ── Pre-clear stale UI ──────────────────────────────────────────
    const addrResults = document.getElementById("ccAddressResults");
    if (addrResults) { addrResults.style.display = "none"; addrResults.innerHTML = ""; }

    // Clear signature canvas first, then restore below
    if (this.signaturePad) this.signaturePad.clear();
    this.signatureDataURL = null;
    this._updateSigIndicator(false);
    const sigHint = document.querySelector(".sig-hint");
    if (sigHint) { sigHint.classList.remove("hidden"); sigHint.style.display = ""; }

    // Hide conditional sections — will re-show below if data present
    document.getElementById("ccSettlementWrap").style.display = "none";

    // ── Restore fields ──────────────────────────────────────────────
    set("ccPostcode", s.postcode);
    set("ccAddress", s.address);
    set("ccUnit", s.unit);
    set("ccRoom", s.room);
    set("ccAgreementDate", s.agreementDate);
    set("ccMoveIn", s.moveInDate);
    set("ccMoveOut", s.moveOutDate);
    set("ccLeasePeriod", s.leasePeriod);
    set("ccRental", s.monthlyRental);
    set("ccDeposit", s.securityDeposit);
    set("ccDepositMonths", s.depositMonths ?? 1);
    set("ccAdvanceMonths", s.advanceMonths ?? 1);
    set("ccPaymentMethod", s.paymentMethod || "BANK_TRANSFER");
    set("ccElecBudget", s.electricityBudget ?? "400");
    set("ccElecFree", s.electricityFree);
    set("ccCleaningFee", s.cleaningFee ?? "20");
    set("ccAirconFree", s.airconFreeOfCharge);
    set("ccTenantAName", s.tenantA?.name);
    set("ccTenantAFin", s.tenantA?.fin);
    set("ccTenantAPassport", s.tenantA?.passport);
    set("ccTenantAEmail", s.tenantA?.email);

    set("ccShowSettlement", s.showSettlementAccounts);
    if (s.showSettlementAccounts) {
      document.getElementById("ccSettlementWrap").style.display = "";
    }
    set("ccSgdBank", s.settlementSgd?.bankName);
    set("ccSgdHolder", s.settlementSgd?.accountHolderName);
    set("ccSgdAccNo", s.settlementSgd?.accountNumber);
    set("ccVndBank", s.settlementVnd?.bankName);
    set("ccVndHolder", s.settlementVnd?.accountHolderName);
    set("ccVndAccNo", s.settlementVnd?.accountNumber);

    // Restore signature — draw onto canvas so it's visible in the pad
    if (s.signatureA) {
      this.signatureDataURL = s.signatureA;
      this._drawDataURLToCanvas(s.signatureA);
      this._updateSigIndicator(true);
    }

    // Restore tenant B rows
    const container = document.getElementById("tenantBList");
    container.innerHTML = "";
    this.tenantsB = [];
    const bList = s.tenantsB || [];
    if (bList.length > 0) {
      bList.forEach((t) => this._addTenantBRow(t));
    } else {
      this._addTenantBRow();
    }

    this._syncToggleRowsFromState();
    this._updateFieldFill();
    this._updateProgress();
    this._renderPreview();
  }

  // ── Reset / new contract ─────────────────────────────────────────────────────
  _resetContract() {
    if (!confirm("Tạo hợp đồng mới?\nTất cả nội dung hiện tại sẽ bị xoá.")) return;

    this._closeDraftsPanel();
    // Snapshot current work before wiping, then start a fresh session
    upsertNamedDraft(this._collectState(), this._sessionId);
    this._sessionId = Date.now().toString(36);
    localStorage.removeItem("publicContractDraft");

    // Reset all text/select/date fields
    const clear = (id, val = "") => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    const uncheck = (id) => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    };

    clear("ccPostcode"); clear("ccAddress"); clear("ccUnit");
    clear("ccRoom"); clear("ccAgreementDate", new Date().toISOString().split("T")[0]); clear("ccMoveIn");
    clear("ccMoveOut"); clear("ccLeasePeriod"); clear("ccRental");
    clear("ccDeposit"); clear("ccDepositMonths", "1"); clear("ccAdvanceMonths", "1");
    clear("ccPaymentMethod", "BANK_TRANSFER");
    clear("ccElecBudget", "400"); clear("ccCleaningFee", "20");
    clear("ccTenantAName"); clear("ccTenantAFin"); clear("ccTenantAPassport"); clear("ccTenantAEmail");
    clear("ccSgdBank"); clear("ccSgdHolder"); clear("ccSgdAccNo");
    clear("ccVndBank"); clear("ccVndHolder"); clear("ccVndAccNo");

    // Uncheck all toggles and hide conditional sections
    ["ccElecFree","ccAirconFree","ccShowSettlement"].forEach(uncheck);
    const settlementWrap = document.getElementById("ccSettlementWrap");
    if (settlementWrap) settlementWrap.style.display = "none";

    // Clear signature
    if (this.signaturePad) this.signaturePad.clear();
    this.signatureDataURL = null;
    this._updateSigIndicator(false);
    const hint = document.querySelector(".sig-hint");
    if (hint) { hint.classList.remove("hidden"); hint.style.display = ""; }

    // Reset tenant B list to one empty row
    const container = document.getElementById("tenantBList");
    container.innerHTML = "";
    this.tenantsB = [];
    this._addTenantBRow();

    this._syncToggleRowsFromState();
    this._updateFieldFill();
    this._updateProgress();
    this._renderPreview();
    showToast("Đã tạo hợp đồng mới!", "success");
  }

  // ── Contract preview ─────────────────────────────────────────────────────────
  _renderPreview() {
    const el = document.getElementById("contractPreviewContent");
    if (!el) return;
    el.innerHTML = this._buildPreviewHTML(this._collectState());
  }

  _buildPreviewHTML(state) {
    const unit = state.unit || "";
    let cleanAddr = state.address || "[Property Address]";
    if (unit && cleanAddr.endsWith(`, ${unit}`)) cleanAddr = cleanAddr.slice(0, -`, ${unit}`.length).trim();
    const propertyAddr = unit ? `${unit}, ${cleanAddr}` : cleanAddr;

    const tA = {
      name: state.tenantA?.name || "[Tenant A Name]",
      fin: state.tenantA?.fin || "",
      passport: state.tenantA?.passport || "",
      email: state.tenantA?.email || "",
    };
    const tBList = (state.tenantsB || []).length > 0
      ? state.tenantsB.map((t) => ({ name: t.name || "[Tenant B Name]", fin: t.fin || "", passport: t.passport || "" }))
      : [{ name: "[Tenant B Name]", fin: "", passport: "" }];

    const p = (txt, style = "") => `<p style="margin:4px 0;${style}">${txt}</p>`;
    const indent = (txt) => p(txt, "margin-left:20px;");
    const bold = (txt) => `<strong>${txt}</strong>`;
    const small = (txt) => `<small style="margin-left:20px;">${txt}</small>`;

    // ── Section 1 clauses ──────────────────────────────────────────────────────
    const section1Parts = [];
    if (!state.fullPaymentReceived) {
      const depText = formatMonthsText(state.depositMonths || 1);
      const advText = formatMonthsText(state.advanceMonths || 1);
      const agDate = state.agreementDate ? formatDate(state.agreementDate) : "[Agreement Date]";
      const miDate = state.moveInDate ? formatDate(state.moveInDate) : "[Move-in Date]";
      section1Parts.push(
        `a) To pay the equivalent of ${depText}'s rent as a deposit on the agreement date (${agDate}) and ${advText}'s rent as an advance on the move-in date (${miDate}). The deposit is to be held by TenantA as security for the due performance and observance by TenantB of all covenants, conditions, and stipulations on the part of Tenant B herein contained, failing which TenantB shall forfeit to TenantA the said deposit or such part thereof as may be necessary to remedy such default.`,
        `b) In addition, and without prejudice to any other right power or remedy of Tenant A if the rent hereby reserved or any part thereof shall remain unpaid for 7 (SEVEN) days after the same shall have become due then, Tenant A shall forfeit the security deposit and at anytime thereafter, repossess The Room and remove all Tenant B's belongings from The Room without being liable for any loss or damage of such removal.`,
      );
    }
    const baseClauseTexts = getSection1BaseClauseTexts({ ...state, pestControlClause: true });
    let clauseOffset = 0;
    baseClauseTexts.forEach((text, idx) => {
      const isAircon = text.includes("air-conditioner servicing");
      if (isAircon && !hasAircon(state.room)) { clauseOffset = 1; return; }
      const li = state.fullPaymentReceived ? idx - clauseOffset : idx + 2 - clauseOffset;
      section1Parts.push(`${clauseLetter(li)}) ${text}`);
    });

    const section2Clauses = buildSection2Clauses(state);

    return `
      <div style="text-align:center;margin-bottom:24px;">
        <h3 style="font-weight:700;margin-bottom:8px;">HOUSE SHARING AGREEMENT</h3>
        ${p(`<strong>Full address:</strong> ${propertyAddr}`)}
        ${p(`<strong>Room:</strong> ${formatRoomType(state.room)}`)}
        ${p(`<strong>THIS AGREEMENT is made on:</strong> ${state.agreementDate || new Date().toISOString().split("T")[0]}`)}
      </div>

      <div style="margin-bottom:16px;">
        ${p(bold("BETWEEN"))}
        ${indent(`${bold("Main tenant:")} ${tA.name}${tA.passport ? `<br>${bold("Passport:")} ${tA.passport}` : ""}${tA.fin ? `<br>${bold("FIN:")} ${tA.fin}` : ""}${tA.email ? `<br>${bold("Email:")} ${tA.email}` : ""}${(() => {
          if (!state.showSettlementAccounts) return "";
          const sgd = state.settlementSgd || {};
          const vnd = state.settlementVnd || {};
          const hasSgd = sgd.bankName || sgd.accountNumber || sgd.accountHolderName;
          const hasVnd = vnd.bankName || vnd.accountNumber || vnd.accountHolderName;
          if (!hasSgd && !hasVnd) return "";
          let s = `<br><strong>Settlement Accounts:</strong>`;
          if (hasSgd) {
            const parts = [sgd.bankName && `Bank: ${sgd.bankName}`, sgd.accountHolderName && `Name: ${sgd.accountHolderName}`, sgd.accountNumber && `Account No: ${sgd.accountNumber}`].filter(Boolean);
            s += `<br><em>SGD</em> — ${parts.join(", ")}`;
          }
          if (hasVnd) {
            const parts = [vnd.bankName && `Bank: ${vnd.bankName}`, vnd.accountHolderName && `Name: ${vnd.accountHolderName}`, vnd.accountNumber && `Account No: ${vnd.accountNumber}`].filter(Boolean);
            s += `<br><em>VND</em> — ${parts.join(", ")}`;
          }
          return s;
        })()}`)}
        ${indent(`<em>(Hereinafter called "TenantA" which expresses together where the context so admits, shall include all persons having title under 'TenantA') of the one part.</em>`)}
      </div>

      <div style="margin-bottom:16px;">
        ${p(bold("AND"))}
        ${tBList.map((tb, i) => indent(
          `${tBList.length > 1 ? `${bold(`Tenant ${i + 1}:`)}<br>` : ""}${bold("Name:")} ${tb.name}${tb.passport ? `<br>${bold("Passport:")} ${tb.passport}` : ""}${tb.fin ? `<br>${bold("FIN:")} ${tb.fin}` : ""}`,
        )).join("")}
        ${indent(`<em>(Hereinafter called "Tenant B", which expresses together with where the context so admits, shall include all persons having title under 'Tenant B') of the one part.</em>`)}
      </div>

      ${p(`${bold("Payment method:")} ${formatPaymentMethod(state.paymentMethod)}`)}

      <div style="margin:20px 0;">
        ${p(bold("NOW IT IS HEREBY AGREED AS FOLLOWS:"))}
        ${p(`${bold("Lease Period:")} ${formatLeasePeriod(state)}`)}
        ${p(`${bold("Tenancy Period:")} ${formatTenancyPeriod(state)}`)}
        ${p(`${bold("Moving Time:")} Move in after 15:00, Move out before 11:00`)}

        ${p(`${bold("Monthly Rental:")} $${state.monthlyRental || "[Monthly Rental]"}<br>
          ${small(`*Room rental rate is strictly confidential<br>
          *Renewal contract is subject to mutual agreement by Tenant A and Tenant B${
            state.fullPaymentReceived
              ? `<br><strong>*Tenant A hereby confirms receipt of full rental payment for the entire tenancy period (S$${calculateTotalRental(state).toFixed(2)})</strong>`
              : '<br>*Payable by the 1st Day of each calendar month to "Tenant A"'
          }`)}`)}

        ${p(`${bold("Security Deposit:")} $${state.securityDeposit || state.monthlyRental || "[Security Deposit]"}${state.partialDepositReceived && state.partialDepositAmount ? ` <em>(Partial deposit received: $${state.partialDepositAmount})</em>` : ""}<br>
          ${small("*This deposit shall not be utilised to set off rent due and payable during the currency of this Agreement")}`)}

        ${p("<small>Monthly rentals include Wi-Fi, utilities, gas, usage of condominium facilities such as swimming pool, barbequepit and multi-purpose hall.</small>")}
      </div>

      <div style="margin:16px 0;">
        ${p(bold("1. TENANT B(S) HEREBY AGREE(S) WITH TENANT A AS FOLLOWS:"))}
        <div style="margin-left:20px;">
          ${section1Parts.map((c) => p(c, "margin-bottom:6px;")).join("")}
        </div>
      </div>

      <div style="margin:16px 0;">
        ${p(bold("2) AND PROVIDED ALWAYS AS IT IS HEREBY AGREED AS FOLLOWS:"))}
        <div style="margin-left:20px;">
          ${section2Clauses.map((c) => p(c, "margin-bottom:6px;")).join("")}
        </div>
      </div>

      <div style="margin-top:32px;border-top:1px solid #dee2e6;padding-top:16px;">
        ${p("By signing below, both parties agree to abide by all the above terms and conditions", "text-align:center;font-weight:600;")}
        <div style="display:flex;gap:40px;margin-top:20px;">
          <div>
            ${state.signatureA ? `<img src="${state.signatureA}" style="max-height:60px;border:1px solid #dee2e6;border-radius:4px;padding:4px;background:#fff;" />` : `<div style="width:150px;height:50px;border-bottom:1px solid #333;"></div>`}
            <div style="margin-top:4px;font-size:0.8rem;">${bold("Tenant A")}</div>
            <div style="font-size:0.8rem;">${tA.name}</div>
          </div>
          <div>
            <div style="width:150px;height:50px;border-bottom:1px solid #333;"></div>
            <div style="margin-top:4px;font-size:0.8rem;">${bold("Tenant B")}</div>
            ${tBList.map((tb) => `<div style="font-size:0.8rem;">${tb.name}</div>`).join("")}
          </div>
        </div>
      </div>
    `;
  }

  // ── Export / Share ─────────────────────────────────────────────────────────────
  // ── Validation ───────────────────────────────────────────────────────────────
  _validateForExport() {
    const REQUIRED = [
      { id: "ccAddress",       label: "Địa chỉ" },
      { id: "ccUnit",          label: "Số phòng / Unit" },
      { id: "ccRoom",          label: "Loại phòng" },
      { id: "ccAgreementDate", label: "Ngày ký" },
      { id: "ccMoveIn",        label: "Ngày vào ở" },
      { id: "ccMoveOut",       label: "Ngày kết thúc" },
      { id: "ccRental",        label: "Tiền thuê" },
      { id: "ccDeposit",       label: "Tiền cọc" },
      { id: "ccTenantAName",   label: "Tên Bên A" },
    ];

    // Clear previous errors
    document.querySelectorAll(".field-error").forEach((el) => el.classList.remove("field-error"));
    document.querySelectorAll(".field-error-label").forEach((el) => el.classList.remove("field-error-label"));
    document.querySelectorAll(".field-error-msg").forEach((el) => el.remove());

    const missing = [];
    let firstEl = null;

    const markError = (el, label) => {
      el.classList.add("field-error");
      missing.push(label);
      if (!firstEl) firstEl = el;

      const wrap = el.closest(".mb-2, .mb-3, .col-6, .col");
      if (wrap) {
        wrap.querySelector("label")?.classList.add("field-error-label");
        const msg = document.createElement("div");
        msg.className = "field-error-msg";
        msg.innerHTML = `<i class="bi bi-exclamation-circle-fill"></i> Bắt buộc`;
        el.insertAdjacentElement("afterend", msg);
      }

      const clear = () => {
        el.classList.remove("field-error");
        wrap?.querySelector("label")?.classList.remove("field-error-label");
        wrap?.querySelector(".field-error-msg")?.remove();
        el.removeEventListener("input", clear);
        el.removeEventListener("change", clear);
      };
      el.addEventListener("input", clear);
      el.addEventListener("change", clear);
    };

    // Mark two fields as an either/or pair — both turn red, clear when either is filled
    const markPairError = (el1, el2, label) => {
      missing.push(label);
      if (!firstEl) firstEl = el1;
      [el1, el2].forEach((el) => {
        el.classList.add("field-error");
        const wrap = el.closest(".mb-2, .mb-3, .col-6, .col");
        wrap?.querySelector("label")?.classList.add("field-error-label");
        if (!wrap?.querySelector(".field-error-msg")) {
          const msg = document.createElement("div");
          msg.className = "field-error-msg";
          msg.innerHTML = `<i class="bi bi-exclamation-circle-fill"></i> FIN hoặc Hộ chiếu`;
          el.insertAdjacentElement("afterend", msg);
        }
        const clear = () => {
          if (el1.value.trim() || el2.value.trim()) {
            [el1, el2].forEach((e) => {
              e.classList.remove("field-error");
              const w = e.closest(".mb-2, .mb-3, .col-6, .col");
              w?.querySelector("label")?.classList.remove("field-error-label");
              w?.querySelector(".field-error-msg")?.remove();
            });
            el1.removeEventListener("input", clear);
            el2.removeEventListener("input", clear);
          }
        };
        el.addEventListener("input", clear);
      });
    };

    REQUIRED.forEach(({ id, label }) => {
      const el = document.getElementById(id);
      if (el && !el.value.trim()) markError(el, label);
    });

    // Tenant A: must have FIN or passport
    const finA = document.getElementById("ccTenantAFin");
    const passA = document.getElementById("ccTenantAPassport");
    if (finA && passA && !finA.value.trim() && !passA.value.trim()) {
      markPairError(finA, passA, "FIN / Hộ chiếu Bên A");
    }

    // Check at least one Tenant B name
    const firstTbName = document.querySelector("#tenantBList .tb-name");
    if (firstTbName && !firstTbName.value.trim()) {
      markError(firstTbName, "Tên Bên B");
    }

    // Each Tenant B row: must have FIN or passport
    document.querySelectorAll("#tenantBList .tenant-b-row").forEach((row, i) => {
      const tbFin = row.querySelector(".tb-fin");
      const tbPass = row.querySelector(".tb-passport");
      if (tbFin && tbPass && !tbFin.value.trim() && !tbPass.value.trim()) {
        markPairError(tbFin, tbPass, `FIN / Hộ chiếu Bên B${i + 1}`);
      }
    });

    if (missing.length) {
      showToast(`Thiếu ${missing.length} trường bắt buộc: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}`, "error", 4000);
      firstEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  async _exportPDF(mode = "download") {
    if (!this._validateForExport()) return;
    const state = this._collectState();

    const btn = {
      download: document.getElementById("exportPdfBtn"),
      share: document.getElementById("shareBtn"),
      whatsapp: document.getElementById("whatsappBtn"),
    }[mode];

    const origHTML = btn?.innerHTML;
    if (btn) {
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Vui lòng đợi...';
      btn.disabled = true;
    }

    try {
      // Capture drawn signature if active tab is draw
      const activeTab = document.querySelector("#sigTabs .nav-link.active");
      if (activeTab?.dataset.tab === "draw" && !this.signaturePad.isEmpty()) {
        state.signatureA = this.signaturePad.toDataURL();
      }

      saveDraft(state);

      const pdf = await generatePDF(state);
      const filename = buildFilename(state);

      if (mode === "share" || mode === "whatsapp") {
        const blob = pdf.output("blob");
        const file = new File([blob], filename, { type: "application/pdf" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          showToast("Đã chia sẻ hợp đồng!", "success");
        } else if (mode === "whatsapp") {
          pdf.save(filename);
          window.open("https://web.whatsapp.com", "_blank");
          showToast("Đã tải PDF! Hãy đính kèm trong tab WhatsApp Web.", "info", 7000);
        } else {
          pdf.save(filename);
          showToast("Thiết bị không hỗ trợ chia sẻ — đã tải PDF thay thế.", "warning");
        }
      } else {
        pdf.save(filename);
        showToast("Xuất PDF thành công!", "success");
      }
    } catch (e) {
      console.error("PDF export error:", e);
      showToast("Xuất thất bại: " + e.message, "error");
    } finally {
      if (btn) {
        btn.innerHTML = origHTML;
        btn.disabled = false;
      }
    }
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  window.publicContractCreator = new PublicContractCreator();
});
