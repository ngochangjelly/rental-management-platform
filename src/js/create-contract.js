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

function showToast(msg, type = "info", duration = 3000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `toast-item ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
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

  const baseClauseTexts = getSection1BaseClauseTexts(state);
  let clauseOffset = 0;
  baseClauseTexts.forEach((text, idx) => {
    const isAircon = text.includes("air-conditioner servicing");
    if (isAircon && !hasAircon(state.room)) { clauseOffset = 1; return; }
    const li = state.fullPaymentReceived ? idx - clauseOffset : idx + 2 - clauseOffset;
    section1Clauses.push(`${String.fromCharCode(97 + li)}) ${text}`);
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
    this._init();
  }

  _init() {
    this._setDefaultDates();
    this._setupSignature();
    this._setupTenantB();
    this._setupPostcode();
    this._setupActions();
    this._setupAutoSave();
    this._setupPartialDepositToggle();
    this._setupAdditionalOptionsChevron();
    this._setupPreviewChevron();

    // Try to restore last draft automatically
    const draft = loadDraft();
    if (draft) this._restoreState(draft);
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
      this._updateSigPreview(null);
    });

    // File upload
    document.getElementById("ccSigUpload").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.signatureDataURL = ev.target.result;
        this._updateSigPreview(this.signatureDataURL);
      };
      reader.readAsDataURL(file);
    });

    // Capture drawn signature on mouse/touch up (update after each stroke)
    canvas.addEventListener("mouseup", () => this._captureDrawnSig());
    canvas.addEventListener("touchend", () => this._captureDrawnSig());
  }

  _captureDrawnSig() {
    if (!this.signaturePad.isEmpty()) {
      this.signatureDataURL = this.signaturePad.toDataURL();
      this._updateSigPreview(this.signatureDataURL);
    }
  }

  _updateSigPreview(dataURL) {
    const wrap = document.getElementById("sigPreviewWrap");
    const img = document.getElementById("sigPreviewImg");
    if (dataURL) {
      img.src = dataURL;
      wrap.style.display = "";
    } else {
      wrap.style.display = "none";
    }
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
    this.tenantsB.push({ name: "", fin: "", passport: "" });

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

  // ── Partial deposit toggle ───────────────────────────────────────────────────
  _setupPartialDepositToggle() {
    document.getElementById("ccPartialDeposit").addEventListener("change", (e) => {
      document.getElementById("ccPartialAmountWrap").style.display = e.target.checked ? "" : "none";
    });
  }

  // ── Accordion chevron ────────────────────────────────────────────────────────
  _setupAdditionalOptionsChevron() {
    const el = document.getElementById("additionalOptions");
    if (!el) return;
    el.addEventListener("show.bs.collapse", () => {
      document.getElementById("additionalChevron")?.classList.replace("bi-chevron-down", "bi-chevron-up");
    });
    el.addEventListener("hide.bs.collapse", () => {
      document.getElementById("additionalChevron")?.classList.replace("bi-chevron-up", "bi-chevron-down");
    });
  }

  // ── Auto-save on any input change ────────────────────────────────────────────
  _setupAutoSave() {
    let previewTimer = null;
    const onAnyChange = () => {
      const state = this._collectState();
      saveDraft(state);
      // Re-render preview only when it's open (avoid unnecessary work)
      const previewEl = document.getElementById("contractPreviewCollapse");
      if (previewEl?.classList.contains("show")) {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(() => this._renderPreview(), 250);
      }
    };
    document.querySelector(".container-fluid").addEventListener("input", onAnyChange);
    document.querySelector(".container-fluid").addEventListener("change", onAnyChange);
  }

  // ── Action buttons ────────────────────────────────────────────────────────────
  _setupActions() {
    document.getElementById("saveDraftBtn").addEventListener("click", () => {
      if (saveDraft(this._collectState())) showToast("Đã lưu bản nháp!", "success");
      else showToast("Không thể lưu (bộ nhớ đầy?)", "error");
    });

    document.getElementById("loadDraftBtn").addEventListener("click", () => {
      const draft = loadDraft();
      if (!draft) { showToast("Không tìm thấy bản nháp.", "warning"); return; }
      this._restoreState(draft);
      showToast("Đã tải bản nháp!", "success");
    });

    document.getElementById("exportPdfBtn").addEventListener("click", () => this._exportPDF("download"));
    document.getElementById("shareBtn").addEventListener("click", () => this._exportPDF("share"));
    document.getElementById("whatsappBtn").addEventListener("click", () => this._exportPDF("whatsapp"));
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
      cleaningFee: document.getElementById("ccCleaningFee")?.value || "20",
      fullPaymentReceived: document.getElementById("ccFullPayment")?.checked || false,
      partialDepositReceived: document.getElementById("ccPartialDeposit")?.checked || false,
      partialDepositAmount: document.getElementById("ccPartialAmount")?.value || "",
      // Options
      pestControlClause: document.getElementById("ccPestControl")?.checked || false,
      airconFreeOfCharge: document.getElementById("ccAirconFree")?.checked || false,
      forfeitAcCleanFee: document.getElementById("ccForfeitAc")?.checked || false,
      cleaningCompulsory: document.getElementById("ccCleaningCompulsory")?.checked || false,
      // Tenant A
      tenantA: {
        name: document.getElementById("ccTenantAName")?.value || "",
        fin: document.getElementById("ccTenantAFin")?.value || "",
        passport: document.getElementById("ccTenantAPassport")?.value || "",
        email: document.getElementById("ccTenantAEmail")?.value || "",
      },
      signatureA: this.signatureDataURL || null,
      tenantsB: this.tenantsB.map((t) => ({ ...t })),
    };
  }

  // ── State restoration ─────────────────────────────────────────────────────────
  _restoreState(s) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (!el || val == null) return;
      if (el.type === "checkbox") el.checked = Boolean(val);
      else el.value = val;
    };

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
    set("ccDepositMonths", s.depositMonths);
    set("ccAdvanceMonths", s.advanceMonths);
    set("ccPaymentMethod", s.paymentMethod);
    set("ccElecBudget", s.electricityBudget);
    set("ccElecFree", s.electricityFree);
    set("ccCleaningFee", s.cleaningFee);
    set("ccFullPayment", s.fullPaymentReceived);
    set("ccPartialDeposit", s.partialDepositReceived);
    set("ccPartialAmount", s.partialDepositAmount);
    set("ccPestControl", s.pestControlClause);
    set("ccAirconFree", s.airconFreeOfCharge);
    set("ccForfeitAc", s.forfeitAcCleanFee);
    set("ccCleaningCompulsory", s.cleaningCompulsory);
    set("ccTenantAName", s.tenantA?.name);
    set("ccTenantAFin", s.tenantA?.fin);
    set("ccTenantAPassport", s.tenantA?.passport);
    set("ccTenantAEmail", s.tenantA?.email);

    if (s.partialDepositReceived) {
      document.getElementById("ccPartialAmountWrap").style.display = "";
    }

    if (s.signatureA) {
      this.signatureDataURL = s.signatureA;
      this._updateSigPreview(s.signatureA);
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
  }

  // ── Preview chevron ──────────────────────────────────────────────────────────
  _setupPreviewChevron() {
    const el = document.getElementById("contractPreviewCollapse");
    if (!el) return;
    el.addEventListener("show.bs.collapse", () => {
      document.getElementById("previewChevron")?.classList.replace("bi-chevron-down", "bi-chevron-up");
      this._renderPreview();
    });
    el.addEventListener("hide.bs.collapse", () => {
      document.getElementById("previewChevron")?.classList.replace("bi-chevron-up", "bi-chevron-down");
    });
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
    const baseClauseTexts = getSection1BaseClauseTexts(state);
    let clauseOffset = 0;
    baseClauseTexts.forEach((text, idx) => {
      const isAircon = text.includes("air-conditioner servicing");
      if (isAircon && !hasAircon(state.room)) { clauseOffset = 1; return; }
      const li = state.fullPaymentReceived ? idx - clauseOffset : idx + 2 - clauseOffset;
      section1Parts.push(`${String.fromCharCode(97 + li)}) ${text}`);
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
        ${indent(`${bold("Main tenant:")} ${tA.name}${tA.passport ? `<br>${bold("Passport:")} ${tA.passport}` : ""}${tA.fin ? `<br>${bold("FIN:")} ${tA.fin}` : ""}${tA.email ? `<br>${bold("Email:")} ${tA.email}` : ""}`)}
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
  async _exportPDF(mode = "download") {
    const state = this._collectState();

    if (!state.tenantA.name) {
      showToast("Vui lòng nhập tên Bên A trước khi xuất.", "warning");
      return;
    }

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
