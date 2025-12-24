/**
 * Custom Contract Template Component
 * Allows users to upload PDF/DOCX templates, edit them live, and export to PDF
 * Similar to Microsoft Word/Google Docs document editor
 *
 * NOTE: This component uses dynamic imports to avoid loading heavy libraries
 * until the component is actually needed.
 */

class CustomContractTemplateComponent {
  constructor() {
    this.editor = null;
    this.currentTemplate = null;
    this.templateMetadata = {
      fileName: '',
      uploadDate: null,
      fileType: '',
      originalSize: 0
    };
    this.autosaveInterval = null;
    this.isDirty = false;

    // Dynamically loaded modules
    this.Quill = null;
    this.mammoth = null;
    this.pdfjsLib = null;
    this.jsPDF = null;
    this.html2canvas = null;
    this.PDFDocument = null;

    // Variable placeholders for contract data
    this.variablePlaceholders = [
      { key: '{{TENANT_NAME}}', label: 'Tenant Name' },
      { key: '{{LANDLORD_NAME}}', label: 'Landlord Name' },
      { key: '{{PROPERTY_ADDRESS}}', label: 'Property Address' },
      { key: '{{ROOM_NUMBER}}', label: 'Room Number' },
      { key: '{{MONTHLY_RENT}}', label: 'Monthly Rent' },
      { key: '{{SECURITY_DEPOSIT}}', label: 'Security Deposit' },
      { key: '{{START_DATE}}', label: 'Start Date' },
      { key: '{{END_DATE}}', label: 'End Date' },
      { key: '{{AGREEMENT_DATE}}', label: 'Agreement Date' },
      { key: '{{PAYMENT_METHOD}}', label: 'Payment Method' }
    ];
  }

  /**
   * Initialize the custom template editor
   */
  async init() {
    console.log('🎨 Initializing Custom Contract Template Editor');

    // Check if editor container exists before initializing
    const editorContainer = document.getElementById('custom-template-editor');
    if (!editorContainer) {
      console.warn('⚠️ Custom template editor container not found. Skipping initialization.');
      return false;
    }

    // Load required libraries dynamically
    await this.loadLibraries();

    this.setupEventListeners();
    await this.initializeQuillEditor();
    this.setupAutosave();

    return true;
  }

  /**
   * Dynamically load required libraries
   */
  async loadLibraries() {
    try {
      console.log('📦 Loading editor libraries...');

      // Load Quill
      const QuillModule = await import('quill');
      this.Quill = QuillModule.default;

      // Load Quill CSS
      await import('quill/dist/quill.snow.css');

      // Load Mammoth
      const mammothModule = await import('mammoth');
      this.mammoth = mammothModule.default || mammothModule;

      // Load PDF-lib
      const pdfLibModule = await import('pdf-lib');
      this.PDFDocument = pdfLibModule.PDFDocument;

      // Load PDF.js with proper handling
      try {
        const pdfjsModule = await import('pdfjs-dist');
        // Handle both default export and named exports
        this.pdfjsLib = pdfjsModule.default || pdfjsModule;

        // Configure PDF.js worker with proper version check
        if (this.pdfjsLib && this.pdfjsLib.GlobalWorkerOptions) {
          const version = this.pdfjsLib.version || '4.0.379';
          this.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
        }
      } catch (pdfError) {
        console.warn('PDF.js failed to load, PDF upload will be disabled:', pdfError);
        this.pdfjsLib = null;
      }

      // jsPDF and html2canvas are already loaded globally by dashboard.js
      this.jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
      this.html2canvas = window.html2canvas;

      console.log('✅ Libraries loaded successfully');
    } catch (error) {
      console.error('Error loading libraries:', error);
      throw error;
    }
  }

  /**
   * Initialize Quill rich text editor
   */
  initializeQuillEditor() {
    const editorContainer = document.getElementById('custom-template-editor');
    if (!editorContainer || !this.Quill) {
      console.error('Editor container or Quill not found');
      return;
    }

    // Quill configuration with full toolbar
    const toolbarOptions = [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['blockquote', 'code-block'],
      ['link', 'image'],
      ['clean']
    ];

    this.editor = new this.Quill(editorContainer, {
      theme: 'snow',
      modules: {
        toolbar: toolbarOptions,
        history: {
          delay: 1000,
          maxStack: 100,
          userOnly: true
        }
      },
      placeholder: 'Upload a document or start typing your contract template...'
    });

    // Track changes for autosave
    this.editor.on('text-change', () => {
      this.isDirty = true;
      this.updateCharacterCount();
    });

    console.log('✅ Quill editor initialized');
  }

  /**
   * Setup event listeners for all UI interactions
   */
  setupEventListeners() {
    // Upload button
    const uploadBtn = document.getElementById('upload-template-btn');
    const fileInput = document.getElementById('template-file-input');

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    // Export to PDF button
    const exportBtn = document.getElementById('export-template-pdf-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportToPDF());
    }

    // Insert variable buttons
    const insertVariableBtn = document.getElementById('insert-variable-btn');
    if (insertVariableBtn) {
      insertVariableBtn.addEventListener('click', () => this.showVariableSelector());
    }

    // Save template button
    const saveTemplateBtn = document.getElementById('save-template-btn');
    if (saveTemplateBtn) {
      saveTemplateBtn.addEventListener('click', () => this.saveTemplate());
    }

    // Load template button
    const loadTemplateBtn = document.getElementById('load-template-btn');
    if (loadTemplateBtn) {
      loadTemplateBtn.addEventListener('click', () => this.showLoadTemplateDialog());
    }

    // New template button
    const newTemplateBtn = document.getElementById('new-template-btn');
    if (newTemplateBtn) {
      newTemplateBtn.addEventListener('click', () => this.createNewTemplate());
    }

    // Preview button
    const previewBtn = document.getElementById('preview-template-btn');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => this.showPreview());
    }
  }

  /**
   * Handle file upload (PDF or DOCX)
   */
  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    if (!validTypes.includes(file.type)) {
      this.showNotification('Please upload a PDF or DOCX file', 'error');
      return;
    }

    // Show loading indicator
    this.showLoadingIndicator('Uploading and processing document...');

    try {
      this.templateMetadata = {
        fileName: file.name,
        uploadDate: new Date(),
        fileType: file.type,
        originalSize: file.size
      };

      // Process based on file type
      if (file.type === 'application/pdf') {
        if (!this.pdfjsLib) {
          this.showNotification('PDF upload is currently unavailable. Please try a DOCX file instead.', 'error');
          return;
        }
        await this.processPDFFile(file);
      } else {
        await this.processDOCXFile(file);
      }

      this.updateTemplateInfo();
      this.showNotification('Document uploaded successfully!', 'success');
    } catch (error) {
      console.error('Error processing file:', error);
      this.showNotification('Error processing document. Please try again.', 'error');
    } finally {
      this.hideLoadingIndicator();
      // Reset file input
      event.target.value = '';
    }
  }

  /**
   * Process PDF file and extract text
   */
  async processPDFFile(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await this.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';

      // Extract text from all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
      }

      // Set the extracted text in the editor
      this.editor.setText(fullText);

      // Apply some basic formatting
      this.applyBasicFormatting();

      console.log('✅ PDF processed successfully');
    } catch (error) {
      console.error('Error processing PDF:', error);
      throw error;
    }
  }

  /**
   * Process DOCX file and extract formatted content
   */
  async processDOCXFile(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();

      // Use mammoth to convert DOCX to HTML
      const result = await this.mammoth.convertToHtml({ arrayBuffer });

      if (result.messages.length > 0) {
        console.warn('Conversion warnings:', result.messages);
      }

      console.log('Mammoth conversion result:', result.value);

      // Insert HTML content into Quill editor
      if (result.value && result.value.trim().length > 0) {
        // Method 1: Try using Quill's dangerouslyPasteHTML
        try {
          this.editor.root.innerHTML = result.value;
          console.log('✅ DOCX content inserted using innerHTML');
        } catch (htmlError) {
          console.warn('innerHTML method failed, trying clipboard method:', htmlError);

          // Method 2: Fallback to clipboard converter
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = result.value;
          const delta = this.editor.clipboard.convert(tempDiv);
          this.editor.setContents(delta);
          console.log('✅ DOCX content inserted using clipboard converter');
        }

        // Trigger text change to update UI
        this.isDirty = true;
        this.updateCharacterCount();

        console.log('✅ DOCX processed successfully - Content loaded into editor');
      } else {
        console.warn('DOCX conversion resulted in empty content');
        this.showNotification('Document appears to be empty or could not be converted', 'warning');
      }

    } catch (error) {
      console.error('Error processing DOCX:', error);
      throw error;
    }
  }

  /**
   * Apply basic formatting to improve readability
   */
  applyBasicFormatting() {
    const text = this.editor.getText();
    const lines = text.split('\n');

    // Look for potential headings (short lines in caps or with numbers)
    let index = 0;
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.length > 0 && trimmed.length < 100) {
        // Check if it looks like a heading
        if (trimmed === trimmed.toUpperCase() || /^\d+\./.test(trimmed)) {
          this.editor.formatLine(index, 1, 'header', 2);
        }
      }
      index += line.length + 1; // +1 for newline
    });
  }

  /**
   * Show variable selector dialog
   */
  showVariableSelector() {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.innerHTML = `
      <div class="custom-modal-content" style="max-width: 500px;">
        <div class="custom-modal-header">
          <h3>Insert Variable Placeholder</h3>
          <button class="close-modal-btn" onclick="this.closest('.custom-modal').remove()">×</button>
        </div>
        <div class="custom-modal-body">
          <p style="margin-bottom: 15px; color: #666;">
            Select a variable to insert into your template. These will be replaced with actual values when creating contracts.
          </p>
          <div class="variable-list" style="display: grid; gap: 10px;">
            ${this.variablePlaceholders.map(v => `
              <button class="variable-item" data-key="${v.key}" style="
                padding: 12px;
                text-align: left;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: white;
                cursor: pointer;
                transition: all 0.2s;
              ">
                <div style="font-weight: 600; color: #1a73e8;">${v.key}</div>
                <div style="font-size: 12px; color: #666;">${v.label}</div>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Add hover effects
    const style = document.createElement('style');
    style.textContent = `
      .variable-item:hover {
        background: #f0f7ff !important;
        border-color: #1a73e8 !important;
        transform: translateY(-2px);
        box-shadow: 0 2px 8px rgba(26, 115, 232, 0.2);
      }
    `;
    modal.appendChild(style);

    // Add click handlers
    modal.querySelectorAll('.variable-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        this.insertVariable(key);
        modal.remove();
      });
    });

    document.body.appendChild(modal);
  }

  /**
   * Insert variable at cursor position
   */
  insertVariable(variableKey) {
    const selection = this.editor.getSelection();
    if (selection) {
      this.editor.insertText(selection.index, variableKey, {
        'color': '#1a73e8',
        'bold': true
      });
      this.editor.setSelection(selection.index + variableKey.length);
      this.isDirty = true;
      this.showNotification(`Inserted ${variableKey}`, 'success');
    }
  }

  /**
   * Export current content to PDF
   */
  async exportToPDF() {
    this.showLoadingIndicator('Generating PDF...');

    try {
      const editorContent = document.querySelector('#custom-template-editor .ql-editor');

      // Create a temporary container with better styling for PDF
      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 210mm;
        padding: 20mm;
        background: white;
        font-family: 'Arial', sans-serif;
        font-size: 12pt;
        line-height: 1.6;
      `;
      tempContainer.innerHTML = editorContent.innerHTML;
      document.body.appendChild(tempContainer);

      // Use html2canvas to render the content
      const canvas = await this.html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // Remove temp container
      document.body.removeChild(tempContainer);

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new this.jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let heightLeft = pdfHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      // Add more pages if content is long
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      // Generate filename
      const fileName = this.templateMetadata.fileName
        ? this.templateMetadata.fileName.replace(/\.[^/.]+$/, '') + '_edited.pdf'
        : `contract_template_${Date.now()}.pdf`;

      // Save the PDF
      pdf.save(fileName);

      this.showNotification('PDF exported successfully!', 'success');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      this.showNotification('Error exporting PDF. Please try again.', 'error');
    } finally {
      this.hideLoadingIndicator();
    }
  }

  /**
   * Save template to localStorage
   */
  saveTemplate() {
    const templateName = prompt('Enter a name for this template:');
    if (!templateName) return;

    try {
      const savedTemplates = this.getSavedTemplates();

      const template = {
        id: Date.now(),
        name: templateName,
        content: this.editor.getContents(),
        html: this.editor.root.innerHTML,
        metadata: this.templateMetadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      savedTemplates.push(template);
      localStorage.setItem('customContractTemplates', JSON.stringify(savedTemplates));

      this.isDirty = false;
      this.showNotification(`Template "${templateName}" saved successfully!`, 'success');
    } catch (error) {
      console.error('Error saving template:', error);
      this.showNotification('Error saving template. Please try again.', 'error');
    }
  }

  /**
   * Get all saved templates from localStorage
   */
  getSavedTemplates() {
    try {
      const templates = localStorage.getItem('customContractTemplates');
      return templates ? JSON.parse(templates) : [];
    } catch (error) {
      console.error('Error loading templates:', error);
      return [];
    }
  }

  /**
   * Show load template dialog
   */
  showLoadTemplateDialog() {
    const templates = this.getSavedTemplates();

    if (templates.length === 0) {
      this.showNotification('No saved templates found', 'info');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.innerHTML = `
      <div class="custom-modal-content" style="max-width: 700px;">
        <div class="custom-modal-header">
          <h3>Load Template</h3>
          <button class="close-modal-btn" onclick="this.closest('.custom-modal').remove()">×</button>
        </div>
        <div class="custom-modal-body">
          <div class="template-list" style="display: grid; gap: 15px; max-height: 400px; overflow-y: auto;">
            ${templates.map(t => `
              <div class="template-list-item" style="
                padding: 15px;
                border: 1px solid #ddd;
                border-radius: 8px;
                background: white;
                cursor: pointer;
                transition: all 0.2s;
              " data-template-id="${t.id}">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                  <div>
                    <h4 style="margin: 0 0 8px 0; color: #1a73e8;">${t.name}</h4>
                    <div style="font-size: 12px; color: #666;">
                      Created: ${new Date(t.createdAt).toLocaleDateString()}
                      ${t.metadata.fileName ? `<br>Original file: ${t.metadata.fileName}` : ''}
                    </div>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <button class="load-template-btn" data-id="${t.id}" style="
                      padding: 6px 12px;
                      background: #1a73e8;
                      color: white;
                      border: none;
                      border-radius: 4px;
                      cursor: pointer;
                    ">Load</button>
                    <button class="delete-template-btn" data-id="${t.id}" style="
                      padding: 6px 12px;
                      background: #dc3545;
                      color: white;
                      border: none;
                      border-radius: 4px;
                      cursor: pointer;
                    ">Delete</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Add hover effects
    const style = document.createElement('style');
    style.textContent = `
      .template-list-item:hover {
        border-color: #1a73e8 !important;
        box-shadow: 0 2px 8px rgba(26, 115, 232, 0.2);
      }
      .load-template-btn:hover {
        background: #1557b0 !important;
      }
      .delete-template-btn:hover {
        background: #c82333 !important;
      }
    `;
    modal.appendChild(style);

    // Add event listeners
    modal.querySelectorAll('.load-template-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        this.loadTemplate(id);
        modal.remove();
      });
    });

    modal.querySelectorAll('.delete-template-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        if (confirm('Are you sure you want to delete this template?')) {
          this.deleteTemplate(id);
          modal.remove();
          // Reopen dialog with updated list
          setTimeout(() => this.showLoadTemplateDialog(), 100);
        }
      });
    });

    document.body.appendChild(modal);
  }

  /**
   * Load a saved template
   */
  loadTemplate(templateId) {
    const templates = this.getSavedTemplates();
    const template = templates.find(t => t.id === templateId);

    if (!template) {
      this.showNotification('Template not found', 'error');
      return;
    }

    try {
      this.editor.setContents(template.content);
      this.templateMetadata = template.metadata;
      this.updateTemplateInfo();
      this.isDirty = false;
      this.showNotification(`Template "${template.name}" loaded successfully!`, 'success');
    } catch (error) {
      console.error('Error loading template:', error);
      this.showNotification('Error loading template', 'error');
    }
  }

  /**
   * Delete a template
   */
  deleteTemplate(templateId) {
    try {
      let templates = this.getSavedTemplates();
      templates = templates.filter(t => t.id !== templateId);
      localStorage.setItem('customContractTemplates', JSON.stringify(templates));
      this.showNotification('Template deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting template:', error);
      this.showNotification('Error deleting template', 'error');
    }
  }

  /**
   * Create a new blank template
   */
  createNewTemplate() {
    if (this.isDirty) {
      if (!confirm('You have unsaved changes. Are you sure you want to create a new template?')) {
        return;
      }
    }

    this.editor.setText('');
    this.templateMetadata = {
      fileName: '',
      uploadDate: null,
      fileType: '',
      originalSize: 0
    };
    this.isDirty = false;
    this.updateTemplateInfo();
    this.showNotification('New template created', 'success');
  }

  /**
   * Show preview in a modal
   */
  showPreview() {
    const content = this.editor.root.innerHTML;

    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.innerHTML = `
      <div class="custom-modal-content" style="max-width: 900px;">
        <div class="custom-modal-header">
          <h3>Template Preview</h3>
          <button class="close-modal-btn" onclick="this.closest('.custom-modal').remove()">×</button>
        </div>
        <div class="custom-modal-body">
          <div style="
            padding: 20px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            max-height: 600px;
            overflow-y: auto;
            font-family: 'Times New Roman', serif;
            line-height: 1.6;
          ">
            ${content}
          </div>
        </div>
        <div class="custom-modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; padding: 15px;">
          <button onclick="this.closest('.custom-modal').remove()" style="
            padding: 8px 16px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  /**
   * Setup autosave functionality
   */
  setupAutosave() {
    // Only set up autosave if editor is initialized
    if (!this.editor) {
      console.warn('⚠️ Cannot setup autosave: editor not initialized');
      return;
    }

    // Autosave every 30 seconds if there are changes
    this.autosaveInterval = setInterval(() => {
      if (this.isDirty && this.editor && this.editor.getText().trim().length > 0) {
        try {
          const autosaveKey = 'customTemplateAutosave';
          const autosaveData = {
            content: this.editor.getContents(),
            html: this.editor.root.innerHTML,
            metadata: this.templateMetadata,
            timestamp: new Date().toISOString()
          };
          localStorage.setItem(autosaveKey, JSON.stringify(autosaveData));
          console.log('💾 Autosaved at', new Date().toLocaleTimeString());
        } catch (error) {
          console.error('Error during autosave:', error);
        }
      }
    }, 30000);

    // Try to restore autosave on init
    this.restoreAutosave();
  }

  /**
   * Restore autosaved content
   */
  restoreAutosave() {
    // Only restore if editor is initialized
    if (!this.editor) {
      console.warn('⚠️ Cannot restore autosave: editor not initialized');
      return;
    }

    try {
      const autosaveKey = 'customTemplateAutosave';
      const autosaveData = localStorage.getItem(autosaveKey);

      if (autosaveData) {
        const data = JSON.parse(autosaveData);
        const timestamp = new Date(data.timestamp);
        const now = new Date();
        const hoursSinceAutosave = (now - timestamp) / (1000 * 60 * 60);

        // Only restore if autosave is less than 24 hours old
        if (hoursSinceAutosave < 24) {
          // Use setTimeout to avoid blocking the UI and causing loops
          setTimeout(() => {
            if (confirm(`An autosaved version from ${timestamp.toLocaleString()} was found. Do you want to restore it?`)) {
              this.editor.setContents(data.content);
              this.templateMetadata = data.metadata;
              this.updateTemplateInfo();
              this.showNotification('Autosaved content restored', 'success');
            }
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error restoring autosave:', error);
    }
  }

  /**
   * Update template info display
   */
  updateTemplateInfo() {
    const infoEl = document.getElementById('template-info');
    if (!infoEl) return;

    if (this.templateMetadata.fileName) {
      infoEl.innerHTML = `
        <div style="font-size: 12px; color: #666;">
          <strong>File:</strong> ${this.templateMetadata.fileName}<br>
          <strong>Uploaded:</strong> ${this.templateMetadata.uploadDate ? new Date(this.templateMetadata.uploadDate).toLocaleString() : 'N/A'}<br>
          <strong>Size:</strong> ${this.formatBytes(this.templateMetadata.originalSize)}
        </div>
      `;
    } else {
      infoEl.innerHTML = '<div style="font-size: 12px; color: #999;">No template loaded</div>';
    }
  }

  /**
   * Update character count
   */
  updateCharacterCount() {
    const countEl = document.getElementById('character-count');
    if (!countEl || !this.editor) return;

    try {
      const text = this.editor.getText();
      const chars = text.length;
      const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;

      countEl.textContent = `${words} words, ${chars} characters`;
    } catch (error) {
      console.error('Error updating character count:', error);
    }
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Show loading indicator
   */
  showLoadingIndicator(message = 'Loading...') {
    const existing = document.getElementById('template-loading-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'template-loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    overlay.innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 8px; text-align: center;">
        <div class="spinner" style="
          border: 4px solid #f3f3f3;
          border-top: 4px solid #1a73e8;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 15px;
        "></div>
        <div style="color: #333; font-weight: 500;">${message}</div>
      </div>
    `;

    // Add spin animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    overlay.appendChild(style);

    document.body.appendChild(overlay);
  }

  /**
   * Hide loading indicator
   */
  hideLoadingIndicator() {
    const overlay = document.getElementById('template-loading-overlay');
    if (overlay) overlay.remove();
  }

  /**
   * Show notification toast
   */
  showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
      success: '#28a745',
      error: '#dc3545',
      info: '#17a2b8',
      warning: '#ffc107'
    };

    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 15px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 10001;
      animation: slideIn 0.3s ease-out;
      max-width: 300px;
    `;
    toast.textContent = message;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    toast.appendChild(style);

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Cleanup on destroy
   */
  destroy() {
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
    }
    if (this.editor) {
      this.editor = null;
    }
  }
}

// Make available globally (matches pattern of other components in this codebase)
window.CustomContractTemplateComponent = CustomContractTemplateComponent;
