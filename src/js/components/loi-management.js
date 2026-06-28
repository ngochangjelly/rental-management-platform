/**
 * Letter of Intent (LOI) Management Component
 * Matches ERA Singapore LOI format exactly (ERA Serving Landlord)
 */
class LoiManagementComponent {
  constructor() {
    this.loiData = {
      // Header
      loiDate: new Date().toISOString().split("T")[0],
      // Landlord ("To:" block)
      landlordName: "",
      landlordNric: "",
      // Property
      propertyAddress: "",    // e.g. Blk 53 Pipit Rd #12-94 S(370053)
      // Tenant (opening paragraph)
      tenantName: "",
      tenantFin: "",          // FIN or NRIC
      // Rent terms
      monthlyRent: "",
      furnishing: "partially furnished as per attached Inventory List",
      paymentDay: "1",        // day of each month
      // Tenancy period
      commencementDate: "",
      leaseDurationMonths: "12",
      renewalMonths: "24",
      // Diplomatic clause
      diplomaticNoticeMonths: "02",
      diplomaticCommission: "",
      // Security deposit
      securityDeposit: "",
      // Lapse of offer
      lapseOfferDays: "02",
      // Tenant's other requirements (free text)
      tenantRequirements: "",
      // Good faith deposit (Page 2)
      gfdMethod: "transfer",  // 'cheque' or 'transfer'
      gfdAmount: "",
      gfdChequeNo: "",
      gfdBankName: "",
      gfdAccountName: "",
      gfdAccountNo: "",
      gfdForfeitureDate: "",
      // ERA Salesperson
      agentName: "",
      agentCeaNo: "",
      agentAssociateCode: "",
      // Tenant signatures
      tenantSignDate: "",     // day
      tenantSignMonth: "",
      tenantSignYear: new Date().getFullYear().toString().slice(-2),
      tenant1Name: "",
      tenant1IdNo: "",
      tenant2Name: "",
      tenant2IdNo: "",
      // Landlord signatures
      landlordSignDate: "",
      landlordSignMonth: "",
      landlordSignYear: new Date().getFullYear().toString().slice(-2),
      landlord2Name: "",
      landlord2IdNo: "",
    };

    this.init();
  }

  init() {
    this.renderPreview();
    this.bindFieldEvents();
  }

  bindFieldEvents() {
    const section = document.getElementById("loi-section");
    if (!section) return;
    section.addEventListener("input", (e) => this.handleFieldChange(e));
    section.addEventListener("change", (e) => this.handleFieldChange(e));
    this.bindPostcodeLookup();
  }

  bindPostcodeLookup() {
    const btn = document.getElementById("loiPostcodeLookupBtn");
    const input = document.getElementById("loiPostcodeLookup");
    if (!btn || !input) return;

    const doLookup = () => this.fetchPostcode(input.value.trim());
    btn.addEventListener("click", doLookup);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doLookup(); } });
  }

  async fetchPostcode(postcode) {
    const resultsEl = document.getElementById("loiPostcodeResults");
    const errorEl = document.getElementById("loiPostcodeError");
    if (!postcode || !/^\d{5,6}$/.test(postcode)) {
      errorEl.textContent = "Enter a valid 5-6 digit postcode.";
      errorEl.style.display = "";
      resultsEl.style.display = "none";
      return;
    }
    errorEl.style.display = "none";
    resultsEl.style.display = "none";
    resultsEl.innerHTML = "";

    const btn = document.getElementById("loiPostcodeLookupBtn");
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    btn.disabled = true;

    try {
      const res = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(postcode)}&returnGeom=N&getAddrDetails=Y&pageNum=1`);
      if (!res.ok) throw new Error("OneMap request failed");
      const data = await res.json();
      const results = (data.results || []).slice(0, 8);
      if (!results.length) {
        errorEl.textContent = "No results found for this postcode.";
        errorEl.style.display = "";
        return;
      }
      results.forEach((r) => {
        const addr = [r.BLK_NO, r.ROAD_NAME, r.BUILDING !== "NIL" ? r.BUILDING : "", `S(${r.POSTAL})`].filter(Boolean).join(" ");
        const item = document.createElement("button");
        item.type = "button";
        item.className = "list-group-item list-group-item-action py-1 px-2 small";
        item.textContent = addr;
        item.addEventListener("click", () => {
          document.getElementById("loiPropertyAddress").value = addr;
          this.loiData.propertyAddress = addr;
          this.renderPreview();
          resultsEl.style.display = "none";
          resultsEl.innerHTML = "";
          document.getElementById("loiPostcodeLookup").value = "";
        });
        resultsEl.appendChild(item);
      });
      resultsEl.style.display = "";
    } catch (err) {
      errorEl.textContent = "Lookup failed: " + err.message;
      errorEl.style.display = "";
    } finally {
      btn.innerHTML = '<i class="bi bi-search me-1"></i>Fetch';
      btn.disabled = false;
    }
  }

  handleFieldChange(e) {
    const el = e.target;
    const field = el.dataset.loiField;
    if (!field) return;
    this.loiData[field] = el.type === "checkbox" ? el.checked : el.value;
    this.renderPreview();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  formatDateDisplay(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-SG", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  ordinal(n) {
    const s = parseInt(n);
    if (isNaN(s) || !s) return "___";
    const j = s % 10, k = s % 100;
    if (j === 1 && k !== 11) return `${s}st`;
    if (j === 2 && k !== 12) return `${s}nd`;
    if (j === 3 && k !== 13) return `${s}rd`;
    return `${s}th`;
  }

  blank(val, width = 120) {
    if (val && String(val).trim()) {
      return `<strong>${this.escapeHtml(val)}</strong>`;
    }
    return `<span style="display:inline-block;min-width:${width}px;border-bottom:1px solid #999;color:#bbb;font-style:italic;font-size:11px;">&nbsp;</span>`;
  }

  escapeHtml(t) {
    if (!t) return "";
    const d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
  }

  // ─── Preview ───────────────────────────────────────────────────────────────

  renderPreview() {
    const container = document.getElementById("loiPreviewContainer");
    if (!container) return;

    const d = this.loiData;

    // Furnishing display — strip redundant words for inline display
    const furnishingLabel = d.furnishing || "partially furnished as per attached Inventory List";

    // Opening paragraph tenant line
    const tenantLine = [d.tenantName, d.tenantFin ? `FIN:${d.tenantFin}` : ""].filter(Boolean).join(" ");

    // Duration text
    const durationText = d.leaseDurationMonths
      ? `${d.leaseDurationMonths} months with an Option To Renew for a further ${this.blank(d.renewalMonths, 40)} months at the then prevailing market rent.`
      : "";

    const gfdAmtDisplay = d.gfdAmount ? `$${d.gfdAmount}` : "$_______________";

    container.innerHTML = `
<style>
  .loi-doc { font-family: "Times New Roman", Times, serif; font-size: 11.5px; line-height: 1.55; color: #111; }
  .loi-doc table { width: 100%; border-collapse: collapse; }
  .loi-doc .row-label { font-weight: 700; vertical-align: top; width: 170px; padding: 3px 8px 3px 0; white-space: nowrap; }
  .loi-doc .row-body { vertical-align: top; padding: 3px 0; }
  .loi-doc hr { border: none; border-top: 1px solid #999; margin: 10px 0; }
  .loi-doc .section-title { font-weight: 700; text-align: center; font-size: 14px; letter-spacing: 1px; margin: 0 0 6px 0; }
  .loi-doc .sub-title { text-align: center; font-size: 11.5px; margin: 0 0 10px 0; }
  .loi-doc .disclaimer { font-size: 9.5px; color: #555; margin-top: 12px; }
  .loi-doc .disclaimer strong { display: block; margin-bottom: 2px; }
  .loi-doc .page-break { border-top: 3px dashed #ccc; margin: 20px 0; text-align: center; font-size: 10px; color: #aaa; padding: 4px 0; }
  .loi-doc .sig-table td { vertical-align: top; padding: 4px 8px 4px 0; }
  .loi-doc .sig-line { border-bottom: 1px solid #555; display: block; width: 90%; margin-bottom: 4px; min-height: 32px; }
</style>
<div class="loi-doc" style="background:#fff; padding:36px 44px; max-width:680px; margin:0 auto; border:1px solid #dee2e6; min-height:900px;">

  <!-- PAGE 1 -->
  <p class="section-title">Letter Of Intent</p>
  <p class="sub-title">(ERA Serving Landlord)</p>
  <hr>

  <table style="margin-bottom:8px;">
    <tr>
      <td style="width:60px; vertical-align:top; font-weight:700;">Date:</td>
      <td>${this.blank(this.formatDateDisplay(d.loiDate))}</td>
    </tr>
    <tr><td style="height:10px;"></td></tr>
    <tr>
      <td style="vertical-align:top; font-weight:700;">To:</td>
      <td>
        ${this.blank(d.landlordName)}
        ${d.landlordNric ? `<br>${this.blank(d.landlordNric)}` : ""}
      </td>
    </tr>
  </table>

  <p style="text-align:center; font-weight:700; margin:12px 0 6px 0; letter-spacing:1px;">SUBJECT TO CONTRACT</p>
  <hr>

  <p style="margin:8px 0;">Dear Sir/Mdm,</p>
  <p style="margin:6px 0;"><strong>RE: LETTER OF INTENT FOR TENANCY OF</strong>&nbsp;
    ${this.blank(d.propertyAddress, 280)}
    <br><span style="font-size:9.5px; color:#888;">(the "Property")</span>
  </p>
  <p style="margin:6px 0;">Pursuant to your request to rent out the Property, we are pleased to inform you that
    ${this.blank(tenantLine || d.tenantName, 200)},
    intends to rent the Property based on the following terms and conditions:
  </p>

  <table style="margin-top:10px; border-collapse:collapse;">
    <tr>
      <td class="row-label">Rent</td>
      <td class="row-body">
        S$${this.blank(d.monthlyRent, 70)} per month (unfurnished /
        <span style="text-decoration:${d.furnishing === "partially furnished as per attached Inventory List" ? "underline" : "none"};">partially furnished as per attached Inventory List</span> /
        <span style="text-decoration:${d.furnishing === "fully furnished as per attached Inventory List" ? "underline" : "none"};">fully furnished as per attached Inventory List</span>)
        inclusive of maintenance charges, payable monthly in advance, on the
        ${this.blank(d.paymentDay, 28)} day of each month.
      </td>
    </tr>
    <tr><td colspan="2" style="height:6px;"></td></tr>
    <tr>
      <td class="row-label">Tenancy Commences On</td>
      <td class="row-body">${this.blank(this.formatDateDisplay(d.commencementDate), 200)}</td>
    </tr>
    <tr><td colspan="2" style="height:6px;"></td></tr>
    <tr>
      <td class="row-label">Duration Of Tenancy</td>
      <td class="row-body">
        ${this.blank(d.leaseDurationMonths, 40)} months with an Option To Renew for a further
        ${this.blank(d.renewalMonths, 40)} months at the then prevailing market rent.
      </td>
    </tr>
    <tr><td colspan="2" style="height:6px;"></td></tr>
    <tr>
      <td class="row-label">Diplomatic Clause</td>
      <td class="row-body">
        The Tenant is entitled to preterminate the Tenancy by giving at least
        ${this.blank(d.diplomaticNoticeMonths, 30)} month(s) written notice if the Tenant/Occupant is transferred
        out of Singapore permanently by his organisation or ceases to be employed, provided that:
        <br><br>
        a.&nbsp;&nbsp;Such notice may be given only after a Tenancy period of at least twelve (12) months, and
        <br>
        b.&nbsp;&nbsp;The Tenant shall refund to the Landlord, in respect of the unexpired portion of the Tenancy,
        a proportionate part of the commission of S${this.blank(d.diplomaticCommission, 70)}
        (inclusive of Goods and Services Tax), paid by the Landlord to the Landlord's real estate agent.
      </td>
    </tr>
    <tr><td colspan="2" style="height:6px;"></td></tr>
    <tr>
      <td class="row-label">Security Deposit</td>
      <td class="row-body">S$${this.blank(d.securityDeposit, 120)}</td>
    </tr>
    <tr><td colspan="2" style="height:6px;"></td></tr>
    <tr>
      <td class="row-label">Utilities Supply</td>
      <td class="row-body">Charges for the supply of water, electricity and gas shall be borne by the Tenant.</td>
    </tr>
    <tr><td colspan="2" style="height:6px;"></td></tr>
    <tr>
      <td class="row-label">Internet Service Provider</td>
      <td class="row-body">Internet Service Provider Charges shall be borne by the Tenant.</td>
    </tr>
    <tr><td colspan="2" style="height:6px;"></td></tr>
    <tr>
      <td class="row-label">Telecommunication Charges</td>
      <td class="row-body">Telecommunication Charges shall be borne by the Tenant.</td>
    </tr>
    <tr><td colspan="2" style="height:6px;"></td></tr>
    <tr>
      <td class="row-label">Singapore Cable Vision</td>
      <td class="row-body">Charges for Singapore Cable Vision facilities which are incurred by the Tenant shall be borne by the Tenant.</td>
    </tr>
    <tr><td colspan="2" style="height:6px;"></td></tr>
    <tr>
      <td class="row-label">Occupants</td>
      <td class="row-body">Only persons approved by the Landlord are permitted to occupy the Property, which approval shall not be
        unreasonably withheld. The Tenant shall at all times ensure that all occupants of the Property comply with all
        applicable laws for entering and staying in Singapore.</td>
    </tr>
    <tr><td colspan="2" style="height:6px;"></td></tr>
    <tr>
      <td class="row-label">Stamp Duty</td>
      <td class="row-body">Stamp duty on the Tenancy Agreement and other administration charges shall be borne by the Tenant.</td>
    </tr>
    <tr><td colspan="2" style="height:6px;"></td></tr>
    <tr>
      <td class="row-label">Due Diligence</td>
      <td class="row-body">Prior to execution of the Tenancy Agreement, the Tenant shall produce all relevant documents to verify
        that the Tenants/Permitted Occupiers are not prohibited immigrants under the provisions of the Immigration Act.</td>
    </tr>
    <tr><td colspan="2" style="height:6px;"></td></tr>
    <tr>
      <td class="row-label">Lapse Of Offer</td>
      <td class="row-body">
        This offer shall lapse within ${this.blank(this.numberToWords(d.lapseOfferDays), 60)} (${this.blank(d.lapseOfferDays, 28)}) days from the date hereof.
        In the event this offer is not accepted by the stipulated date, any deposit or monies received by the Landlord
        shall be returned to the Tenant immediately and thereafter neither party shall have any claims against each other.
      </td>
    </tr>
    <tr><td colspan="2" style="height:6px;"></td></tr>
    <tr>
      <td class="row-label">Tenant's Other Requirements</td>
      <td class="row-body">
        ${this.blank(d.tenantRequirements || "", 300)}
        <br><span style="display:inline-block;width:100%;border-bottom:1px solid #ccc;margin-top:2px;"></span>
        <br><span style="display:inline-block;width:100%;border-bottom:1px solid #ccc;margin-top:6px;"></span>
      </td>
    </tr>
  </table>

  <div class="disclaimer">
    <strong>Disclaimer</strong>
    This template may not be appropriate for use in all property transactions and does not relieve parties of their
    responsibility to seek appropriate advice from relevant professionals such as lawyers. Parties, through the use of
    this template (including any amendments made), agree that ERA Realty Network and its salesperson(s) shall not be
    liable for any damages whatsoever arising from the use of this template.
  </div>
  <p style="font-size:9.5px; color:#888; margin-top:4px;">(*Delete if not applicable)</p>
  <p style="font-size:9.5px; color:#888; text-align:right;">Page 1 &nbsp;&nbsp; Updated 032026</p>

  <!-- PAGE BREAK -->
  <div class="page-break">─── Page 2 ───</div>

  <!-- GOOD FAITH DEPOSIT -->
  <p style="font-weight:700; margin:0 0 8px 0;">Good Faith Deposit</p>

  <p style="margin:4px 0;">
    <span style="margin-right:6px;">${d.gfdMethod === "cheque" ? "☑" : "☐"}</span>
    *Enclosed please find the amount
    ${d.gfdMethod === "cheque" ? `<strong>$${this.escapeHtml(d.gfdAmount)}</strong>` : `$_______________`}
    (Cheque No: ${d.gfdMethod === "cheque" ? this.blank(d.gfdChequeNo, 100) : `_______________`} ) being payment of the good faith deposit.
  </p>

  <p style="margin:8px 0;">
    <span style="margin-right:6px;">${d.gfdMethod === "transfer" ? "☑" : "☐"}</span>
    *In furtherance of this Letter of Intent, the Tenant hereby transfers the good faith deposit of
    ${d.gfdMethod === "transfer" ? `<strong>$${this.escapeHtml(d.gfdAmount)}</strong>` : `$_______________`}
    to the Landlord as per the following details.
  </p>

  <table style="margin:6px 0 10px 0; width:100%;">
    <tr>
      <td style="width:50%; padding:2px 8px 2px 0;">
        Bank: ${d.gfdMethod === "transfer" ? this.blank(d.gfdBankName, 120) : `<span style="display:inline-block;min-width:120px;border-bottom:1px solid #ccc;"></span>`}
      </td>
      <td>
        Account Name: ${d.gfdMethod === "transfer" ? this.blank(d.gfdAccountName, 120) : `<span style="display:inline-block;min-width:120px;border-bottom:1px solid #ccc;"></span>`}
      </td>
    </tr>
    <tr style="height:6px;"></tr>
    <tr>
      <td colspan="2">
        Bank Account No / PayNow: ${d.gfdMethod === "transfer" ? this.blank(d.gfdAccountNo, 200) : `<span style="display:inline-block;min-width:200px;border-bottom:1px solid #ccc;"></span>`}
      </td>
    </tr>
  </table>

  <p style="margin:6px 0; font-size:11px;">
    In the event this offer is accepted by the Landlord and the Tenant fails to execute the Tenancy Agreement by
    ${this.blank(this.formatDateDisplay(d.gfdForfeitureDate), 120)},
    the good faith deposit submitted shall be forfeited to the Landlord and thereafter, neither party shall have any claim against the other.
  </p>

  <p style="margin:10px 0 14px 0;">Please confirm your acceptance to the above by signing below.</p>
  <p style="margin:0 0 2px 0;">Yours faithfully,</p>

  <table style="margin-bottom:14px; width:100%;">
    <tr>
      <td style="width:200px; vertical-align:bottom;">
        <div style="border-bottom:1px solid #555; min-height:40px;"></div>
        <div style="font-size:10.5px; margin-top:3px;"><strong>ERA Salesperson</strong></div>
        <div style="font-size:10.5px;">Name: ${this.blank(d.agentName, 100)}</div>
        <div style="font-size:10.5px;">CEA Reg No: ${this.blank(d.agentCeaNo, 80)}</div>
        <div style="font-size:10.5px;">Associate Code: ${this.blank(d.agentAssociateCode, 70)}</div>
      </td>
    </tr>
  </table>

  <hr>

  <!-- TENANT SIGNATURES -->
  <p style="font-weight:700; margin:8px 0 4px 0;">TENANT</p>
  <p style="margin:0 0 6px 0; font-size:11px;">I/We confirm acceptance of the above terms and conditions:</p>
  <p style="margin:0 0 10px 0; font-size:11px;">
    Dated this ${this.blank(this.ordinal(d.tenantSignDate), 50)} day of
    ${this.blank(d.tenantSignMonth, 70)} 20${this.blank(d.tenantSignYear, 28)}.
  </p>

  <table class="sig-table" style="width:100%; margin-bottom:12px;">
    <tr>
      <td style="width:48%;">
        <span class="sig-line"></span>
        <div>Signature of Tenant (or its authorized signatory)</div>
        <div style="margin-top:4px;">Name: ${this.blank(d.tenant1Name, 130)}</div>
        <div>ID No: ${this.blank(d.tenant1IdNo, 120)}</div>
      </td>
      <td style="width:4%;"></td>
      <td style="width:48%;">
        <span class="sig-line"></span>
        <div>Signature of Tenant (or its authorized signatory)</div>
        <div style="margin-top:4px;">Name: ${this.blank(d.tenant2Name || "", 130)}</div>
        <div>ID No: ${this.blank(d.tenant2IdNo || "", 120)}</div>
      </td>
    </tr>
  </table>

  <hr>

  <!-- LANDLORD SIGNATURES -->
  <p style="font-weight:700; margin:8px 0 4px 0;">LANDLORD</p>
  <p style="margin:0 0 6px 0; font-size:11px;">I/We confirm acceptance of the above terms and conditions:</p>
  <p style="margin:0 0 10px 0; font-size:11px;">
    Dated this ${this.blank(this.ordinal(d.landlordSignDate), 50)} day of
    ${this.blank(d.landlordSignMonth, 70)} 20${this.blank(d.landlordSignYear, 28)}.
  </p>

  <table class="sig-table" style="width:100%; margin-bottom:12px;">
    <tr>
      <td style="width:48%;">
        <span class="sig-line"></span>
        <div>Signature Of Landlord (or its authorized signatory)</div>
        <div style="margin-top:4px;">Name: ${this.blank(d.landlordName, 130)}</div>
        <div>ID No: ${this.blank(d.landlordNric, 120)}</div>
      </td>
      <td style="width:4%;"></td>
      <td style="width:48%;">
        <span class="sig-line"></span>
        <div>Signature Of Landlord (or its authorized signatory)</div>
        <div style="margin-top:4px;">Name: ${this.blank(d.landlord2Name || "", 130)}</div>
        <div>ID No: ${this.blank(d.landlord2IdNo || "", 120)}</div>
      </td>
    </tr>
  </table>

  <div class="disclaimer">
    <strong>Disclaimer</strong>
    This template may not be appropriate for use in all property transactions and does not relieve parties of their
    responsibility to seek appropriate advice from relevant professionals such as lawyers. Parties, through the use of
    this template (including any amendments made), agree that ERA Realty Network and its salesperson(s) shall not be
    liable for any damages whatsoever arising from the use of this template.
  </div>
  <p style="font-size:9.5px; color:#888; margin-top:4px;">(*Delete if not applicable)</p>
  <p style="font-size:9.5px; color:#888; text-align:right;">Page 2 &nbsp;&nbsp; Updated 032026</p>

</div>`;
  }

  numberToWords(n) {
    const words = ["ZERO","ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE","TEN",
      "ELEVEN","TWELVE","THIRTEEN","FOURTEEN","FIFTEEN","SIXTEEN","SEVENTEEN","EIGHTEEN","NINETEEN","TWENTY",
      "TWENTY-ONE","TWENTY-TWO","TWENTY-THREE","TWENTY-FOUR","TWENTY-FIVE","TWENTY-SIX","TWENTY-SEVEN","TWENTY-EIGHT","TWENTY-NINE","THIRTY"];
    const i = parseInt(n);
    if (isNaN(i) || i < 0 || i >= words.length) return n || "";
    return words[i];
  }

  // ─── PDF Export ────────────────────────────────────────────────────────────

  async exportToPDF() {
    const btns = ["loiExportPdfBtn", "loiExportPdfBtn2"].map((id) => document.getElementById(id)).filter(Boolean);
    btns.forEach((b) => { b.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Exporting...'; b.disabled = true; });

    try {
      if (typeof jsPDF === "undefined") throw new Error("jsPDF not available");
      const pdf = new jsPDF("p", "mm", "a4");

      const loadFont = async (url) => {
        const buf = await (await fetch(url)).arrayBuffer();
        const bytes = new Uint8Array(buf);
        let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        return btoa(s);
      };
      const [regB64, boldB64] = await Promise.all([loadFont("/fonts/NotoSerif-Regular.ttf"), loadFont("/fonts/NotoSerif-Bold.ttf")]);
      pdf.addFileToVFS("NotoSerif-Regular.ttf", regB64); pdf.addFont("NotoSerif-Regular.ttf", "NotoSerif", "normal");
      pdf.addFileToVFS("NotoSerif-Bold.ttf", boldB64); pdf.addFont("NotoSerif-Bold.ttf", "NotoSerif", "bold");

      const W = 210, H = 297, ML = 18, MR = 18, MT = 16, MB = 16;
      const CW = W - ML - MR;
      let y = MT;
      const lh = 4.8;
      const labelW = 44;

      const checkY = (need = lh) => { if (y + need > H - MB) { pdf.addPage(); y = MT; } };

      const text = (str, x, opts = {}) => {
        const { bold = false, size = 10, color = [0,0,0], italic = false } = opts;
        pdf.setFontSize(size);
        pdf.setFont("NotoSerif", bold ? "bold" : "normal");
        pdf.setTextColor(...color);
        const lines = pdf.splitTextToSize(String(str || ""), opts.maxW || (CW - (x - ML)));
        lines.forEach((l) => { checkY(); pdf.text(l, x, y); y += lh; });
        pdf.setTextColor(0, 0, 0);
        return lines.length;
      };

      const line = (x1, x2, color = [180,180,180]) => {
        pdf.setDrawColor(...color);
        pdf.setLineWidth(0.2);
        pdf.line(x1, y, x2, y);
        pdf.setDrawColor(0);
      };

      // Helper: row with label + wrapped body text
      const row = (label, bodyFn, extraGap = 0) => {
        const startY = y;
        const bodyX = ML + labelW;
        pdf.setFontSize(10); pdf.setFont("NotoSerif", "bold");
        const labelLines = pdf.splitTextToSize(label, labelW - 2);
        // render body first to measure, then render label at same startY
        const savedY = y;
        bodyFn(bodyX, savedY);
        const endY = y;
        // now render label at savedY
        y = savedY;
        labelLines.forEach((l) => { pdf.setFont("NotoSerif", "bold"); pdf.setFontSize(10); pdf.text(l, ML, y); y += lh; });
        y = endY;
        if (extraGap) y += extraGap;
      };

      // Inline value/blank rendering for PDF
      const val = (v) => v && String(v).trim() ? String(v) : "___________";
      const blankLine = (label, content, x) => {
        pdf.setFontSize(10);
        pdf.setFont("NotoSerif", "normal");
        const out = `${label} ${val(content)}`;
        const lines = pdf.splitTextToSize(out, CW - (x - ML));
        lines.forEach((l) => { checkY(); pdf.text(l, x, y); y += lh; });
      };

      const d = this.loiData;

      // ── PAGE 1 ──

      // Title
      pdf.setFontSize(14); pdf.setFont("NotoSerif", "bold");
      checkY(6); pdf.text("Letter Of Intent", W / 2, y, { align: "center" }); y += 5.5;
      pdf.setFontSize(10); pdf.setFont("NotoSerif", "normal");
      checkY(); pdf.text("(ERA Serving Landlord)", W / 2, y, { align: "center" }); y += lh;
      line(ML, ML + CW, [100,100,100]); y += lh;

      // Date + To block
      pdf.setFontSize(10); pdf.setFont("NotoSerif", "bold");
      checkY(); pdf.text("Date:", ML, y);
      pdf.setFont("NotoSerif", "normal"); pdf.text(val(this.formatDateDisplay(d.loiDate)), ML + 14, y); y += lh * 1.5;
      pdf.setFont("NotoSerif", "bold"); pdf.text("To:", ML, y);
      pdf.setFont("NotoSerif", "normal");
      pdf.text(val(d.landlordName), ML + 10, y); y += lh;
      if (d.landlordNric && d.landlordNric.trim()) {
        pdf.text(d.landlordNric, ML + 10, y);
      }
      y += lh * 1.5;

      // Subject to contract
      pdf.setFontSize(10); pdf.setFont("NotoSerif", "bold");
      checkY(); pdf.text("SUBJECT TO CONTRACT", W / 2, y, { align: "center" }); y += lh;
      line(ML, ML + CW); y += lh;

      // Dear / RE
      pdf.setFont("NotoSerif", "normal"); pdf.setFontSize(10);
      checkY(); pdf.text("Dear Sir/Mdm,", ML, y); y += lh * 1.2;
      pdf.setFont("NotoSerif", "bold"); pdf.text("RE: LETTER OF INTENT FOR TENANCY OF  ", ML, y);
      const reW = pdf.getTextWidth("RE: LETTER OF INTENT FOR TENANCY OF  ");
      pdf.setFont("NotoSerif", "normal");
      const propLines = pdf.splitTextToSize(val(d.propertyAddress), CW - reW);
      pdf.text(propLines[0], ML + reW, y); y += lh;
      for (let i = 1; i < propLines.length; i++) { checkY(); pdf.text(propLines[i], ML, y); y += lh; }
      pdf.setFontSize(9); pdf.text('(the "Property")', ML, y); y += lh; pdf.setFontSize(10);

      // Opening paragraph
      y += 1;
      const tenantLine = [d.tenantName, d.tenantFin ? `FIN:${d.tenantFin}` : ""].filter(Boolean).join(" ") || "___________";
      const openPara = `Pursuant to your request to rent out the Property, we are pleased to inform you that ${tenantLine}, intends to rent the Property based on the following terms and conditions:`;
      const openLines = pdf.splitTextToSize(openPara, CW);
      openLines.forEach((l) => { checkY(); pdf.setFont("NotoSerif", "normal"); pdf.text(l, ML, y); y += lh; });
      y += 2;

      // Rows
      const bodyX = ML + labelW;
      const bodyW = CW - labelW;

      const renderRow = (label, bodyLines, gap = 2) => {
        // Pre-compute all lines first so we can do a single page-break check
        // before rendering (avoids mid-row page breaks that corrupt layout)
        pdf.setFontSize(10);
        const lblSplit = pdf.splitTextToSize(label, labelW - 2);
        const allBodyLines = [];
        bodyLines.forEach(({ text: t, bold: b = false }) => {
          pdf.setFont("NotoSerif", b ? "bold" : "normal");
          pdf.splitTextToSize(String(t || ""), bodyW).forEach(l => allBodyLines.push({ l, b }));
        });
        const rowH = Math.max(lblSplit.length, allBodyLines.length) * lh + gap;
        if (y + rowH > H - MB) { pdf.addPage(); y = MT; }
        const startY = y;
        allBodyLines.forEach(({ l, b }) => {
          pdf.setFont("NotoSerif", b ? "bold" : "normal"); pdf.setFontSize(10);
          pdf.text(l, bodyX, y); y += lh;
        });
        const bodyEndY = y;
        y = startY;
        lblSplit.forEach((l) => { pdf.setFont("NotoSerif", "bold"); pdf.setFontSize(10); pdf.text(l, ML, y); y += lh; });
        y = Math.max(startY + lblSplit.length * lh, bodyEndY) + gap;
      };

      // Rent row (complex inline)
      {
        pdf.setFontSize(10); pdf.setFont("NotoSerif", "bold");
        const lbl = pdf.splitTextToSize("Rent", labelW - 2);
        const rentText = `S$${val(d.monthlyRent)} per month (${val(d.furnishing)}) inclusive of maintenance charges, payable monthly in advance, on the ${val(d.paymentDay)} day of each month.`;
        pdf.setFont("NotoSerif", "normal");
        const rentLines = pdf.splitTextToSize(rentText, bodyW);
        const rentRowH = Math.max(lbl.length, rentLines.length) * lh + 2;
        if (y + rentRowH > H - MB) { pdf.addPage(); y = MT; }
        const startY = y;
        rentLines.forEach((l) => { pdf.setFont("NotoSerif", "normal"); pdf.setFontSize(10); pdf.text(l, bodyX, y); y += lh; });
        const endY = y;
        y = startY; lbl.forEach((l) => { pdf.setFont("NotoSerif", "bold"); pdf.setFontSize(10); pdf.text(l, ML, y); y += lh; });
        y = Math.max(startY + lbl.length * lh, endY) + 2;
      }

      renderRow("Tenancy Commences On", [{ text: val(this.formatDateDisplay(d.commencementDate)) }]);
      renderRow("Duration Of Tenancy", [{ text: `${val(d.leaseDurationMonths)} months with an Option To Renew for a further ${val(d.renewalMonths)} months at the then prevailing market rent.` }]);

      {
        const dipText = `The Tenant is entitled to preterminate the Tenancy by giving at least ${val(d.diplomaticNoticeMonths)} month(s) written notice if the Tenant/Occupant is transferred out of Singapore permanently by his organisation or ceases to be employed, provided that:\n\na.  Such notice may be given only after a Tenancy period of at least twelve (12) months, and\n\nb.  The Tenant shall refund to the Landlord, in respect of the unexpired portion of the Tenancy, a proportionate part of the commission of S$${val(d.diplomaticCommission)} (inclusive of Goods and Services Tax), paid by the Landlord to the Landlord's real estate agent.`;
        pdf.setFontSize(10); pdf.setFont("NotoSerif", "normal");
        const dipLines = pdf.splitTextToSize(dipText, bodyW);
        const lblDip = pdf.splitTextToSize("Diplomatic Clause", labelW - 2);
        const dipRowH = Math.max(lblDip.length, dipLines.length) * lh + 2;
        if (y + dipRowH > H - MB) { pdf.addPage(); y = MT; }
        const startY = y;
        dipLines.forEach((l) => { pdf.setFont("NotoSerif", "normal"); pdf.setFontSize(10); pdf.text(l, bodyX, y); y += lh; });
        const endY = y;
        y = startY;
        pdf.setFont("NotoSerif", "bold"); pdf.text("Diplomatic Clause", ML, y); y += lh;
        y = Math.max(startY + lblDip.length * lh, endY) + 2;
      }

      renderRow("Security Deposit", [{ text: `S$${val(d.securityDeposit)}` }]);
      renderRow("Utilities Supply", [{ text: "Charges for the supply of water, electricity and gas shall be borne by the Tenant." }]);
      renderRow("Internet Service Provider", [{ text: "Internet Service Provider Charges shall be borne by the Tenant." }]);
      renderRow("Telecommunication Charges", [{ text: "Telecommunication Charges shall be borne by the Tenant." }]);
      renderRow("Singapore Cable Vision", [{ text: "Charges for Singapore Cable Vision facilities which are incurred by the Tenant shall be borne by the Tenant." }]);
      renderRow("Occupants", [{ text: "Only persons approved by the Landlord are permitted to occupy the Property, which approval shall not be unreasonably withheld. The Tenant shall at all times ensure that all occupants of the Property comply with all applicable laws for entering and staying in Singapore." }]);
      renderRow("Stamp Duty", [{ text: "Stamp duty on the Tenancy Agreement and other administration charges shall be borne by the Tenant." }]);
      renderRow("Due Diligence", [{ text: "Prior to execution of the Tenancy Agreement, the Tenant shall produce all relevant documents to verify that the Tenants/Permitted Occupiers are not prohibited immigrants under the provisions of the Immigration Act." }]);
      renderRow("Lapse Of Offer", [{ text: `This offer shall lapse within ${this.numberToWords(d.lapseOfferDays)} (${val(d.lapseOfferDays)}) days from the date hereof. In the event this offer is not accepted by the stipulated date, any deposit or monies received by the Landlord shall be returned to the Tenant immediately and thereafter neither party shall have any claims against each other.` }]);
      renderRow("Tenant's Other Requirements", [{ text: val(d.tenantRequirements) }, { text: " " }, { text: " " }]);

      // Disclaimer p1
      y += 2;
      checkY(lh * 4);
      pdf.setFontSize(9); pdf.setFont("NotoSerif", "bold"); pdf.setTextColor(80,80,80);
      pdf.text("Disclaimer", ML, y); y += lh * 0.9;
      pdf.setFont("NotoSerif", "normal");
      const disc = "This template may not be appropriate for use in all property transactions and does not relieve parties of their responsibility to seek appropriate advice from relevant professionals such as lawyers. Parties, through the use of this template (including any amendments made), agree that ERA Realty Network and its salesperson(s) shall not be liable for any damages whatsoever arising from the use of this template.";
      pdf.splitTextToSize(disc, CW).forEach((l) => { checkY(); pdf.text(l, ML, y); y += lh * 0.9; });
      pdf.setTextColor(0,0,0); pdf.setFontSize(9);
      checkY(); pdf.text("(*Delete if not applicable)", ML, y); y += lh;
      checkY(); pdf.text("Page 1     Updated 032026", ML + CW, y, { align: "right" }); y += lh;

      // ── PAGE 2 ──
      pdf.addPage(); y = MT;

      pdf.setFontSize(11); pdf.setFont("NotoSerif", "bold");
      pdf.text("Good Faith Deposit", ML, y); y += lh * 1.5; pdf.setFontSize(10);

      // Cheque option
      const ch = d.gfdMethod === "cheque";
      pdf.text(ch ? "☑" : "☐", ML, y);
      const gfdChequeText = `*Enclosed please find the amount ${ch ? `$${val(d.gfdAmount)}` : "$_______________"} (Cheque No: ${ch ? val(d.gfdChequeNo) : "_______________"} ) being payment of the good faith deposit.`;
      pdf.setFont("NotoSerif", "normal");
      pdf.splitTextToSize(gfdChequeText, CW - 8).forEach((l) => { checkY(); pdf.text(l, ML + 6, y); y += lh; });
      y += 2;

      // Transfer option
      const tr = d.gfdMethod === "transfer";
      pdf.setFont("NotoSerif", "normal"); pdf.text(tr ? "☑" : "☐", ML, y);
      const gfdTrText = `*In furtherance of this Letter of Intent, the Tenant hereby transfers the good faith deposit of ${tr ? `$${val(d.gfdAmount)}` : "$_______________"} to the Landlord as per the following details.`;
      pdf.splitTextToSize(gfdTrText, CW - 8).forEach((l) => { checkY(); pdf.text(l, ML + 6, y); y += lh; });
      y += 3;
      pdf.text(`Bank: ${val(d.gfdBankName)}`, ML, y);
      pdf.text(`Account Name: ${val(d.gfdAccountName)}`, ML + CW / 2, y); y += lh * 1.5;
      pdf.text(`Bank Account No / PayNow: ${val(d.gfdAccountNo)}`, ML, y); y += lh * 1.5;

      const forfeitText = `In the event this offer is accepted by the Landlord and the Tenant fails to execute the Tenancy Agreement by ${val(this.formatDateDisplay(d.gfdForfeitureDate))}, the good faith deposit submitted shall be forfeited to the Landlord and thereafter, neither party shall have any claim against the other.`;
      pdf.splitTextToSize(forfeitText, CW).forEach((l) => { checkY(); pdf.text(l, ML, y); y += lh; });
      y += 3;
      pdf.text("Please confirm your acceptance to the above by signing below.", ML, y); y += lh * 1.5;
      pdf.text("Yours faithfully,", ML, y); y += lh * 1.5;

      // Agent
      line(ML, ML + 70, [100,100,100]); y += lh;
      pdf.setFont("NotoSerif", "bold"); pdf.text("ERA Salesperson", ML, y); y += lh;
      pdf.setFont("NotoSerif", "normal");
      pdf.text(`Name: ${val(d.agentName)}`, ML, y); y += lh;
      pdf.text(`CEA Reg No: ${val(d.agentCeaNo)}`, ML, y); y += lh;
      pdf.text(`Associate Code: ${val(d.agentAssociateCode)}`, ML, y); y += lh * 2;

      line(ML, ML + CW, [150,150,150]); y += 3;

      // Tenant sigs
      pdf.setFont("NotoSerif", "bold"); pdf.text("TENANT", ML, y); y += lh;
      pdf.setFont("NotoSerif", "normal");
      pdf.text("I/We confirm acceptance of the above terms and conditions:", ML, y); y += lh;
      pdf.text(`Dated this ${this.ordinal(d.tenantSignDate)} day of ${val(d.tenantSignMonth)} 20${val(d.tenantSignYear)}.`, ML, y); y += lh * 3;
      const sigColW = (CW - 10) / 2;
      line(ML, ML + sigColW, [80,80,80]);
      line(ML + sigColW + 10, ML + CW, [80,80,80]);
      y += lh * 0.5;
      pdf.setFontSize(9.5);
      pdf.text("Signature of Tenant (or its authorized signatory)", ML, y);
      pdf.text("Signature of Tenant (or its authorized signatory)", ML + sigColW + 10, y); y += lh;
      pdf.text(`Name: ${val(d.tenant1Name)}`, ML, y);
      pdf.text(`Name: ${val(d.tenant2Name)}`, ML + sigColW + 10, y); y += lh;
      pdf.text(`ID No: ${val(d.tenant1IdNo)}`, ML, y);
      pdf.text(`ID No: ${val(d.tenant2IdNo)}`, ML + sigColW + 10, y); y += lh * 2;
      pdf.setFontSize(10);

      line(ML, ML + CW, [150,150,150]); y += 3;

      // Landlord sigs
      pdf.setFont("NotoSerif", "bold"); pdf.text("LANDLORD", ML, y); y += lh;
      pdf.setFont("NotoSerif", "normal");
      pdf.text("I/We confirm acceptance of the above terms and conditions:", ML, y); y += lh;
      pdf.text(`Dated this ${this.ordinal(d.landlordSignDate)} day of ${val(d.landlordSignMonth)} 20${val(d.landlordSignYear)}.`, ML, y); y += lh * 3;
      line(ML, ML + sigColW, [80,80,80]);
      line(ML + sigColW + 10, ML + CW, [80,80,80]);
      y += lh * 0.5;
      pdf.setFontSize(9.5);
      pdf.text("Signature Of Landlord (or its authorized signatory)", ML, y);
      pdf.text("Signature Of Landlord (or its authorized signatory)", ML + sigColW + 10, y); y += lh;
      pdf.text(`Name: ${val(d.landlordName)}`, ML, y);
      pdf.text(`Name: ${val(d.landlord2Name)}`, ML + sigColW + 10, y); y += lh;
      pdf.text(`ID No: ${val(d.landlordNric)}`, ML, y);
      pdf.text(`ID No: ${val(d.landlord2IdNo)}`, ML + sigColW + 10, y); y += lh * 2;
      pdf.setFontSize(10);

      // Disclaimer p2
      pdf.setFontSize(9); pdf.setFont("NotoSerif", "bold"); pdf.setTextColor(80,80,80);
      checkY(); pdf.text("Disclaimer", ML, y); y += lh * 0.9;
      pdf.setFont("NotoSerif", "normal");
      pdf.splitTextToSize(disc, CW).forEach((l) => { checkY(); pdf.text(l, ML, y); y += lh * 0.9; });
      pdf.setTextColor(0,0,0); pdf.setFontSize(9);
      checkY(); pdf.text("(*Delete if not applicable)", ML, y); y += lh;
      checkY(); pdf.text("Page 2     Updated 032026", ML + CW, y, { align: "right" });

      // Filename
      const unit = (d.propertyAddress || "").replace(/[^a-zA-Z0-9#-]/g, "_").slice(0, 30);
      const tenant = (d.tenantName || "LOI").replace(/[^a-zA-Z0-9]/g, "_");
      const dateStr = (d.loiDate || "").replace(/-/g, "");
      pdf.save([unit, tenant, "LOI", dateStr].filter(Boolean).join("-") + ".pdf");

    } catch (err) {
      console.error("LOI PDF error:", err);
      alert("PDF export failed: " + err.message);
    } finally {
      btns.forEach((b) => { b.innerHTML = '<i class="bi bi-file-earmark-pdf me-1"></i>Export PDF'; b.disabled = false; });
    }
  }

  // ─── DOCX Export ───────────────────────────────────────────────────────────

  async exportToDocx() {
    const btns = ["loiExportDocxBtn", "loiExportDocxBtn2"].map((id) => document.getElementById(id)).filter(Boolean);
    btns.forEach((b) => { b.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Exporting...'; b.disabled = true; });

    try {
      if (!window.DocxLib) throw new Error("DOCX library not available");
      const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, PageBreak } = window.DocxLib;

      const d = this.loiData;
      const val = (v) => v && String(v).trim() ? String(v) : "___________";

      const noBorder = { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } };

      const run = (text, opts = {}) => new TextRun({ text: String(text || ""), bold: opts.bold || false, size: (opts.size || 10) * 2, font: "Times New Roman", italics: opts.italic || false, color: opts.color || "000000" });
      const para = (children, opts = {}) => new Paragraph({ alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: opts.after || 40, before: opts.before || 0 }, children: Array.isArray(children) ? children : [children] });

      // Two-column label-body row in a borderless table
      const labelBodyRow = (label, bodyRuns) => new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE } },
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 28, type: WidthType.PERCENTAGE }, borders: noBorder, children: [para(run(label, { bold: true }))] }),
          new TableCell({ width: { size: 72, type: WidthType.PERCENTAGE }, borders: noBorder, children: [para(bodyRuns)] }),
        ]})],
      });

      const children = [];

      // Title
      children.push(para(run("Letter Of Intent", { bold: true, size: 14 }), { center: true, after: 60 }));
      children.push(para(run("(ERA Serving Landlord)", { size: 10 }), { center: true, after: 80 }));

      // Date + To
      children.push(labelBodyRow("Date:", [run(val(this.formatDateDisplay(d.loiDate)))]));
      children.push(para(run(""), { after: 40 }));
      children.push(labelBodyRow("To:", [run(val(d.landlordName)), run("\n"), run(val(d.landlordNric))]));
      children.push(para(run(""), { after: 60 }));
      children.push(para(run("SUBJECT TO CONTRACT", { bold: true }), { center: true, after: 60 }));
      children.push(para(run("Dear Sir/Mdm,"), { after: 60 }));

      // RE line
      children.push(new Paragraph({
        spacing: { after: 60 },
        children: [run("RE: LETTER OF INTENT FOR TENANCY OF  ", { bold: true }), run(val(d.propertyAddress)), run('  (the "Property")', { size: 9, color: "888888" })],
      }));

      // Opening para
      const tenantLine = [d.tenantName, d.tenantFin ? `FIN:${d.tenantFin}` : ""].filter(Boolean).join(" ") || "___________";
      children.push(para([run(`Pursuant to your request to rent out the Property, we are pleased to inform you that `), run(tenantLine, { bold: true }), run(`, intends to rent the Property based on the following terms and conditions:`)], { after: 80 }));

      // Rows
      children.push(labelBodyRow("Rent", [run(`S$${val(d.monthlyRent)} per month (`), run(val(d.furnishing), { bold: true }), run(`) inclusive of maintenance charges, payable monthly in advance, on the `), run(val(d.paymentDay), { bold: true }), run(` day of each month.`)]));
      children.push(para(run(""), { after: 40 }));
      children.push(labelBodyRow("Tenancy Commences On", [run(val(this.formatDateDisplay(d.commencementDate)), { bold: true })]));
      children.push(para(run(""), { after: 40 }));
      children.push(labelBodyRow("Duration Of Tenancy", [run(val(d.leaseDurationMonths), { bold: true }), run(` months with an Option To Renew for a further `), run(val(d.renewalMonths), { bold: true }), run(` months at the then prevailing market rent.`)]));
      children.push(para(run(""), { after: 40 }));
      children.push(labelBodyRow("Diplomatic Clause", [
        run(`The Tenant is entitled to preterminate the Tenancy by giving at least `), run(val(d.diplomaticNoticeMonths), { bold: true }),
        run(` month(s) written notice if the Tenant/Occupant is transferred out of Singapore permanently by his organisation or ceases to be employed, provided that:\n\na.  Such notice may be given only after a Tenancy period of at least twelve (12) months, and\n\nb.  The Tenant shall refund to the Landlord, in respect of the unexpired portion of the Tenancy, a proportionate part of the commission of S$`),
        run(val(d.diplomaticCommission), { bold: true }),
        run(` (inclusive of Goods and Services Tax), paid by the Landlord to the Landlord's real estate agent.`),
      ]));
      children.push(para(run(""), { after: 40 }));
      children.push(labelBodyRow("Security Deposit", [run("S$"), run(val(d.securityDeposit), { bold: true })]));
      children.push(para(run(""), { after: 40 }));
      children.push(labelBodyRow("Utilities Supply", [run("Charges for the supply of water, electricity and gas shall be borne by the Tenant.")]));
      children.push(para(run(""), { after: 40 }));
      children.push(labelBodyRow("Internet Service Provider", [run("Internet Service Provider Charges shall be borne by the Tenant.")]));
      children.push(para(run(""), { after: 40 }));
      children.push(labelBodyRow("Telecommunication Charges", [run("Telecommunication Charges shall be borne by the Tenant.")]));
      children.push(para(run(""), { after: 40 }));
      children.push(labelBodyRow("Singapore Cable Vision", [run("Charges for Singapore Cable Vision facilities which are incurred by the Tenant shall be borne by the Tenant.")]));
      children.push(para(run(""), { after: 40 }));
      children.push(labelBodyRow("Occupants", [run("Only persons approved by the Landlord are permitted to occupy the Property, which approval shall not be unreasonably withheld. The Tenant shall at all times ensure that all occupants of the Property comply with all applicable laws for entering and staying in Singapore.")]));
      children.push(para(run(""), { after: 40 }));
      children.push(labelBodyRow("Stamp Duty", [run("Stamp duty on the Tenancy Agreement and other administration charges shall be borne by the Tenant.")]));
      children.push(para(run(""), { after: 40 }));
      children.push(labelBodyRow("Due Diligence", [run("Prior to execution of the Tenancy Agreement, the Tenant shall produce all relevant documents to verify that the Tenants/Permitted Occupiers are not prohibited immigrants under the provisions of the Immigration Act.")]));
      children.push(para(run(""), { after: 40 }));
      children.push(labelBodyRow("Lapse Of Offer", [run(`This offer shall lapse within `), run(this.numberToWords(d.lapseOfferDays), { bold: true }), run(` (`), run(val(d.lapseOfferDays), { bold: true }), run(`) days from the date hereof. In the event this offer is not accepted by the stipulated date, any deposit or monies received by the Landlord shall be returned to the Tenant immediately and thereafter neither party shall have any claims against each other.`)]));
      children.push(para(run(""), { after: 40 }));
      children.push(labelBodyRow("Tenant's Other Requirements", [run(val(d.tenantRequirements))]));
      children.push(para(run(""), { after: 80 }));

      // Disclaimer p1
      children.push(new Paragraph({ spacing: { after: 40 }, children: [run("Disclaimer", { bold: true, size: 9, color: "555555" }), run("  This template may not be appropriate for use in all property transactions and does not relieve parties of their responsibility to seek appropriate advice from relevant professionals such as lawyers. Parties, through the use of this template (including any amendments made), agree that ERA Realty Network and its salesperson(s) shall not be liable for any damages whatsoever arising from the use of this template.", { size: 9, color: "555555" })] }));
      children.push(para(run("(*Delete if not applicable)", { size: 9, color: "888888" }), { after: 20 }));
      children.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [run("Page 1     Updated 032026", { size: 9, color: "888888" })] }));

      // Page break
      children.push(new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }));

      // ── PAGE 2 ──
      children.push(para(run("Good Faith Deposit", { bold: true, size: 11 }), { after: 80 }));

      const ch = d.gfdMethod === "cheque";
      const tr = d.gfdMethod === "transfer";

      children.push(para([run(ch ? "☑ " : "☐ "), run(`*Enclosed please find the amount ${ch ? `$${val(d.gfdAmount)}` : "$_______________"} (Cheque No: ${ch ? val(d.gfdChequeNo) : "_______________"} ) being payment of the good faith deposit.`)], { after: 60 }));
      children.push(para([run(tr ? "☑ " : "☐ "), run(`*In furtherance of this Letter of Intent, the Tenant hereby transfers the good faith deposit of `), run(tr ? `$${val(d.gfdAmount)}` : "$_______________", { bold: tr }), run(` to the Landlord as per the following details.`)], { after: 60 }));
      children.push(new Paragraph({ spacing: { after: 60 }, children: [run(`Bank: ${tr ? val(d.gfdBankName) : "_______________"}     Account Name: ${tr ? val(d.gfdAccountName) : "_______________"}`)] }));
      children.push(para(run(`Bank Account No / PayNow: ${tr ? val(d.gfdAccountNo) : "_______________"}`), { after: 80 }));
      children.push(para([run(`In the event this offer is accepted by the Landlord and the Tenant fails to execute the Tenancy Agreement by `), run(val(this.formatDateDisplay(d.gfdForfeitureDate)), { bold: true }), run(`, the good faith deposit submitted shall be forfeited to the Landlord and thereafter, neither party shall have any claim against the other.`)], { after: 60 }));
      children.push(para(run("Please confirm your acceptance to the above by signing below."), { after: 60 }));
      children.push(para(run("Yours faithfully,"), { after: 200 }));

      // Agent sig block
      children.push(new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: "555555" } }, spacing: { before: 0, after: 40 }, children: [run("ERA Salesperson", { bold: true })] }));
      children.push(para(run(`Name: ${val(d.agentName)}`), { after: 20 }));
      children.push(para(run(`CEA Reg No: ${val(d.agentCeaNo)}`), { after: 20 }));
      children.push(para(run(`Associate Code: ${val(d.agentAssociateCode)}`), { after: 120 }));

      // Divider
      children.push(new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: "999999" } }, spacing: { before: 0, after: 60 }, children: [] }));

      // Tenant sigs
      children.push(para(run("TENANT", { bold: true }), { after: 40 }));
      children.push(para(run("I/We confirm acceptance of the above terms and conditions:"), { after: 40 }));
      children.push(para([run(`Dated this `), run(this.ordinal(d.tenantSignDate), { bold: true }), run(` day of `), run(val(d.tenantSignMonth), { bold: true }), run(` 20`), run(val(d.tenantSignYear), { bold: true }), run(`.`)], { after: 200 }));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE } },
        rows: [
          new TableRow({ children: [
            new TableCell({ width: { size: 48, type: WidthType.PERCENTAGE }, borders: noBorder, children: [
              new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: "555555" } }, spacing: { before: 0, after: 40 }, children: [run("Signature of Tenant (or its authorized signatory)", { size: 9 })] }),
              para(run(`Name: ${val(d.tenant1Name)}`), { after: 20 }),
              para(run(`ID No: ${val(d.tenant1IdNo)}`)),
            ] }),
            new TableCell({ width: { size: 4, type: WidthType.PERCENTAGE }, borders: noBorder, children: [para(run(""))] }),
            new TableCell({ width: { size: 48, type: WidthType.PERCENTAGE }, borders: noBorder, children: [
              new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: "555555" } }, spacing: { before: 0, after: 40 }, children: [run("Signature of Tenant (or its authorized signatory)", { size: 9 })] }),
              para(run(`Name: ${val(d.tenant2Name)}`), { after: 20 }),
              para(run(`ID No: ${val(d.tenant2IdNo)}`)),
            ] }),
          ]}),
        ],
      }));
      children.push(para(run(""), { after: 80 }));

      // Divider
      children.push(new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: "999999" } }, spacing: { before: 0, after: 60 }, children: [] }));

      // Landlord sigs
      children.push(para(run("LANDLORD", { bold: true }), { after: 40 }));
      children.push(para(run("I/We confirm acceptance of the above terms and conditions:"), { after: 40 }));
      children.push(para([run(`Dated this `), run(this.ordinal(d.landlordSignDate), { bold: true }), run(` day of `), run(val(d.landlordSignMonth), { bold: true }), run(` 20`), run(val(d.landlordSignYear), { bold: true }), run(`.`)], { after: 200 }));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE } },
        rows: [
          new TableRow({ children: [
            new TableCell({ width: { size: 48, type: WidthType.PERCENTAGE }, borders: noBorder, children: [
              new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: "555555" } }, spacing: { before: 0, after: 40 }, children: [run("Signature Of Landlord (or its authorized signatory)", { size: 9 })] }),
              para(run(`Name: ${val(d.landlordName)}`), { after: 20 }),
              para(run(`ID No: ${val(d.landlordNric)}`)),
            ] }),
            new TableCell({ width: { size: 4, type: WidthType.PERCENTAGE }, borders: noBorder, children: [para(run(""))] }),
            new TableCell({ width: { size: 48, type: WidthType.PERCENTAGE }, borders: noBorder, children: [
              new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: "555555" } }, spacing: { before: 0, after: 40 }, children: [run("Signature Of Landlord (or its authorized signatory)", { size: 9 })] }),
              para(run(`Name: ${val(d.landlord2Name)}`), { after: 20 }),
              para(run(`ID No: ${val(d.landlord2IdNo)}`)),
            ] }),
          ]}),
        ],
      }));
      children.push(para(run(""), { after: 80 }));

      // Disclaimer p2
      children.push(new Paragraph({ spacing: { after: 40 }, children: [run("Disclaimer", { bold: true, size: 9, color: "555555" }), run("  This template may not be appropriate for use in all property transactions and does not relieve parties of their responsibility to seek appropriate advice from relevant professionals such as lawyers. Parties, through the use of this template (including any amendments made), agree that ERA Realty Network and its salesperson(s) shall not be liable for any damages whatsoever arising from the use of this template.", { size: 9, color: "555555" })] }));
      children.push(para(run("(*Delete if not applicable)", { size: 9, color: "888888" }), { after: 20 }));
      children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [run("Page 2     Updated 032026", { size: 9, color: "888888" })] }));

      const doc = new Document({ sections: [{ properties: { page: { margin: { top: 900, right: 1020, bottom: 900, left: 1020 } } }, children }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const unit = (d.propertyAddress || "").replace(/[^a-zA-Z0-9#-]/g, "_").slice(0, 30);
      const tenant = (d.tenantName || "LOI").replace(/[^a-zA-Z0-9]/g, "_");
      const dateStr = (d.loiDate || "").replace(/-/g, "");
      a.download = [unit, tenant, "LOI", dateStr].filter(Boolean).join("-") + ".docx";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("LOI DOCX error:", err);
      alert("DOCX export failed: " + err.message);
    } finally {
      btns.forEach((b) => { b.innerHTML = '<i class="bi bi-file-earmark-word me-1"></i>Export DOCX'; b.disabled = false; });
    }
  }

  // ─── Form Reset ────────────────────────────────────────────────────────────

  clearForm() {
    this.loiData = {
      loiDate: new Date().toISOString().split("T")[0],
      landlordName: "", landlordNric: "",
      propertyAddress: "",
      tenantName: "", tenantFin: "",
      monthlyRent: "", furnishing: "partially furnished as per attached Inventory List", paymentDay: "1",
      commencementDate: "", leaseDurationMonths: "12", renewalMonths: "24",
      diplomaticNoticeMonths: "02", diplomaticCommission: "",
      securityDeposit: "", lapseOfferDays: "02", tenantRequirements: "",
      gfdMethod: "transfer", gfdAmount: "", gfdChequeNo: "", gfdBankName: "", gfdAccountName: "", gfdAccountNo: "", gfdForfeitureDate: "",
      agentName: "", agentCeaNo: "", agentAssociateCode: "",
      tenantSignDate: "", tenantSignMonth: "", tenantSignYear: new Date().getFullYear().toString().slice(-2),
      tenant1Name: "", tenant1IdNo: "", tenant2Name: "", tenant2IdNo: "",
      landlordSignDate: "", landlordSignMonth: "", landlordSignYear: new Date().getFullYear().toString().slice(-2),
      landlord2Name: "", landlord2IdNo: "",
    };
    const section = document.getElementById("loi-section");
    if (!section) return;
    section.querySelectorAll("[data-loi-field]").forEach((el) => {
      const f = el.dataset.loiField;
      if (el.type === "checkbox") el.checked = !!this.loiData[f];
      else if (el.type === "radio") el.checked = el.value === this.loiData[f];
      else el.value = this.loiData[f] || "";
    });
    this.renderPreview();
  }

  syncFormFromData() {
    const section = document.getElementById("loi-section");
    if (!section) return;
    section.querySelectorAll("[data-loi-field]").forEach((el) => {
      const f = el.dataset.loiField;
      if (!(f in this.loiData)) return;
      if (el.type === "checkbox") el.checked = !!this.loiData[f];
      else if (el.type === "radio") el.checked = el.value === this.loiData[f];
      else el.value = this.loiData[f] || "";
    });
  }

  refresh() {
    this.syncFormFromData();
    this.renderPreview();
    this.bindFieldEvents();
  }

  escapeHtml(t) {
    if (!t) return "";
    const d = document.createElement("div"); d.textContent = t; return d.innerHTML;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { window.loiManager = new LoiManagementComponent(); });
} else {
  window.loiManager = new LoiManagementComponent();
}
