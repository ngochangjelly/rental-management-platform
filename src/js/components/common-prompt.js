/**
 * Common Prompt Component
 * A library of commonly used text message prompts for property management
 */
class CommonPromptComponent {
  constructor() {
    this.properties = [];
    this.selectedPropertyId = null;
    this.prompts = this.initializePrompts();
    this.eventsBound = false;
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadProperties();
    this.renderPromptLibrary();
  }

  ensureEventsBound() {
    if (this.eventsBound) return;
    this.bindEvents();
  }

  initializePrompts() {
    return [
      {
        id: 'rent-collection',
        name: 'Thu tiền thuê tháng',
        description: 'Tin nhắn nhắc tenant chuyển khoản tiền thuê hàng tháng',
        icon: 'bi-cash-coin',
        requiresProperty: true,
        template: this.getRentCollectionTemplate.bind(this)
      }
    ];
  }

  getCurrentMonth() {
    const now = new Date();
    return now.toLocaleDateString('vi-VN', { month: 'numeric' });
  }

  getRentCollectionTemplate(property) {
    const currentMonth = this.getCurrentMonth();

    // Get settlement account info from property
    const sgdBank = property?.settlementSgd?.bankName || 'UOB';
    const sgdAccountNo = property?.settlementSgd?.accountNumber || '438-371-817-6';
    const sgdAccountHolder = property?.settlementSgd?.accountHolderName || 'Pham Vu Thao Ly';

    const vndBank = property?.settlementVnd?.bankName || 'BIDV';
    const vndAccountNo = property?.settlementVnd?.accountNumber || '8841748829';
    const vndAccountHolder = property?.settlementVnd?.accountHolderName || 'Phạm Vũ Thảo Ly';

    return `Hi mọi người 🌸

Rent tháng ${currentMonth}, mọi người chuyển khoản giúp mình vào các tài khoản bên dưới nhé.

💱 Ai đóng bằng VND thì áp dụng theo tỷ giá: 21 nhé

Sau khi chuyển khoản, mọi người vui lòng gửi hóa đơn qua tin nhắn riêng giúp mình để đảm bảo quyền riêng tư nhé.

Chúc mọi người tháng mới nhiều thắng lợi, sức khỏe và thật nhiều niềm vui ✨

🇸🇬 Tài khoản Singapore (${sgdBank})
• Bank: ${sgdBank}
• Account No: ${sgdAccountNo}
• PayNow: 89261752
• Name: ${sgdAccountHolder}

🇻🇳 Tài khoản Việt Nam (${vndBank})
• Bank: ${vndBank}
• Account No: ${vndAccountNo}
• Tên: ${vndAccountHolder}`;
  }

  bindEvents() {
    // Property selection change
    const propertySelect = document.getElementById('commonPromptPropertySelect');
    if (propertySelect && !propertySelect.hasAttribute('data-bound')) {
      propertySelect.setAttribute('data-bound', 'true');
      propertySelect.addEventListener('change', (e) => {
        this.selectedPropertyId = e.target.value;
        this.updateActivePromptPreview();
      });
    }

    // Copy button
    const copyBtn = document.getElementById('copyPromptBtn');
    if (copyBtn && !copyBtn.hasAttribute('data-bound')) {
      copyBtn.setAttribute('data-bound', 'true');
      copyBtn.addEventListener('click', () => this.copyPromptToClipboard());
    }

    // Mark events as bound if both elements exist
    if (propertySelect && copyBtn) {
      this.eventsBound = true;
    }
  }

  async loadProperties() {
    try {
      const response = await API.get(API_CONFIG.ENDPOINTS.PROPERTIES);
      const result = await response.json();

      if (result.success) {
        this.properties = result.properties || [];
        console.log(`📋 [CommonPrompt] Loaded ${this.properties.length} properties`);
        this.populatePropertyDropdown();
      } else {
        console.error('[CommonPrompt] Failed to load properties:', result.error);
        this.properties = [];
      }
    } catch (error) {
      console.error('[CommonPrompt] Error loading properties:', error);
      this.properties = [];
    }
  }

  populatePropertyDropdown() {
    const select = document.getElementById('commonPromptPropertySelect');
    if (!select) return;

    // Clear existing options except the first one
    select.innerHTML = '<option value="">-- Chọn căn hộ --</option>';

    // Add properties as options
    this.properties.forEach(property => {
      const option = document.createElement('option');
      option.value = property.propertyId;
      option.textContent = `${property.propertyId} - ${property.address}`;
      select.appendChild(option);
    });
  }

  renderPromptLibrary() {
    const container = document.getElementById('promptLibraryContainer');
    if (!container) return;

    let html = '<div class="row g-3">';

    this.prompts.forEach(prompt => {
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
              ${prompt.requiresProperty ? '<span class="badge bg-info"><i class="bi bi-building me-1"></i>Cần chọn căn hộ</span>' : ''}
            </div>
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;

    // Add card hover styles
    this.addPromptCardStyles();
  }

  addPromptCardStyles() {
    if (!document.getElementById('common-prompt-card-styles')) {
      const style = document.createElement('style');
      style.id = 'common-prompt-card-styles';
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
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;

    // Update selected state visually
    document.querySelectorAll('.prompt-card').forEach(card => {
      card.classList.remove('selected');
    });
    const selectedCard = document.querySelector(`[data-prompt-id="${promptId}"]`);
    if (selectedCard) {
      selectedCard.classList.add('selected');
    }

    // Store active prompt
    this.activePromptId = promptId;

    // Show preview section
    const previewSection = document.getElementById('promptPreviewSection');
    if (previewSection) {
      previewSection.style.display = 'block';
    }

    // Show/hide property selector based on requirement
    const propertySelectorSection = document.getElementById('propertySelectSection');
    if (propertySelectorSection) {
      propertySelectorSection.style.display = prompt.requiresProperty ? 'block' : 'none';
    }

    // Update preview
    this.updateActivePromptPreview();

    // Scroll to preview section
    previewSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  updateActivePromptPreview() {
    const prompt = this.prompts.find(p => p.id === this.activePromptId);
    if (!prompt) return;

    const previewTextarea = document.getElementById('promptPreviewText');
    if (!previewTextarea) return;

    // Get selected property if needed
    let property = null;
    if (prompt.requiresProperty && this.selectedPropertyId) {
      property = this.properties.find(p => p.propertyId === this.selectedPropertyId);
    }

    // Generate prompt text
    const promptText = prompt.template(property);
    previewTextarea.value = promptText;

    // Update prompt title
    const promptTitle = document.getElementById('activePromptTitle');
    if (promptTitle) {
      promptTitle.textContent = prompt.name;
    }
  }

  async copyPromptToClipboard() {
    const previewTextarea = document.getElementById('promptPreviewText');
    if (!previewTextarea) return;

    const text = previewTextarea.value;

    try {
      await navigator.clipboard.writeText(text);

      // Show success feedback
      const copyBtn = document.getElementById('copyPromptBtn');
      const originalHtml = copyBtn.innerHTML;
      copyBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Đã copy!';
      copyBtn.classList.remove('btn-primary');
      copyBtn.classList.add('btn-success');

      setTimeout(() => {
        copyBtn.innerHTML = originalHtml;
        copyBtn.classList.remove('btn-success');
        copyBtn.classList.add('btn-primary');
      }, 2000);

      console.log('📋 Prompt copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);

      // Fallback: select the text
      previewTextarea.select();
      previewTextarea.setSelectionRange(0, 99999);
      document.execCommand('copy');

      alert('Đã copy tin nhắn!');
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public method to refresh the component
  refresh() {
    console.log('🔄 [CommonPrompt] Refreshing component...');
    // Ensure events are bound (in case DOM wasn't ready during init)
    this.ensureEventsBound();
    // Re-render prompt library
    this.renderPromptLibrary();
    // Reload properties
    this.loadProperties();
  }
}

// Initialize component when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.commonPromptComponent = new CommonPromptComponent();
  });
} else {
  window.commonPromptComponent = new CommonPromptComponent();
}
