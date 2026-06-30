/**
 * Common Prompt Component
 * A library of commonly used text message prompts for property management
 */
class CommonPromptComponent {
  constructor() {
    this.properties = [];
    this.selectedPropertyId = null;
    this.exchangeRate = 21000;
    this.mode = "single"; // 'single' | 'all'

    // AC Booking dynamic state
    this.acBookingDate = new Date().toISOString().split("T")[0];
    this.acBookingTime = "10:00";
    this.propertyTenants = [];
    this.propertyInvestors = [];
    this.selectedContactTenantId = null;
    this.acServiceCompany = null;
    this.lastFetchedPropertyId = null;
    this.acScheduledData = {}; // propertyId -> { tenants, company, contactTenantId }
    this.acContractorGroupList = []; // [{company, propertyIds[]}]

    // Camera Order dynamic state
    this.cameraQuantity = 2;

    // Portable Aircon Order state
    this.airconOrders = {}; // propertyId -> { airconQty, hose2m, hose3m, remotes }

    this.prompts = this.initializePrompts();
    this.eventsBound = false;
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadProperties();
    this.renderPromptLibrary();
    this.loadCurrentExchangeRate();
    // Also update if rate changes while page is open
    window.addEventListener("exchangeRateUpdated", (e) => {
      if (e.detail?.rate) {
        this.exchangeRate = e.detail.rate;
        const input = document.getElementById("exchangeRateInput");
        if (input) input.value = e.detail.rate;
        this.updateActivePromptPreview();
        if (this.mode === "all") this.renderBulkMessages();
      }
    });
  }

  async loadCurrentExchangeRate() {
    try {
      const res = await API.get(API_CONFIG.ENDPOINTS.EXCHANGE_RATE_CURRENT);
      const data = await res.json();
      if (data.success && data.rate) {
        this.exchangeRate = data.rate.rate;
        const input = document.getElementById("exchangeRateInput");
        if (input) input.value = data.rate.rate;
        this.updateActivePromptPreview();
        if (this.mode === "all") this.renderBulkMessages();
      }
    } catch (e) {
      // keep default
    }
  }

  ensureEventsBound() {
    if (this.eventsBound) return;
    this.bindEvents();
  }

  initializePrompts() {
    return [
      {
        id: "rent-collection",
        name: "Thu tiền thuê tháng",
        description: "Tin nhắn nhắc tenant chuyển khoản tiền thuê hàng tháng",
        icon: "bi-cash-coin",
        requiresProperty: true,
        template: this.getRentCollectionTemplate.bind(this),
      },
      {
        id: "ac-clean-booking",
        name: "Đặt lịch vệ sinh AC",
        description: "Tin nhắn đặt lịch vệ sinh máy lạnh với contractor",
        icon: "bi-snow",
        requiresProperty: true,
        template: this.getAcCleanBookingTemplate.bind(this),
      },
      {
        id: "camera-order",
        name: "Order Camera",
        description: "Tin nhắn đặt mua Tapo TC71 + thẻ nhớ 64GB",
        icon: "bi-camera-video",
        requiresProperty: true,
        template: this.getCameraOrderTemplate.bind(this),
      },
      {
        id: "portable-aircon-order",
        name: "Order Portable Aircon",
        description: "Đặt mua portable aircon, dây hose và remote controller từ Lyn",
        icon: "bi-wind",
        requiresProperty: true,
        template: this.getPortableAirconTemplate.bind(this),
      },
    ];
  }

  getCurrentMonth() {
    const now = new Date();
    const target =
      now.getDate() > 20
        ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
        : now;
    return target.toLocaleDateString("vi-VN", { month: "numeric" });
  }

  getRentCollectionTemplate(property) {
    const currentMonth = this.getCurrentMonth();
    const rate = this.exchangeRate;

    // Get settlement account info from property
    const sgdBank = property?.settlementSgd?.bankName || "";
    const sgdAccountNo = property?.settlementSgd?.accountNumber || "";
    const sgdAccountHolder = property?.settlementSgd?.accountHolderName || "";
    const sgdPayNow = property?.settlementSgd?.payNow || "";

    const vndBank = property?.settlementVnd?.bankName || "";
    const vndAccountNo = property?.settlementVnd?.accountNumber || "";
    const vndAccountHolder = property?.settlementVnd?.accountHolderName || "";

    const sgdBlock = sgdBank
      ? `\n🇸🇬 Tài khoản Singapore (${sgdBank})
• Bank: ${sgdBank}
• Account No: ${sgdAccountNo}${sgdPayNow ? `\n• PayNow: ${sgdPayNow}` : ""}
• Name: ${sgdAccountHolder}`
      : "";

    const vndBlock = vndBank
      ? `\n\n\n🇻🇳 Tài khoản Việt Nam (${vndBank})
• Bank: ${vndBank}
• Account No: ${vndAccountNo}
• Tên: ${vndAccountHolder}`
      : "";

    return `Hi mọi người 🌸

Rent tháng ${currentMonth}, mọi người chuyển khoản giúp mình/em vào các tài khoản bên dưới nhé.

💱 Ai đóng bằng VND thì áp dụng theo tỷ giá: ${rate} nhé. Vài hôm nữa có bill pub thì em sẽ báo lại sau ạ

Sau khi chuyển khoản, mọi người vui lòng gửi hóa đơn qua tin nhắn riêng giúp mình/em để đảm bảo quyền riêng tư nhé.

${sgdBlock}${vndBlock}`;
  }

  getAcCleanBookingTemplate(property) {
    if (!property) return "Vui lòng chọn căn hộ để xem trước tin nhắn.";

    const date = this.formatDate(this.acBookingDate) || "[date]";
    const time = this.acBookingTime || "[time]";

    // Find main tenant
    const mainTenant =
      this.propertyTenants.find((t) => t.isMainTenant) ||
      this.propertyTenants[0];
    const mainTenantName = mainTenant ? mainTenant.name : "[tên]";
    const mainTenantPhone = mainTenant ? mainTenant.phoneNumber : "[sđt]";

    // AC units and bill
    const acUnits = property.airconUnits || 0;
    const bill = acUnits * 20;

    // Contact person (selected by user) — may be a tenant or investor
    const contact = this.resolveContact(
      this.selectedContactTenantId,
      this.propertyTenants,
      this.propertyInvestors,
    );
    const contactPhone = contact?.phoneNumber || "[sđt liên hệ]";

    return `hello

its our cleaning AC cycle again
I would like to book AC clean service for this property

DATE: ${date} ${time}

INFO TO WRITE IN THE BILL
#${property.unit || ""} ${property.address || ""}
name: ${mainTenantName}
phone: ${mainTenantPhone}
AC units: ${acUnits}
bill: ${bill}$

when u arrive the property, pls call this whatssap number to help open door 
${contactPhone}`;
  }

  getCameraOrderTemplate(property) {
    const street = property?.address || "[address]";
    const unit = property?.unit ? `#${property.unit}` : "";
    const postcode = property?.postcode ? `Singapore ${property.postcode}` : "";
    const addressLines = [street, unit, postcode].filter(Boolean).join("\n");
    const qty = this.cameraQuantity;
    const sets = qty === 1 ? "set" : "sets";
    return `Name
Jelly

Contact
Phone: 96977399

Address
${addressLines}

Order
${qty} ${sets} of Tapo TC71 + 64GB memory card

Please leave at the doorstep.`;
  }

  getAirconOrder(propertyId) {
    if (!this.airconOrders[propertyId]) {
      this.airconOrders[propertyId] = { airconQty: 0, hose2m: 0, hose3m: 0, remotes: 0, bringInside: false };
    }
    return this.airconOrders[propertyId];
  }

  buildAirconPropertyBlock(label, order, bringInside, digitalLockPin) {
    const itemLines = [];
    if (order.airconQty > 0) itemLines.push(`• Portable Aircon: ${order.airconQty} unit(s)`);
    if (order.hose2m > 0) itemLines.push(`• Hose 2m: ${order.hose2m} unit(s)`);
    if (order.hose3m > 0) itemLines.push(`• Hose 3m: ${order.hose3m} unit(s)`);
    if (order.remotes > 0) itemLines.push(`• Remote Controller: ${order.remotes} unit(s)`);
    if (itemLines.length === 0) return `📍 ${label}\n(No items selected)`;
    const deliveryLines = bringInside
      ? [`🏠 Please bring items inside the unit`, ...(digitalLockPin ? [`🔓 Door access PIN: ${digitalLockPin}`] : [])]
      : [`📦 Please leave at doorstep`];
    return `📍 ${label}\n${[...itemLines, ...deliveryLines].join("\n")}`;
  }

  getAirconRequirementsBlock() {
    return `📋 Product Requirements:
✅ Must come with insurance coverage
✅ Must operate quietly (low noise level)
✅ Must have inverter technology for energy savings`;
  }

  buildAirconSummary(orders) {
    const totals = orders.reduce(
      (acc, o) => {
        acc.airconQty += o.airconQty || 0;
        acc.hose2m += o.hose2m || 0;
        acc.hose3m += o.hose3m || 0;
        acc.remotes += o.remotes || 0;
        return acc;
      },
      { airconQty: 0, hose2m: 0, hose3m: 0, remotes: 0 },
    );
    const lines = [];
    if (totals.airconQty > 0) lines.push(`• Portable Aircon: ${totals.airconQty} unit(s)`);
    if (totals.hose2m > 0) lines.push(`• Hose 2m: ${totals.hose2m} unit(s)`);
    if (totals.hose3m > 0) lines.push(`• Hose 3m: ${totals.hose3m} unit(s)`);
    if (totals.remotes > 0) lines.push(`• Remote Controller: ${totals.remotes} unit(s)`);
    return lines.length > 0 ? lines.join("\n") : "(No items selected)";
  }

  buildCombinedAirconOrderMessage() {
    const sortedProperties = [...this.properties].sort(
      (a, b) => (parseInt(a.propertyId) || 0) - (parseInt(b.propertyId) || 0),
    );
    const activeProperties = sortedProperties.filter((p) => {
      const o = this.airconOrders[p.propertyId];
      return o && (o.airconQty > 0 || o.hose2m > 0 || o.hose3m > 0 || o.remotes > 0);
    });
    if (activeProperties.length === 0) {
      return "No items ordered yet. Please set quantities for at least one property above.";
    }
    const blocks = activeProperties.map((p) => {
      const order = this.airconOrders[p.propertyId];
      const unit = p.unit ? `#${p.unit} ` : "";
      const pin = order.bringInside && p.digitalLockEnabled ? p.digitalLockPin : null;
      return this.buildAirconPropertyBlock(`${unit}${p.address || ""}`, order, order.bringInside, pin);
    });
    const allOrders = activeProperties.map((p) => this.airconOrders[p.propertyId]);
    const unitWord = activeProperties.length === 1 ? "unit" : "units";
    return `Hi Lyn (+6580159026) 😊

I would like to order portable aircon items for the following ${unitWord}:

${blocks.join("\n\n")}

---
📋 Total Quotation:
${this.buildAirconSummary(allOrders)}

${this.getAirconRequirementsBlock()}

📸 Please send a photo as proof of delivery for each unit.
Please advise on pricing and availability. Thank you! 🙏`;
  }

  getPortableAirconTemplate(property) {
    if (!property) return "Vui lòng chọn căn hộ để xem trước tin nhắn.";
    const order = this.getAirconOrder(property.propertyId);
    const unit = property.unit ? `#${property.unit} ` : "";
    const label = `${unit}${property.address || "[address]"}`;
    const pin = order.bringInside && property.digitalLockEnabled ? property.digitalLockPin : null;
    return `Hi Lyn (+6580159026) 😊

I would like to order portable aircon items for the following unit:

${this.buildAirconPropertyBlock(label, order, order.bringInside, pin)}

---
📋 Total Quotation:
${this.buildAirconSummary([order])}

${this.getAirconRequirementsBlock()}

📸 Please send a photo as proof of delivery.
Please advise on pricing and availability. Thank you! 🙏`;
  }

  bindEvents() {
    // Property selection change
    const propertySelect = document.getElementById(
      "commonPromptPropertySelect",
    );
    if (propertySelect && !propertySelect.hasAttribute("data-bound")) {
      propertySelect.setAttribute("data-bound", "true");
      propertySelect.addEventListener("change", (e) => {
        this.selectedPropertyId = e.target.value;
        this.updateActivePromptPreview();
      });
    }

    // Copy button
    const copyBtn = document.getElementById("copyPromptBtn");
    if (copyBtn && !copyBtn.hasAttribute("data-bound")) {
      copyBtn.setAttribute("data-bound", "true");
      copyBtn.addEventListener("click", () => this.copyPromptToClipboard());
    }

    // Exchange rate input
    const rateInput = document.getElementById("exchangeRateInput");
    if (rateInput && !rateInput.hasAttribute("data-bound")) {
      rateInput.setAttribute("data-bound", "true");
      rateInput.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val > 0) {
          this.exchangeRate = val;
          this.updateActivePromptPreview();
          if (this.mode === "all") {
            this.renderBulkMessages();
          }
        }
      });
    }

    // Hotkey: Cmd/Ctrl+Shift+C → copy active prompt to clipboard
    if (!document.getElementById("commonPromptHotkeyBound")) {
      const marker = document.createElement("span");
      marker.id = "commonPromptHotkeyBound";
      marker.style.display = "none";
      document.body.appendChild(marker);

      document.addEventListener("keydown", (e) => {
        if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.key !== "C") return;
        const previewSection = document.getElementById("promptPreviewSection");
        if (!previewSection || previewSection.style.display === "none") return;
        e.preventDefault();
        if (this.activePromptId === "portable-aircon-order" && this.mode === "all") {
          this.copyCombinedAirconMessage();
        } else {
          this.copyPromptToClipboard();
        }
      });

      // Patch copy button title to show hotkey hint
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform) ||
        navigator.userAgentData?.platform === "macOS";
      const mod = isMac ? "⌘" : "Ctrl+";
      document.getElementById("copyPromptBtn")
        ?.setAttribute("title", `Copy to clipboard (${mod}⇧C)`);
    }

    // Mark events as bound if all key elements exist
    if (propertySelect && copyBtn && rateInput) {
      this.eventsBound = true;
    }
  }

  setSingleMode() {
    this.mode = "single";

    document
      .getElementById("singlePropertyModeBtn")
      ?.classList.replace("btn-outline-info", "btn-info");
    document
      .getElementById("singlePropertyModeBtn")
      ?.classList.remove("btn-outline-primary");
    document.getElementById("singlePropertyModeBtn")?.classList.add("btn-info");
    document
      .getElementById("allPropertiesModeBtn")
      ?.classList.remove("btn-primary");
    document
      .getElementById("allPropertiesModeBtn")
      ?.classList.add("btn-outline-primary");

    document.getElementById("singlePropertySelectWrapper").style.display =
      "block";
    document.getElementById("singlePromptPreview").style.display = "block";
    document.getElementById("bulkMessagesSection").style.display = "none";
  }

  setAllMode() {
    this.mode = "all";

    document
      .getElementById("singlePropertyModeBtn")
      ?.classList.remove("btn-info");
    document
      .getElementById("singlePropertyModeBtn")
      ?.classList.add("btn-outline-info");
    document
      .getElementById("allPropertiesModeBtn")
      ?.classList.remove("btn-outline-primary");
    document
      .getElementById("allPropertiesModeBtn")
      ?.classList.add("btn-primary");

    document.getElementById("singlePropertySelectWrapper").style.display =
      "none";
    document.getElementById("singlePromptPreview").style.display = "none";
    document.getElementById("bulkMessagesSection").style.display = "block";
    // Hide per-property controls in bulk mode (controls are per-card)
    const controlsContainer = document.getElementById(
      "promptControlsContainer",
    );
    if (controlsContainer) controlsContainer.style.display = "none";

    this.renderBulkMessages();
  }

  renderBulkMessages() {
    if (this.activePromptId === "ac-clean-booking") {
      this.renderAcScheduledBulk();
      return;
    }
    if (this.activePromptId === "portable-aircon-order") {
      this.renderPortableAirconBulk();
      return;
    }

    const container = document.getElementById("bulkMessagesContainer");
    const countBadge = document.getElementById("bulkPropertyCount");
    if (!container) return;

    const prompt = this.prompts.find((p) => p.id === this.activePromptId);
    if (!prompt || this.properties.length === 0) {
      container.innerHTML =
        '<div class="text-center text-muted py-3"><i class="bi bi-hourglass-split me-2"></i>Đang tải danh sách căn hộ...</div>';
      return;
    }

    if (countBadge) {
      countBadge.textContent = `${this.properties.length} căn hộ`;
    }

    let html = '<div class="row g-3">';
    const sortedProperties = [...this.properties].sort(
      (a, b) => (parseInt(b.propertyId) || 0) - (parseInt(a.propertyId) || 0),
    );
    sortedProperties.forEach((property, index) => {
      const message = prompt.template(property);
      const escapedMessage = this.escapeHtml(message);
      const propertyLabel = `${property.propertyId} - ${property.address || ""}`;
      const imgHtml = property.propertyImage
        ? `<img src="${this.escapeHtml(property.propertyImage)}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0;">`
        : `<div style="width:56px;height:56px;border-radius:8px;background:#e9ecef;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="bi bi-building text-muted" style="font-size:1.4rem;"></i></div>`;
      const tenantFbHtml = property.tenantFacebookGroup
        ? `<a href="${this.escapeHtml(property.tenantFacebookGroup)}" target="_blank" rel="noopener noreferrer"
             style="display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:20px;background:#1877F2;color:#fff;text-decoration:none;font-size:12px;font-weight:600;white-space:nowrap;"
             title="Tenant Facebook Group">
             <i class="bi bi-people-fill"></i> Tenant Group
           </a>`
        : "";
      const adminFbHtml = property.adminFacebookGroup
        ? `<a href="${this.escapeHtml(property.adminFacebookGroup)}" target="_blank" rel="noopener noreferrer"
             style="display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:20px;background:#212529;color:#fff;text-decoration:none;font-size:12px;font-weight:600;white-space:nowrap;"
             title="Admin Facebook Group">
             <i class="bi bi-shield-fill"></i> Admin Group
           </a>`
        : "";
      const fbLinksHtml =
        tenantFbHtml || adminFbHtml
          ? `<div class="d-flex gap-2 px-3 py-2 align-items-center" style="background:#f0f4ff;border-top:1px solid #dee2e6;">
             <span style="font-size:11px;color:#6c757d;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-right:4px;">Facebook:</span>
             ${tenantFbHtml}
             ${adminFbHtml}
           </div>`
          : "";
      html += `
        <div class="col-12 col-md-6">
          <div class="border rounded overflow-hidden h-100 d-flex flex-column">
            <div class="d-flex justify-content-between align-items-center px-3 py-2 bg-light gap-3">
              <div class="d-flex align-items-center gap-3">
                ${imgHtml}
                <strong style="font-size:15px;">${this.escapeHtml(propertyLabel)}</strong>
              </div>
              <button
                class="btn btn-sm btn-outline-success flex-shrink-0"
                onclick="commonPromptComponent.copyBulkMessage(${index})"
                data-bulk-index="${index}"
              >
                <i class="bi bi-clipboard me-1"></i>Copy
              </button>
            </div>
            ${fbLinksHtml}
            <textarea
              class="form-control border-0 rounded-0 flex-grow-1"
              rows="14"
              readonly
              data-bulk-msg="${index}"
              style="font-family: 'Noto Serif', serif; font-size: 13px; line-height: 1.6; background-color: #fafafa; resize: none;"
            >${escapedMessage}</textarea>
          </div>
        </div>
      `;
    });
    html += "</div>";

    container.innerHTML = html;
  }

  async copyBulkMessage(index) {
    const textarea = document.querySelector(`[data-bulk-msg="${index}"]`);
    if (!textarea) return;

    const btn = document.querySelector(`[data-bulk-index="${index}"]`);
    try {
      await navigator.clipboard.writeText(textarea.value);
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Đã copy!';
        btn.classList.replace("btn-outline-success", "btn-success");
        setTimeout(() => {
          btn.innerHTML = orig;
          btn.classList.replace("btn-success", "btn-outline-success");
        }, 2000);
      }
    } catch {
      textarea.select();
      document.execCommand("copy");
    }
  }

  async copyAllMessages() {
    if (this.activePromptId === "portable-aircon-order") {
      await this.copyCombinedAirconMessage();
      return;
    }
    const prompt = this.prompts.find((p) => p.id === this.activePromptId);
    if (!prompt) return;

    const allText = this.properties
      .map((p) => {
        const label = `=== ${p.propertyId} - ${p.address || ""} ===`;
        return `${label}\n${prompt.template(p)}`;
      })
      .join("\n\n" + "─".repeat(50) + "\n\n");

    const btn = document.getElementById("copyAllMessagesBtn");
    try {
      await navigator.clipboard.writeText(allText);
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Đã copy tất cả!';
        btn.classList.replace("btn-light", "btn-success");
        setTimeout(() => {
          btn.innerHTML = orig;
          btn.classList.replace("btn-success", "btn-light");
        }, 2000);
      }
    } catch {
      alert("Không thể copy tự động. Vui lòng copy từng tin nhắn.");
    }
  }

  async loadProperties() {
    try {
      // Fetch all properties with pagination
      let allProperties = [];
      let currentPage = 1;
      const itemsPerPage = 50;
      let hasMorePages = true;

      while (hasMorePages) {
        const response = await API.get(
          `${API_CONFIG.ENDPOINTS.PROPERTIES}?page=${currentPage}&limit=${itemsPerPage}`,
        );
        const result = await response.json();

        if (result.success) {
          allProperties = allProperties.concat(result.properties || []);
          hasMorePages =
            result.pagination && currentPage < result.pagination.totalPages;
          currentPage++;
        } else {
          console.error(
            "[CommonPrompt] Failed to load properties:",
            result.error,
          );
          hasMorePages = false;
        }
      }

      this.properties = allProperties;
      console.log(
        `📋 [CommonPrompt] Loaded ${this.properties.length} properties`,
      );
      this.populatePropertyDropdown();
    } catch (error) {
      console.error("[CommonPrompt] Error loading properties:", error);
      this.properties = [];
    }
  }

  isAcScheduledThisMonth(property) {
    if (!property.moveInDate) return false;
    const moveIn = new Date(property.moveInDate);
    const now = new Date();
    const monthsDiff =
      (now.getFullYear() - moveIn.getFullYear()) * 12 +
      (now.getMonth() - moveIn.getMonth());
    return monthsDiff >= 3 && monthsDiff % 3 === 0;
  }

  populatePropertyDropdown() {
    const select = document.getElementById("commonPromptPropertySelect");
    if (!select) return;

    select.innerHTML = '<option value="">-- Chọn căn hộ --</option>';

    if (this.activePromptId === "ac-clean-booking") {
      const scheduled = this.properties.filter((p) =>
        this.isAcScheduledThisMonth(p),
      );
      const others = this.properties.filter(
        (p) => !this.isAcScheduledThisMonth(p),
      );

      if (scheduled.length > 0) {
        const groupScheduled = document.createElement("optgroup");
        groupScheduled.label = `🔔 AC due this month (${scheduled.length})`;
        scheduled.forEach((property) => {
          const option = document.createElement("option");
          option.value = property.propertyId;
          option.textContent = `${property.propertyId} - ${property.address}`;
          groupScheduled.appendChild(option);
        });
        select.appendChild(groupScheduled);
      }

      if (others.length > 0) {
        const groupOthers = document.createElement("optgroup");
        groupOthers.label = "Other properties";
        others.forEach((property) => {
          const option = document.createElement("option");
          option.value = property.propertyId;
          option.textContent = `${property.propertyId} - ${property.address}`;
          groupOthers.appendChild(option);
        });
        select.appendChild(groupOthers);
      }
    } else {
      this.properties.forEach((property) => {
        const option = document.createElement("option");
        option.value = property.propertyId;
        option.textContent = `${property.propertyId} - ${property.address}`;
        select.appendChild(option);
      });
    }
  }

  renderPromptLibrary() {
    const container = document.getElementById("promptLibraryContainer");
    if (!container) return;

    let html = '<div class="row g-3">';

    this.prompts.forEach((prompt) => {
      html += `
        <div class="col-md-4">
          <div class="card h-100 prompt-card"
               data-prompt-id="${prompt.id}"
               onclick="commonPromptComponent.selectPrompt('${prompt.id}')"
               style="cursor: pointer; transition: all 0.2s ease;">
            <div class="card-body text-center">
              <div class="mb-3">
                <i class="bi ${prompt.icon}" style="font-size: 2.5rem; color: #667eea;"></i>
              </div>
              <h5 class="card-title">${this.escapeHtml(prompt.name)}</h5>
              <p class="card-text text-muted small">${this.escapeHtml(prompt.description)}</p>
              ${prompt.requiresProperty ? '<span class="badge bg-info"><i class="bi bi-building me-1"></i>Cần chọn căn hộ</span>' : ""}
            </div>
          </div>
        </div>
      `;
    });

    html += "</div>";
    container.innerHTML = html;

    // Add card hover styles
    this.addPromptCardStyles();
  }

  addPromptCardStyles() {
    if (!document.getElementById("common-prompt-card-styles")) {
      const style = document.createElement("style");
      style.id = "common-prompt-card-styles";
      style.textContent = `
        .prompt-card {
          border: 2px solid #e3e6f0;
          border-radius: 12px;
        }
        .prompt-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
          border-color: #667eea;
        }
        .prompt-card.selected {
          border-color: #667eea;
          background-color: #f8f9fe;
        }
      `;
      document.head.appendChild(style);
    }
  }

  selectPrompt(promptId) {
    // Find the prompt
    const prompt = this.prompts.find((p) => p.id === promptId);
    if (!prompt) return;

    // Update selected state visually
    document.querySelectorAll(".prompt-card").forEach((card) => {
      card.classList.remove("selected");
    });
    const selectedCard = document.querySelector(
      `[data-prompt-id="${promptId}"]`,
    );
    if (selectedCard) {
      selectedCard.classList.add("selected");
    }

    // Store active prompt
    this.activePromptId = promptId;

    // Show preview section
    const previewSection = document.getElementById("promptPreviewSection");
    if (previewSection) {
      previewSection.style.display = "block";
    }

    // Show/hide exchange rate section
    const exchangeRateSection = document.getElementById("exchangeRateSection");
    if (exchangeRateSection) {
      exchangeRateSection.style.display =
        prompt.id === "rent-collection" ? "block" : "none";
    }

    // Show/hide property selector based on requirement
    const propertySelectorSection = document.getElementById(
      "propertySelectSection",
    );
    if (propertySelectorSection) {
      propertySelectorSection.style.display = prompt.requiresProperty
        ? "block"
        : "none";
    }

    // Show/hide dynamic controls container
    const controlsContainer = document.getElementById(
      "promptControlsContainer",
    );
    if (controlsContainer) {
      controlsContainer.style.display =
        prompt.id === "ac-clean-booking" || prompt.id === "camera-order" || prompt.id === "portable-aircon-order"
          ? "block"
          : "none";
    }

    // Show/hide WhatsApp button
    const waBtn = document.getElementById("sendWhatsAppBtn");
    if (waBtn) {
      waBtn.style.display =
        prompt.id === "ac-clean-booking" && this.selectedPropertyId
          ? "block"
          : "none";
    }

    // Read current exchange rate from input
    const rateInput = document.getElementById("exchangeRateInput");
    if (rateInput) {
      const val = parseFloat(rateInput.value);
      if (!isNaN(val) && val > 0) this.exchangeRate = val;
    }

    // For AC booking, re-populate dropdown and handle scheduled properties
    if (promptId === "ac-clean-booking") {
      this.acScheduledData = {}; // reset so data is re-fetched fresh
      const scheduled = this.properties.filter((p) =>
        this.isAcScheduledThisMonth(p),
      );
      const firstScheduled = scheduled[0] || null;
      if (firstScheduled) {
        this.selectedPropertyId = firstScheduled.propertyId;
      }
      this.populatePropertyDropdown();
      if (firstScheduled) {
        const select = document.getElementById("commonPromptPropertySelect");
        if (select) select.value = firstScheduled.propertyId;
      }
      // Update bulk button label to show scheduled count
      const bulkBtn = document.getElementById("allPropertiesModeBtn");
      if (bulkBtn) {
        bulkBtn.innerHTML =
          scheduled.length > 0
            ? `<i class="bi bi-snow me-1"></i>AC tháng này (${scheduled.length})`
            : `<i class="bi bi-buildings me-1"></i>Tất cả căn hộ (Bulk)`;
      }
      // Auto-switch to AC scheduled bulk view if there are scheduled properties
      if (scheduled.length > 0) {
        this.setAllMode();
        previewSection?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    } else if (promptId === "portable-aircon-order") {
      const bulkBtn = document.getElementById("allPropertiesModeBtn");
      if (bulkBtn) {
        bulkBtn.innerHTML = `<i class="bi bi-cart me-1"></i>Order Builder`;
      }
      this.setAllMode();
      previewSection?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    } else {
      // Restore default bulk button label when switching away from AC booking or aircon order
      const bulkBtn = document.getElementById("allPropertiesModeBtn");
      if (bulkBtn) {
        bulkBtn.innerHTML = `<i class="bi bi-buildings me-1"></i>Tất cả căn hộ (Bulk)`;
      }
    }

    // Reset to single mode on new prompt selection
    this.setSingleMode();

    // Update preview
    this.updateActivePromptPreview();

    // Bind new elements (exchange rate input may not have been bound yet)
    this.bindEvents();

    // Scroll to preview section
    previewSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async updateActivePromptPreview() {
    const prompt = this.prompts.find((p) => p.id === this.activePromptId);
    if (!prompt) return;

    const previewTextarea = document.getElementById("promptPreviewText");
    if (!previewTextarea) return;

    // Get selected property if needed
    let property = null;
    if (prompt.requiresProperty && this.selectedPropertyId) {
      property = this.properties.find(
        (p) => p.propertyId === this.selectedPropertyId,
      );
    }

    // If AC Clean Booking is selected, load extra data
    if (prompt.id === "ac-clean-booking") {
      const waBtn = document.getElementById("sendWhatsAppBtn");
      if (waBtn) waBtn.style.display = property ? "block" : "none";

      if (property && this.lastFetchedPropertyId !== property.propertyId) {
        this.lastFetchedPropertyId = property.propertyId;
        await Promise.all([
          this.fetchPropertyTenants(property.propertyId),
          this.fetchPropertyInvestors(property.propertyId),
          property.acServiceCompanyId
            ? this.fetchAcServiceCompany(property.acServiceCompanyId)
            : Promise.resolve((this.acServiceCompany = null)),
        ]);
        this.renderPromptControls();
      } else if (!property) {
        this.lastFetchedPropertyId = null;
        this.propertyTenants = [];
        this.propertyInvestors = [];
        this.renderPromptControls();
      }
    }

    if (prompt.id === "camera-order" || prompt.id === "portable-aircon-order") {
      this.renderPromptControls();
    }

    // Generate prompt text
    const promptText = prompt.template(property);
    previewTextarea.value = promptText;

    // Update prompt title
    const promptTitle = document.getElementById("activePromptTitle");
    if (promptTitle) {
      promptTitle.textContent = prompt.name;
    }

    // If in bulk mode, also re-render bulk messages
    if (this.mode === "all") {
      this.renderBulkMessages();
    }
  }

  async copyPromptToClipboard() {
    const previewTextarea = document.getElementById("promptPreviewText");
    if (!previewTextarea) return;

    const text = previewTextarea.value;

    try {
      await navigator.clipboard.writeText(text);

      // Show success feedback
      const copyBtn = document.getElementById("copyPromptBtn");
      const originalHtml = copyBtn.innerHTML;
      copyBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Đã copy!';
      copyBtn.classList.remove("btn-primary");
      copyBtn.classList.add("btn-success");

      setTimeout(() => {
        copyBtn.innerHTML = originalHtml;
        copyBtn.classList.remove("btn-success");
        copyBtn.classList.add("btn-primary");
      }, 2000);

      console.log("📋 Prompt copied to clipboard");
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);

      // Fallback: select the text
      previewTextarea.select();
      previewTextarea.setSelectionRange(0, 99999);
      document.execCommand("copy");

      alert("Đã copy tin nhắn!");
    }
  }

  async fetchPropertyTenants(propertyId) {
    try {
      const response = await API.get(
        API_CONFIG.ENDPOINTS.PROPERTY_TENANTS(propertyId),
      );
      const result = await response.json();
      if (result.success && result.data) {
        this.propertyTenants = result.data;
      } else if (result.tenants && Array.isArray(result.tenants)) {
        this.propertyTenants = result.tenants;
      } else if (Array.isArray(result)) {
        this.propertyTenants = result;
      } else {
        this.propertyTenants = [];
      }

      // Default selected contact is the main tenant (isMainTenant is a top-level field from API)
      const mainTenant =
        this.propertyTenants.find((t) => t.isMainTenant) ||
        this.propertyTenants[0];
      this.selectedContactTenantId = mainTenant?._id || null;
    } catch (e) {
      console.error("Error fetching property tenants:", e);
      this.propertyTenants = [];
    }
  }

  async fetchAcServiceCompany(companyId) {
    try {
      const response = await API.get(
        API_CONFIG.ENDPOINTS.AC_SERVICE_COMPANY_BY_ID(companyId),
      );
      const result = await response.json();
      if (result.success) {
        this.acServiceCompany = result.company;
      }
    } catch (e) {
      console.error("Error fetching AC service company:", e);
      this.acServiceCompany = null;
    }
  }

  async fetchPropertyInvestors(propertyId) {
    try {
      const response = await API.get(
        API_CONFIG.ENDPOINTS.INVESTORS_BY_PROPERTY(propertyId),
      );
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        this.propertyInvestors = result.data;
      } else if (result.success && Array.isArray(result.investors)) {
        this.propertyInvestors = result.investors;
      } else if (Array.isArray(result)) {
        this.propertyInvestors = result;
      } else {
        this.propertyInvestors = [];
      }
    } catch (e) {
      this.propertyInvestors = [];
    }
  }

  resolveContact(contactId, tenants, investors) {
    if (!contactId) return tenants.find((t) => t.isMainTenant) || tenants[0] || null;
    if (contactId.startsWith("investor:")) {
      const investorId = contactId.slice("investor:".length);
      const inv = (investors || []).find((i) => i._id === investorId);
      if (inv) return { name: inv.name, phoneNumber: inv.phone };
    }
    return tenants.find((t) => t._id === contactId) || null;
  }

  getAcCleanBookingTemplateFor(property, tenants, contactTenantId, date, time, investors) {
    date = this.formatDate(date) || "[date]";
    time = time || "[time]";

    const mainTenant = tenants.find((t) => t.isMainTenant) || tenants[0];
    const mainTenantName = mainTenant ? mainTenant.name : "[tên]";
    const mainTenantPhone = mainTenant ? mainTenant.phoneNumber : "[sđt]";

    const acUnits = property.airconUnits || 0;
    const bill = acUnits * 20;

    const contact = this.resolveContact(contactTenantId, tenants, investors || []);
    const contactPhone = contact?.phoneNumber || "[sđt liên hệ]";

    return `hello

its our cleaning AC cycle again
I would like to book AC clean service for this property

DATE: ${date} ${time}

#${property.unit || ""} ${property.address || ""}
name: ${mainTenantName}
phone: ${mainTenantPhone}
AC units: ${acUnits}
bill: ${bill}$

when u arrive the property, pls call this whatssap number to help open door
${contactPhone}`;
  }

  async renderAcScheduledBulk() {
    const container = document.getElementById("bulkMessagesContainer");
    const countBadge = document.getElementById("bulkPropertyCount");
    if (!container) return;

    const scheduled = this.properties.filter((p) =>
      this.isAcScheduledThisMonth(p),
    );

    if (countBadge) countBadge.textContent = `${scheduled.length} căn hộ`;

    if (scheduled.length === 0) {
      container.innerHTML =
        '<div class="text-center text-muted py-3"><i class="bi bi-check-circle me-2"></i>Không có căn hộ nào cần vệ sinh AC tháng này.</div>';
      return;
    }

    container.innerHTML = `<div class="text-center text-muted py-5"><i class="bi bi-hourglass-split me-2 fs-4"></i><br>Đang tải dữ liệu...</div>`;

    // Fetch tenant + company data in parallel for all scheduled properties
    await Promise.all(
      scheduled.map(async (property) => {
        try {
          let tenants = [];
          try {
            const res = await API.get(
              API_CONFIG.ENDPOINTS.PROPERTY_TENANTS(property.propertyId),
            );
            const result = await res.json();
            if (result.success && result.data) tenants = result.data;
            else if (result.tenants && Array.isArray(result.tenants))
              tenants = result.tenants;
            else if (Array.isArray(result)) tenants = result;
          } catch (e) {
            /* no tenants */
          }

          let company = null;
          if (property.acServiceCompanyId) {
            try {
              const res = await API.get(
                API_CONFIG.ENDPOINTS.AC_SERVICE_COMPANY_BY_ID(
                  property.acServiceCompanyId,
                ),
              );
              const result = await res.json();
              if (result.success) company = result.company;
            } catch (e) {
              /* no company */
            }
          }

          let investors = [];
          try {
            const res = await API.get(
              API_CONFIG.ENDPOINTS.INVESTORS_BY_PROPERTY(property.propertyId),
            );
            const result = await res.json();
            if (result.success && Array.isArray(result.data)) investors = result.data;
            else if (result.success && Array.isArray(result.investors)) investors = result.investors;
            else if (Array.isArray(result)) investors = result;
          } catch (e) {
            /* no investors */
          }

          const mainTenant = tenants.find((t) => t.isMainTenant) || tenants[0];
          this.acScheduledData[property.propertyId] = {
            tenants,
            investors,
            company,
            contactTenantId: mainTenant?._id || null,
            date: this.acBookingDate,
            time: this.acBookingTime,
          };
        } catch (e) {
          this.acScheduledData[property.propertyId] = {
            tenants: [],
            investors: [],
            company: null,
            contactTenantId: null,
            date: this.acBookingDate,
            time: this.acBookingTime,
          };
        }
      }),
    );

    // Group by contractor
    const groupKeyMap = {};
    this.acContractorGroupList = [];
    scheduled.forEach((p) => {
      const data = this.acScheduledData[p.propertyId];
      const company = data?.company;
      const key = company ? (company._id || company.name || "unknown") : "__none__";
      if (groupKeyMap[key] === undefined) {
        groupKeyMap[key] = this.acContractorGroupList.length;
        this.acContractorGroupList.push({ company: company || null, propertyIds: [] });
      }
      const groupIdx = groupKeyMap[key];
      this.acContractorGroupList[groupIdx].propertyIds.push(p.propertyId);
      data.groupIndex = groupIdx;
    });

    this.renderAcScheduledGroups(scheduled);
  }

  renderAcScheduledGroups(scheduled) {
    const container = document.getElementById("bulkMessagesContainer");
    if (!container) return;

    const sortedGroupIndices = this.acContractorGroupList
      .map((_, i) => i)
      .sort((a, b) => {
        const ga = this.acContractorGroupList[a];
        const gb = this.acContractorGroupList[b];
        if (!ga.company && gb.company) return 1;
        if (ga.company && !gb.company) return -1;
        return (ga.company?.name || "").localeCompare(gb.company?.name || "");
      });

    let html = "";
    sortedGroupIndices.forEach((groupIdx) => {
      const { company, propertyIds } = this.acContractorGroupList[groupIdx];
      const groupProperties = propertyIds
        .map((id) => this.properties.find((p) => p.propertyId === id))
        .filter(Boolean);
      const isMultiple = groupProperties.length > 1;

      let waPhone = "";
      if (company?.phone) {
        const digits = company.phone.replace(/[^0-9]/g, "");
        waPhone = digits.length === 8 && /^[893]/.test(digits) ? "65" + digits : digits;
      }

      if (company) {
        html += `<div class="mb-4">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 px-3 py-2" style="background:linear-gradient(135deg,#d4edda,#c3e6cb);border:2px solid #a3d7b4;border-radius:8px 8px 0 0;">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <i class="bi bi-tools text-success fs-5"></i>
              <strong>${this.escapeHtml(company.name)}</strong>
              ${company.phone ? `<span class="text-muted small">${this.escapeHtml(company.phone)}</span>` : ""}
              <span class="badge bg-success">${groupProperties.length} căn hộ</span>
            </div>
            ${isMultiple ? `<div class="d-flex gap-2">
              ${waPhone ? `<button class="btn btn-sm btn-success" onclick="commonPromptComponent.sendContractorGroupWhatsApp(${groupIdx}, '${waPhone}')"><i class="bi bi-whatsapp me-1"></i>WhatsApp tất cả</button>` : ""}
              <button class="btn btn-sm btn-outline-success" id="copyContractorBtn-${groupIdx}" onclick="commonPromptComponent.copyContractorMessage(${groupIdx})"><i class="bi bi-clipboard me-1"></i>Copy tất cả</button>
            </div>` : ""}
          </div>
          <div class="row g-3 p-3" style="background:#f8f9fa;border:2px solid #a3d7b4;border-top:0;">`;
      } else {
        html += `<div class="mb-4">
          <div class="d-flex align-items-center gap-2 px-3 py-2" style="background:#fff3cd;border:2px solid #ffc107;border-radius:8px 8px 0 0;">
            <i class="bi bi-exclamation-triangle-fill text-warning"></i>
            <strong>Chưa gán AC contractor</strong>
            <span class="badge bg-warning text-dark">${groupProperties.length} căn hộ</span>
          </div>
          <div class="row g-3 p-3" style="background:#f8f9fa;border:2px solid #ffc107;border-top:0;">`;
      }

      groupProperties.forEach((p) => {
        const globalIdx = scheduled.findIndex((sp) => sp.propertyId === p.propertyId);
        const imgHtml = p.propertyImage
          ? `<img src="${this.escapeHtml(p.propertyImage)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0;">`
          : `<div style="width:40px;height:40px;border-radius:6px;background:#e9ecef;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="bi bi-building text-muted"></i></div>`;
        html += `<div class="col-12 col-sm-6 col-xl-3 col-lg-4">
            <div class="border rounded overflow-hidden h-100 bg-white" id="acCard-${globalIdx}">
              <div class="d-flex align-items-center px-3 py-2 bg-light gap-2">
                ${imgHtml}
                <strong style="font-size:13px;">${this.escapeHtml(p.propertyId)} - ${this.escapeHtml(p.address || "")}</strong>
              </div>
              <div class="p-3 text-center text-muted"><i class="bi bi-hourglass-split me-2"></i>Đang tải...</div>
            </div>
          </div>`;
      });

      html += `</div>`; // close row g-3

      if (isMultiple && company) {
        const combinedMsg = this.buildCombinedAcContractorMessage(groupIdx);
        html += `<div style="border:2px solid #a3d7b4;border-top:0;border-radius:0 0 8px 8px;overflow:hidden;">
            <div class="d-flex justify-content-between align-items-center px-3 py-2 gap-2" style="background:linear-gradient(135deg,#b8dfc5,#9ecfb0);">
              <div class="d-flex align-items-center gap-2">
                <i class="bi bi-chat-text-fill text-success"></i>
                <strong class="small">Tin nhắn gộp → ${this.escapeHtml(company.name)}</strong>
                <span class="badge bg-success">${groupProperties.length} căn hộ</span>
              </div>
              <div class="d-flex gap-2">
                ${waPhone ? `<button class="btn btn-sm btn-success" onclick="commonPromptComponent.sendContractorGroupWhatsApp(${groupIdx}, '${waPhone}')"><i class="bi bi-whatsapp me-1"></i>WhatsApp</button>` : ""}
                <button class="btn btn-sm btn-outline-success" id="copyContractorMsgBtn-${groupIdx}" onclick="commonPromptComponent.copyContractorMessage(${groupIdx})"><i class="bi bi-clipboard me-1"></i>Copy</button>
              </div>
            </div>
            <textarea id="contractorCombinedMsg-${groupIdx}" class="form-control border-0 rounded-0" rows="12" readonly
              style="font-family:'Noto Serif',serif;font-size:13px;line-height:1.6;background:#f0fff4;resize:none;"
            >${this.escapeHtml(combinedMsg)}</textarea>
          </div>`;
      }

      html += `</div>`; // close mb-4
    });

    container.innerHTML = html;

    scheduled.forEach((property, i) => {
      this.renderAcScheduledCard(property, i);
    });
  }

  buildCombinedAcContractorMessage(groupIdx) {
    const group = this.acContractorGroupList[groupIdx];
    if (!group) return "";

    const blocks = group.propertyIds
      .map((propertyId) => {
        const property = this.properties.find((p) => p.propertyId === propertyId);
        const data = this.acScheduledData[propertyId];
        if (!property || !data) return null;

        const { tenants, investors = [], contactTenantId, date, time } = data;
        const mainTenant = tenants.find((t) => t.isMainTenant) || tenants[0];
        const contact = this.resolveContact(contactTenantId, tenants, investors);

        const acUnits = property.airconUnits || 0;
        const bill = acUnits * 20;
        const formattedDate = this.formatDate(date) || "[date]";

        return `📍 #${property.unit || ""} ${property.address || ""}
DATE: ${formattedDate} ${time || "[time]"}
name: ${mainTenant?.name || "[tên]"}
phone: ${mainTenant?.phoneNumber || "[sđt]"}
AC units: ${acUnits}
bill: ${bill}$
contact to open door: ${contact?.phoneNumber || "[sđt liên hệ]"}`;
      })
      .filter(Boolean);

    return `hello

its our cleaning AC cycle again
I would like to book AC clean service for the following properties:

${blocks.join("\n\n")}

Thank you! 🙏`;
  }

  refreshContractorGroupMessage(propertyId) {
    const data = this.acScheduledData[propertyId];
    if (data?.groupIndex === undefined) return;
    const groupIdx = data.groupIndex;
    const group = this.acContractorGroupList[groupIdx];
    if (!group || group.propertyIds.length <= 1) return;
    const textarea = document.getElementById(`contractorCombinedMsg-${groupIdx}`);
    if (textarea) {
      textarea.value = this.buildCombinedAcContractorMessage(groupIdx);
    }
  }

  renderAcScheduledCard(property, index) {
    const card = document.getElementById(`acCard-${index}`);
    if (!card) return;

    const data = this.acScheduledData[property.propertyId] || {
      tenants: [],
      company: null,
      contactTenantId: null,
      date: this.acBookingDate,
      time: this.acBookingTime,
    };
    const { tenants, investors = [], company, contactTenantId, date, time } = data;
    const message = this.getAcCleanBookingTemplateFor(
      property,
      tenants,
      contactTenantId,
      date,
      time,
      investors,
    );

    let contactOptions = "";
    if (tenants.length > 0) {
      contactOptions += `<optgroup label="Tenants">`;
      contactOptions += tenants.map((t) =>
        `<option value="${t._id}" ${t._id === contactTenantId ? "selected" : ""}>${this.escapeHtml(t.name)} (${t.phoneNumber || "no phone"})</option>`
      ).join("");
      contactOptions += `</optgroup>`;
    }
    if (investors.length > 0) {
      contactOptions += `<optgroup label="Investors">`;
      contactOptions += investors.map((inv) => {
        const val = `investor:${inv._id}`;
        return `<option value="${val}" ${val === contactTenantId ? "selected" : ""}>${this.escapeHtml(inv.name)} (${inv.phone || "no phone"})</option>`;
      }).join("");
      contactOptions += `</optgroup>`;
    }

    const companyHtml = company
      ? `<div class="p-2 rounded bg-light border-start border-4 border-success mb-2 d-flex align-items-center gap-2">
          <i class="bi bi-tools text-success"></i>
          <span class="fw-bold small">${this.escapeHtml(company.name)}</span>
          <span class="text-muted small">${company.phone || ""}</span>
        </div>`
      : `<div class="p-2 rounded bg-light border-start border-4 border-warning mb-2">
          <i class="bi bi-exclamation-triangle-fill text-warning me-1"></i>
          <span class="small">Chưa gán AC contractor</span>
        </div>`;

    let waPhone = "";
    if (company?.phone) {
      const digits = company.phone.replace(/[^0-9]/g, "");
      waPhone =
        digits.length === 8 && /^[893]/.test(digits) ? "65" + digits : digits;
    }

    const imgHtml = property.propertyImage
      ? `<img src="${this.escapeHtml(property.propertyImage)}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0;">`
      : `<div style="width:48px;height:48px;border-radius:8px;background:#e9ecef;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="bi bi-building text-muted" style="font-size:1.2rem;"></i></div>`;

    const tenantFbHtml = property.tenantFacebookGroup
      ? `<a href="${this.escapeHtml(property.tenantFacebookGroup)}" target="_blank" rel="noopener noreferrer"
           style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:#1877F2;color:#fff;text-decoration:none;font-size:12px;font-weight:600;">
           <i class="bi bi-people-fill"></i> Tenant Group</a>`
      : "";
    const adminFbHtml = property.adminFacebookGroup
      ? `<a href="${this.escapeHtml(property.adminFacebookGroup)}" target="_blank" rel="noopener noreferrer"
           style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:#212529;color:#fff;text-decoration:none;font-size:12px;font-weight:600;">
           <i class="bi bi-shield-fill"></i> Admin Group</a>`
      : "";
    const fbHtml =
      tenantFbHtml || adminFbHtml
        ? `<div class="d-flex gap-2 px-3 py-2 align-items-center" style="background:#f0f4ff;border-top:1px solid #dee2e6;">
          <span style="font-size:11px;color:#6c757d;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Facebook:</span>
          ${tenantFbHtml}${adminFbHtml}
        </div>`
        : "";

    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-center px-2 py-2 bg-light gap-2">
        <div class="d-flex align-items-center gap-2 min-w-0">
          ${imgHtml}
          <strong style="font-size:12px;word-break:break-word;">${this.escapeHtml(property.propertyId)} - ${this.escapeHtml(property.address || "")}</strong>
        </div>
        <div class="d-flex gap-1 flex-shrink-0">
          ${waPhone ? `<button class="btn btn-sm btn-outline-success px-2" onclick="commonPromptComponent.sendAcWhatsApp(${index}, '${waPhone}')"><i class="bi bi-whatsapp"></i></button>` : ""}
          <button class="btn btn-sm btn-outline-primary px-2" onclick="commonPromptComponent.copyAcCard(${index})"><i class="bi bi-clipboard"></i></button>
        </div>
      </div>
      ${fbHtml}
      <div class="p-2">
        <div class="row g-2 mb-2">
          <div class="col-6">
            <label class="form-label small fw-bold mb-1" style="font-size:11px;">Date</label>
            <input type="date" class="form-control form-control-sm" id="acCardDate-${index}" value="${date}"
              onchange="commonPromptComponent.updateAcCardDateTime('${property.propertyId}', ${index}, 'date', this.value)">
          </div>
          <div class="col-6">
            <label class="form-label small fw-bold mb-1" style="font-size:11px;">Time</label>
            <input type="time" class="form-control form-control-sm" id="acCardTime-${index}" value="${time}"
              onchange="commonPromptComponent.updateAcCardDateTime('${property.propertyId}', ${index}, 'time', this.value)">
          </div>
        </div>
        ${companyHtml}
        ${
          contactOptions
            ? `
          <div class="mb-2">
            <label class="form-label small fw-bold mb-1" style="font-size:11px;">Người liên hệ mở cửa</label>
            <select class="form-select form-select-sm" id="acCardContact-${index}"
              onchange="commonPromptComponent.updateAcCardContact('${property.propertyId}', ${index}, this.value)">
              ${contactOptions}
            </select>
          </div>`
            : ""
        }
      </div>
      <textarea class="form-control border-0 rounded-0" rows="14" readonly
        id="acCardMsg-${index}"
        style="font-family:'Noto Serif',serif;font-size:12px;line-height:1.5;background:#fafafa;resize:none;"
      >${this.escapeHtml(message)}</textarea>
    `;
  }

  updateAcCardDateTime(propertyId, index, field, value) {
    const data = this.acScheduledData[propertyId];
    if (!data) return;
    data[field] = value;
    const property = this.properties.find((p) => p.propertyId === propertyId);
    if (!property) return;
    const textarea = document.getElementById(`acCardMsg-${index}`);
    if (textarea) {
      textarea.value = this.getAcCleanBookingTemplateFor(
        property,
        data.tenants,
        data.contactTenantId,
        data.date,
        data.time,
        data.investors,
      );
    }
    this.refreshContractorGroupMessage(propertyId);
  }

  updateAcCardContact(propertyId, index, contactTenantId) {
    const data = this.acScheduledData[propertyId];
    if (!data) return;
    data.contactTenantId = contactTenantId;
    const property = this.properties.find((p) => p.propertyId === propertyId);
    if (!property) return;
    const textarea = document.getElementById(`acCardMsg-${index}`);
    if (textarea) {
      textarea.value = this.getAcCleanBookingTemplateFor(
        property,
        data.tenants,
        contactTenantId,
        data.date,
        data.time,
        data.investors,
      );
    }
    this.refreshContractorGroupMessage(propertyId);
  }

  async copyAcCard(index) {
    const textarea = document.getElementById(`acCardMsg-${index}`);
    if (!textarea) return;
    const btn = document.querySelector(
      `#acCard-${index} .btn-outline-primary, #acCard-${index} .btn-primary`,
    );
    try {
      await navigator.clipboard.writeText(textarea.value);
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-check-lg"></i>';
        btn.classList.replace("btn-outline-primary", "btn-primary");
        setTimeout(() => {
          btn.innerHTML = orig;
          btn.classList.replace("btn-primary", "btn-outline-primary");
        }, 2000);
      }
    } catch {
      textarea.select();
      document.execCommand("copy");
    }
  }

  sendAcWhatsApp(index, phone) {
    const textarea = document.getElementById(`acCardMsg-${index}`);
    if (!textarea || !phone) return;
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(textarea.value)}`,
      "_blank",
    );
  }

  async copyContractorMessage(groupIdx) {
    const textarea = document.getElementById(`contractorCombinedMsg-${groupIdx}`);
    if (!textarea) return;
    const btn = document.getElementById(`copyContractorMsgBtn-${groupIdx}`) ||
      document.getElementById(`copyContractorBtn-${groupIdx}`);
    try {
      await navigator.clipboard.writeText(textarea.value);
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Copied!';
        btn.classList.replace("btn-outline-success", "btn-success");
        setTimeout(() => {
          btn.innerHTML = orig;
          btn.classList.replace("btn-success", "btn-outline-success");
        }, 2000);
      }
    } catch {
      textarea.select();
      document.execCommand("copy");
    }
  }

  sendContractorGroupWhatsApp(groupIdx, phone) {
    const textarea = document.getElementById(`contractorCombinedMsg-${groupIdx}`);
    if (!textarea || !phone) return;
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(textarea.value)}`,
      "_blank",
    );
  }

  renderPortableAirconBulk() {
    const container = document.getElementById("bulkMessagesContainer");
    const countBadge = document.getElementById("bulkPropertyCount");
    if (!container) return;

    if (countBadge) countBadge.textContent = `${this.properties.length} căn hộ`;

    const sortedProperties = [...this.properties].sort(
      (a, b) => (parseInt(b.propertyId) || 0) - (parseInt(a.propertyId) || 0),
    );

    const headerHtml = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="text-muted small"><i class="bi bi-info-circle me-1"></i>Properties with all-zero quantities are excluded from the order message.</div>
        <button class="btn btn-sm btn-outline-danger" onclick="commonPromptComponent.clearAllAirconOrders()">
          <i class="bi bi-x-circle me-1"></i>Clear All
        </button>
      </div>
    `;

    let cardsHtml = '<div class="row g-3 mb-4">';
    sortedProperties.forEach((property) => {
      const order = this.getAirconOrder(property.propertyId);
      const imgHtml = property.propertyImage
        ? `<img src="${this.escapeHtml(property.propertyImage)}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0;">`
        : `<div style="width:48px;height:48px;border-radius:8px;background:#e9ecef;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="bi bi-building text-muted" style="font-size:1.2rem;"></i></div>`;
      const hasPinAccess = property.digitalLockEnabled && property.digitalLockPin;
      const pinHtml = hasPinAccess
        ? `<div id="airconPin-${this.escapeHtml(property.propertyId)}"
              style="display:${order.bringInside ? "flex" : "none"};align-items:center;gap:6px;margin-top:6px;padding:6px 10px;border-radius:6px;background:linear-gradient(135deg,#6f42c1,#9d4edd);color:#fff;font-size:12px;">
            <i class="bi bi-shield-lock-fill"></i>
            <span>Door access PIN: <strong>${this.escapeHtml(property.digitalLockPin)}</strong></span>
          </div>`
        : "";
      cardsHtml += `
        <div class="col-12 col-sm-6 col-xl-3 col-lg-4">
          <div class="border rounded overflow-hidden h-100">
            <div class="d-flex align-items-center px-3 py-2 bg-light gap-2">
              ${imgHtml}
              <strong style="font-size:13px;">${this.escapeHtml(property.propertyId)} - ${this.escapeHtml(property.address || "")}</strong>
            </div>
            <div class="p-3">
              <div class="row g-2">
                <div class="col-6">
                  <label class="form-label small fw-bold mb-1" style="font-size:11px;">Portable Aircon</label>
                  <input type="number" class="form-control form-control-sm" value="${order.airconQty}" min="0"
                    oninput="commonPromptComponent.updateAirconOrder('${property.propertyId}', 'airconQty', this.value)">
                </div>
                <div class="col-6">
                  <label class="form-label small fw-bold mb-1" style="font-size:11px;">Hose 2m</label>
                  <input type="number" class="form-control form-control-sm" value="${order.hose2m}" min="0"
                    oninput="commonPromptComponent.updateAirconOrder('${property.propertyId}', 'hose2m', this.value)">
                </div>
                <div class="col-6">
                  <label class="form-label small fw-bold mb-1" style="font-size:11px;">Hose 3m</label>
                  <input type="number" class="form-control form-control-sm" value="${order.hose3m}" min="0"
                    oninput="commonPromptComponent.updateAirconOrder('${property.propertyId}', 'hose3m', this.value)">
                </div>
                <div class="col-6">
                  <label class="form-label small fw-bold mb-1" style="font-size:11px;">Remote</label>
                  <input type="number" class="form-control form-control-sm" value="${order.remotes}" min="0"
                    oninput="commonPromptComponent.updateAirconOrder('${property.propertyId}', 'remotes', this.value)">
                </div>
                <div class="col-12 mt-1">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox"
                      id="bringInside-${this.escapeHtml(property.propertyId)}"
                      ${order.bringInside ? "checked" : ""}
                      onchange="commonPromptComponent.updateAirconOrder('${property.propertyId}', 'bringInside', this.checked)">
                    <label class="form-check-label small fw-bold" for="bringInside-${this.escapeHtml(property.propertyId)}" style="font-size:11px;">
                      🏠 Bring inside house
                    </label>
                  </div>
                  ${pinHtml}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    cardsHtml += "</div>";

    const combinedMessage = this.buildCombinedAirconOrderMessage();
    const combinedHtml = `
      <div class="border rounded overflow-hidden">
        <div class="d-flex justify-content-between align-items-center px-3 py-2 gap-3" style="background:linear-gradient(135deg,#667eea22,#764ba222);">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-chat-text-fill text-primary"></i>
            <strong>Combined Order Message</strong>
            <span class="badge bg-success"><i class="bi bi-whatsapp me-1"></i>Lyn +6580159026</span>
          </div>
          <button class="btn btn-sm btn-outline-success" id="copyAirconCombinedBtn" onclick="commonPromptComponent.copyCombinedAirconMessage()">
            <i class="bi bi-clipboard me-1"></i>Copy
          </button>
        </div>
        <textarea id="portableAirconCombinedMsg" class="form-control border-0 rounded-0"
          rows="20" readonly
          style="font-family:'Noto Serif',serif;font-size:13px;line-height:1.6;background:#fafafa;resize:none;"
        >${this.escapeHtml(combinedMessage)}</textarea>
      </div>
    `;

    container.innerHTML = headerHtml + cardsHtml + combinedHtml;
  }

  updateAirconOrder(propertyId, field, value) {
    const order = this.getAirconOrder(propertyId);
    if (field === "bringInside") {
      order.bringInside = value === true || value === "true";
      const pinEl = document.getElementById(`airconPin-${propertyId}`);
      if (pinEl) pinEl.style.display = order.bringInside ? "flex" : "none";
    } else {
      order[field] = Math.max(0, parseInt(value) || 0);
    }
    const combinedTextarea = document.getElementById("portableAirconCombinedMsg");
    if (combinedTextarea) {
      combinedTextarea.value = this.buildCombinedAirconOrderMessage();
    }
    if (this.mode === "single" && this.selectedPropertyId === propertyId) {
      this.updateActivePromptPreview();
    }
  }

  clearAllAirconOrders() {
    this.airconOrders = {};
    this.renderPortableAirconBulk();
  }

  async copyCombinedAirconMessage() {
    const textarea = document.getElementById("portableAirconCombinedMsg");
    if (!textarea) return;
    const btn = document.getElementById("copyAirconCombinedBtn");
    try {
      await navigator.clipboard.writeText(textarea.value);
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Copied!';
        btn.classList.replace("btn-outline-success", "btn-success");
        setTimeout(() => {
          btn.innerHTML = orig;
          btn.classList.replace("btn-success", "btn-outline-success");
        }, 2000);
      }
    } catch {
      textarea.select();
      document.execCommand("copy");
    }
  }

  renderPromptControls() {
    const container = document.getElementById("promptControlsBody");
    if (!container) return;

    if (this.activePromptId === "ac-clean-booking" && this.selectedPropertyId) {
      let contactOptions = "";
      if (this.propertyTenants.length > 0) {
        contactOptions += `<optgroup label="Tenants">`;
        contactOptions += this.propertyTenants.map((t) =>
          `<option value="${t._id}" ${t._id === this.selectedContactTenantId ? "selected" : ""}>${this.escapeHtml(t.name)} (${t.phoneNumber || "no phone"})</option>`
        ).join("");
        contactOptions += `</optgroup>`;
      }
      if (this.propertyInvestors.length > 0) {
        contactOptions += `<optgroup label="Investors">`;
        contactOptions += this.propertyInvestors.map((inv) => {
          const val = `investor:${inv._id}`;
          return `<option value="${val}" ${val === this.selectedContactTenantId ? "selected" : ""}>${this.escapeHtml(inv.name)} (${inv.phone || "no phone"})</option>`;
        }).join("");
        contactOptions += `</optgroup>`;
      }

      container.innerHTML = `
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label fw-bold small">Ngày hẹn (Date)</label>
            <input type="date" id="acBookingDateInput" class="form-control" value="${this.acBookingDate}">
          </div>
          <div class="col-md-6">
            <label class="form-label fw-bold small">Giờ hẹn (Time)</label>
            <input type="time" id="acBookingTimeInput" class="form-control" value="${this.acBookingTime}">
          </div>
          <div class="col-12">
            <label class="form-label fw-bold small">Người liên hệ mở cửa (Contact Person)</label>
            <select id="acContactTenantSelect" class="form-select">
              <option value="">-- Chọn --</option>
              ${contactOptions}
            </select>
            <small class="text-muted mt-1 d-block">
              <i class="bi bi-whatsapp me-1"></i>Số WhatsApp của người này sẽ được điền vào tin nhắn
            </small>
          </div>
          ${
            this.acServiceCompany
              ? `
            <div class="col-12">
              <div class="p-2 rounded bg-light border-start border-4 border-success">
                <div class="d-flex align-items-center gap-2 mb-1">
                  <i class="bi bi-tools text-success"></i>
                  <span class="fw-bold small">Contractor: ${this.escapeHtml(this.acServiceCompany.name)}</span>
                </div>
                <div class="small text-muted"><i class="bi bi-telephone-outbound me-1"></i>WhatsApp: ${this.acServiceCompany.phone || "N/A"}</div>
              </div>
            </div>
          `
              : `
            <div class="col-12">
              <div class="p-2 rounded bg-light border-start border-4 border-warning">
                <i class="bi bi-exclamation-triangle-fill text-warning me-1"></i>
                <span class="small">Căn hộ này chưa gán AC contractor.</span>
              </div>
            </div>
          `
          }
        </div>
      `;

      // Bind dynamic events
      document
        .getElementById("acBookingDateInput")
        .addEventListener("change", (e) => {
          this.acBookingDate = e.target.value;
          this.updateActivePromptPreview();
        });
      document
        .getElementById("acBookingTimeInput")
        .addEventListener("change", (e) => {
          this.acBookingTime = e.target.value;
          this.updateActivePromptPreview();
        });
      document
        .getElementById("acContactTenantSelect")
        .addEventListener("change", (e) => {
          this.selectedContactTenantId = e.target.value;
          this.updateActivePromptPreview();
        });
    } else if (
      this.activePromptId === "camera-order" &&
      this.selectedPropertyId
    ) {
      container.innerHTML = `
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label fw-bold small">Số lượng (Quantity)</label>
            <input type="number" id="cameraQuantityInput" class="form-control" value="${this.cameraQuantity}" min="1" max="20">
          </div>
        </div>
      `;
      document
        .getElementById("cameraQuantityInput")
        .addEventListener("input", (e) => {
          const val = parseInt(e.target.value);
          if (!isNaN(val) && val > 0) {
            this.cameraQuantity = val;
            this.updateActivePromptPreview();
            if (this.mode === "all") this.renderBulkMessages();
          }
        });
    } else if (
      this.activePromptId === "portable-aircon-order" &&
      this.selectedPropertyId
    ) {
      const controlsContainer = document.getElementById("promptControlsContainer");
      if (controlsContainer) controlsContainer.style.display = "block";
      const order = this.getAirconOrder(this.selectedPropertyId);
      const property = this.properties.find((p) => p.propertyId === this.selectedPropertyId);
      const hasPinAccess = property?.digitalLockEnabled && property?.digitalLockPin;
      container.innerHTML = `
        <div class="row g-3">
          <div class="col-md-3 col-6">
            <label class="form-label fw-bold small">Portable Aircon</label>
            <input type="number" id="airconQtyInput" class="form-control" value="${order.airconQty}" min="0">
          </div>
          <div class="col-md-3 col-6">
            <label class="form-label fw-bold small">Hose 2m</label>
            <input type="number" id="hose2mInput" class="form-control" value="${order.hose2m}" min="0">
          </div>
          <div class="col-md-3 col-6">
            <label class="form-label fw-bold small">Hose 3m</label>
            <input type="number" id="hose3mInput" class="form-control" value="${order.hose3m}" min="0">
          </div>
          <div class="col-md-3 col-6">
            <label class="form-label fw-bold small">Remote Controller</label>
            <input type="number" id="remotesInput" class="form-control" value="${order.remotes}" min="0">
          </div>
          <div class="col-12">
            <div class="form-check">
              <input class="form-check-input" type="checkbox" id="bringInsideSingleInput" ${order.bringInside ? "checked" : ""}>
              <label class="form-check-label fw-bold small" for="bringInsideSingleInput">🏠 Bring inside house</label>
            </div>
            ${hasPinAccess ? `
              <div id="airconPin-single" style="display:${order.bringInside ? "flex" : "none"};align-items:center;gap:6px;margin-top:6px;padding:6px 10px;border-radius:6px;background:linear-gradient(135deg,#6f42c1,#9d4edd);color:#fff;font-size:13px;width:fit-content;">
                <i class="bi bi-shield-lock-fill"></i>
                <span>Door access PIN: <strong>${this.escapeHtml(property.digitalLockPin)}</strong></span>
              </div>
            ` : ""}
          </div>
        </div>
      `;
      [
        ["airconQtyInput", "airconQty"],
        ["hose2mInput", "hose2m"],
        ["hose3mInput", "hose3m"],
        ["remotesInput", "remotes"],
      ].forEach(([id, field]) => {
        document.getElementById(id)?.addEventListener("input", (e) => {
          this.updateAirconOrder(this.selectedPropertyId, field, e.target.value);
          this.updateActivePromptPreview();
        });
      });
      document.getElementById("bringInsideSingleInput")?.addEventListener("change", (e) => {
        this.updateAirconOrder(this.selectedPropertyId, "bringInside", e.target.checked);
        const pinEl = document.getElementById("airconPin-single");
        if (pinEl) pinEl.style.display = e.target.checked ? "flex" : "none";
        this.updateActivePromptPreview();
      });
    } else {
      container.innerHTML =
        '<div class="text-center text-muted py-2">Vui lòng chọn căn hộ để hiển thị tùy chọn.</div>';
    }
  }

  sendWhatsApp() {
    const promptText = document.getElementById("promptPreviewText")?.value;
    if (!promptText) return;

    let phone = "";
    if (this.acServiceCompany && this.acServiceCompany.phone) {
      phone = this.acServiceCompany.phone.replace(/[^0-9]/g, "");
      // Auto prefix SG if 8 digits
      if (
        phone.length === 8 &&
        (phone.startsWith("8") ||
          phone.startsWith("9") ||
          phone.startsWith("3"))
      ) {
        phone = "65" + phone;
      }
    } else {
      alert("Căn hộ này chưa có thông tin số điện thoại contractor.");
      return;
    }

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(promptText)}`;
    window.open(waUrl, "_blank");
  }

  formatDate(dateStr) {
    if (!dateStr) return dateStr;
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Public method to refresh the component
  refresh() {
    console.log("🔄 [CommonPrompt] Refreshing component...");
    // Ensure events are bound (in case DOM wasn't ready during init)
    this.ensureEventsBound();
    // Re-render prompt library
    this.renderPromptLibrary();
    // Reload properties
    this.loadProperties();
  }
}

// Initialize component when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.commonPromptComponent = new CommonPromptComponent();
  });
} else {
  window.commonPromptComponent = new CommonPromptComponent();
}
