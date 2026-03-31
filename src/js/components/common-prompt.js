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
    window.addEventListener('exchangeRateUpdated', (e) => {
      if (e.detail?.rate) {
        this.exchangeRate = e.detail.rate;
        const input = document.getElementById('exchangeRateInput');
        if (input) input.value = e.detail.rate;
        this.updateActivePromptPreview();
        if (this.mode === 'all') this.renderBulkMessages();
      }
    });
  }

  async loadCurrentExchangeRate() {
    try {
      const res = await API.get(API_CONFIG.ENDPOINTS.EXCHANGE_RATE_CURRENT);
      const data = await res.json();
      if (data.success && data.rate) {
        this.exchangeRate = data.rate.rate;
        const input = document.getElementById('exchangeRateInput');
        if (input) input.value = data.rate.rate;
        this.updateActivePromptPreview();
        if (this.mode === 'all') this.renderBulkMessages();
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
    const sgdBank = property?.settlementSgd?.bankName || "UOB";
    const sgdAccountNo =
      property?.settlementSgd?.accountNumber || "438-371-817-6";
    const sgdAccountHolder =
      property?.settlementSgd?.accountHolderName || "Pham Vu Thao Ly";
    const sgdPayNow = property?.settlementSgd?.payNow || "89261752";

    const vndBank = property?.settlementVnd?.bankName || "BIDV";
    const vndAccountNo = property?.settlementVnd?.accountNumber || "8841748829";
    const vndAccountHolder =
      property?.settlementVnd?.accountHolderName || "Phạm Vũ Thảo Ly";

    return `Hi mọi người 🌸

Rent tháng ${currentMonth}, mọi người chuyển khoản giúp mình vào các tài khoản bên dưới nhé.

💱 Ai đóng bằng VND thì áp dụng theo tỷ giá: ${rate} nhé. Vài hôm nữa có bill pub thì em sẽ báo lại sau ạ

Sau khi chuyển khoản, mọi người vui lòng gửi hóa đơn qua tin nhắn riêng giúp mình để đảm bảo quyền riêng tư nhé.

Chúc mọi người tháng mới nhiều thắng lợi, sức khỏe và thật nhiều niềm vui ✨

🇸🇬 Tài khoản Singapore (${sgdBank})
• Bank: ${sgdBank}
• Account No: ${sgdAccountNo}
• PayNow: ${sgdPayNow}
• Name: ${sgdAccountHolder}

🇻🇳 Tài khoản Việt Nam (${vndBank})
• Bank: ${vndBank}
• Account No: ${vndAccountNo}
• Tên: ${vndAccountHolder}`;
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

    this.renderBulkMessages();
  }

  renderBulkMessages() {
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

    let html = "";
    this.properties.forEach((property, index) => {
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
        <div class="border rounded mb-3 overflow-hidden">
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
            class="form-control border-0 rounded-0"
            rows="14"
            readonly
            data-bulk-msg="${index}"
            style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.6; background-color: #fafafa; resize: none;"
          >${escapedMessage}</textarea>
        </div>
      `;
    });

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

  populatePropertyDropdown() {
    const select = document.getElementById("commonPromptPropertySelect");
    if (!select) return;

    // Clear existing options except the first one
    select.innerHTML = '<option value="">-- Chọn căn hộ --</option>';

    // Add properties as options
    this.properties.forEach((property) => {
      const option = document.createElement("option");
      option.value = property.propertyId;
      option.textContent = `${property.propertyId} - ${property.address}`;
      select.appendChild(option);
    });
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
      exchangeRateSection.style.display = prompt.requiresProperty
        ? "block"
        : "none";
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

    // Read current exchange rate from input
    const rateInput = document.getElementById("exchangeRateInput");
    if (rateInput) {
      const val = parseFloat(rateInput.value);
      if (!isNaN(val) && val > 0) this.exchangeRate = val;
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

  updateActivePromptPreview() {
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
