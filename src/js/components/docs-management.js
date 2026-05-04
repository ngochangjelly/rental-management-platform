import Quill from "quill";
import "quill/dist/quill.snow.css";
import i18next from "../i18n.js";

class DocsManagement {
  constructor() {
    this.docs = [];
    this.currentDoc = null;
    this.quill = null;
    this.view = "list"; // "list" | "editor"
    this._saveTimer = null;
    this._saveState = "idle"; // "idle" | "saving" | "saved" | "error"
    this._searchQuery = "";
    this._pendingDeleteId = null;
    this.init();
  }

  t(key, vars) {
    return i18next.t(`docs.${key}`, vars || {});
  }

  init() {
    this._injectStyles();
    this._renderContainer();
  }

  // ─── Styles ────────────────────────────────────────────────────────────────

  _injectStyles() {
    if (document.getElementById("docs-management-styles")) return;
    const style = document.createElement("style");
    style.id = "docs-management-styles";
    style.textContent = `
      /* ── Docs list ──────────────────────────────────────────────────── */
      #docs-container {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }

      .docs-header {
        background: #fff;
        border-bottom: 1px solid #e0e0e0;
        padding: 16px 24px;
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .docs-header-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: #202124;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .docs-header-title i {
        color: #1a73e8;
        font-size: 1.4rem;
      }

      .docs-search {
        flex: 1;
        min-width: 200px;
        max-width: 480px;
        position: relative;
      }

      .docs-search input {
        width: 100%;
        padding: 8px 16px 8px 40px;
        border: 1px solid #e0e0e0;
        border-radius: 24px;
        font-size: 0.875rem;
        background: #f1f3f4;
        transition: all 0.2s;
        outline: none;
      }

      .docs-search input:focus {
        background: #fff;
        border-color: #1a73e8;
        box-shadow: 0 0 0 2px rgba(26,115,232,0.15);
      }

      .docs-search .search-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: #80868b;
        font-size: 0.9rem;
        pointer-events: none;
      }

      .docs-new-btn {
        background: #1a73e8;
        color: #fff;
        border: none;
        border-radius: 24px;
        padding: 8px 20px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: background 0.15s, box-shadow 0.15s;
        white-space: nowrap;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      }

      .docs-new-btn:hover {
        background: #1557b0;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      }

      .docs-grid-section {
        padding: 24px;
        flex: 1;
      }

      .docs-grid-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: #80868b;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 16px;
      }

      .docs-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
      }

      /* New document card (+ button) */
      .docs-new-card {
        border: 2px dashed #dadce0;
        border-radius: 8px;
        aspect-ratio: 3/4;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        transition: border-color 0.2s, background 0.2s;
        color: #80868b;
        background: #fff;
        font-size: 0.875rem;
        font-weight: 500;
      }

      .docs-new-card:hover {
        border-color: #1a73e8;
        background: #f0f6ff;
        color: #1a73e8;
      }

      .docs-new-card i {
        font-size: 2rem;
      }

      /* Document card */
      .docs-card {
        border: 1px solid #dadce0;
        border-radius: 8px;
        aspect-ratio: 3/4;
        display: flex;
        flex-direction: column;
        cursor: pointer;
        transition: border-color 0.2s, box-shadow 0.2s;
        background: #fff;
        overflow: hidden;
        position: relative;
      }

      .docs-card:hover {
        border-color: #1a73e8;
        box-shadow: 0 2px 12px rgba(0,0,0,0.12);
      }

      .docs-card-preview {
        flex: 1;
        padding: 12px;
        font-size: 0.7rem;
        line-height: 1.5;
        color: #3c4043;
        overflow: hidden;
        background: #fafafa;
        border-bottom: 1px solid #f0f0f0;
        position: relative;
      }

      .docs-card-preview::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 32px;
        background: linear-gradient(transparent, #fafafa);
      }

      .docs-card-preview img {
        max-width: 100%;
        height: auto;
        border-radius: 4px;
        margin: 4px 0;
      }

      .docs-card-footer {
        padding: 10px 12px;
        background: #fff;
        flex-shrink: 0;
      }

      .docs-card-title {
        font-size: 0.8rem;
        font-weight: 600;
        color: #202124;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 2px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .docs-card-title i {
        color: #1a73e8;
        font-size: 0.85rem;
        flex-shrink: 0;
      }

      .docs-card-meta {
        font-size: 0.7rem;
        color: #80868b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .docs-card-actions {
        position: absolute;
        top: 6px;
        right: 6px;
        display: none;
        gap: 4px;
      }

      .docs-card:hover .docs-card-actions {
        display: flex;
      }

      .docs-card-action-btn {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: none;
        background: rgba(255,255,255,0.9);
        box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 0.8rem;
        color: #5f6368;
        transition: background 0.15s;
      }

      .docs-card-action-btn:hover {
        background: #fff;
        color: #d93025;
      }

      .docs-empty-state {
        grid-column: 1 / -1;
        text-align: center;
        padding: 64px 24px;
        color: #80868b;
      }

      .docs-empty-state i {
        font-size: 4rem;
        color: #dadce0;
        display: block;
        margin-bottom: 16px;
      }

      .docs-empty-state h3 {
        font-size: 1rem;
        font-weight: 500;
        color: #5f6368;
        margin-bottom: 6px;
      }

      .docs-empty-state p {
        font-size: 0.875rem;
        margin-bottom: 20px;
      }

      /* ── Editor view ────────────────────────────────────────────────── */
      .docs-editor-view {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background: #f8f9fa;
      }

      .docs-editor-topbar {
        background: #fff;
        border-bottom: 1px solid #e0e0e0;
        padding: 0 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 56px;
        flex-wrap: wrap;
        position: sticky;
        top: 0;
        z-index: 20;
      }

      .docs-back-btn {
        border: none;
        background: none;
        cursor: pointer;
        padding: 6px;
        border-radius: 50%;
        color: #5f6368;
        font-size: 1rem;
        display: flex;
        align-items: center;
        transition: background 0.15s;
      }

      .docs-back-btn:hover {
        background: #f1f3f4;
        color: #202124;
      }

      .docs-title-input {
        flex: 1;
        border: none;
        outline: none;
        font-size: 1rem;
        font-weight: 500;
        color: #202124;
        padding: 4px 8px;
        border-radius: 4px;
        min-width: 120px;
        background: transparent;
        transition: background 0.15s;
      }

      .docs-title-input:hover,
      .docs-title-input:focus {
        background: #f1f3f4;
      }

      .docs-save-indicator {
        font-size: 0.75rem;
        color: #80868b;
        white-space: nowrap;
        min-width: 60px;
        text-align: right;
      }

      .docs-save-indicator.saving { color: #1a73e8; }
      .docs-save-indicator.saved { color: #34a853; }
      .docs-save-indicator.error { color: #d93025; }

      .docs-toolbar-actions {
        display: flex;
        gap: 6px;
        align-items: center;
      }

      .docs-action-btn {
        border: 1px solid #dadce0;
        background: #fff;
        color: #3c4043;
        border-radius: 6px;
        padding: 6px 14px;
        font-size: 0.8rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: background 0.15s, border-color 0.15s;
        white-space: nowrap;
      }

      .docs-action-btn:hover {
        background: #f1f3f4;
        border-color: #c4c7c5;
      }

      .docs-action-btn.primary {
        background: #1a73e8;
        border-color: #1a73e8;
        color: #fff;
      }

      .docs-action-btn.primary:hover {
        background: #1557b0;
        border-color: #1557b0;
      }

      .docs-action-btn.danger {
        color: #d93025;
        border-color: #d93025;
      }

      .docs-action-btn.danger:hover {
        background: #fce8e6;
      }

      .docs-action-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .docs-editor-body {
        flex: 1;
        padding: 24px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        background: #f8f9fa;
      }

      /* Google Docs–style page */
      .docs-page {
        background: #fff;
        width: 100%;
        max-width: 816px;
        min-height: 1056px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06);
        border-radius: 2px;
        padding: 72px 96px;
        box-sizing: border-box;
      }

      @media (max-width: 900px) {
        .docs-page {
          padding: 40px 32px;
        }
      }

      @media (max-width: 600px) {
        .docs-page {
          padding: 24px 16px;
        }
        .docs-grid {
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        }
      }

      /* Document title inside the page canvas */
      .docs-page-title {
        font-size: 26pt;
        font-weight: 700;
        color: #202124;
        font-family: 'Arial', sans-serif;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e0e0e0;
        word-break: break-word;
      }

      /* Quill overrides for Google Docs feel */
      .docs-page .ql-editor {
        font-family: 'Arial', sans-serif;
        font-size: 11pt;
        line-height: 1.5;
        color: #202124;
        padding: 0;
        min-height: 600px;
      }

      .docs-page .ql-editor.ql-blank::before {
        font-style: normal;
        color: #9aa0a6;
        left: 0;
      }

      .docs-page .ql-container {
        border: none !important;
        font-size: 11pt;
      }

      .docs-page .ql-container.ql-snow {
        border: none;
      }

      /* Quill toolbar - floating above page */
      .docs-quill-toolbar-wrap {
        width: 100%;
        max-width: 816px;
        margin-bottom: 8px;
        background: #fff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: visible;
        z-index: 10;
        box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      }

      .docs-quill-toolbar-wrap .ql-toolbar.ql-snow {
        border: none;
        padding: 6px 8px;
        flex-wrap: wrap;
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .docs-quill-toolbar-wrap .ql-toolbar.ql-snow .ql-formats {
        margin-right: 6px;
      }

      /* Delete confirm overlay on card */
      .docs-delete-confirm {
        position: absolute;
        inset: 0;
        background: rgba(217,48,37,0.92);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        border-radius: 8px;
        color: #fff;
        padding: 16px;
        text-align: center;
        z-index: 2;
      }

      .docs-delete-confirm p {
        font-size: 0.8rem;
        font-weight: 500;
        margin: 0;
      }

      .docs-delete-confirm-btns {
        display: flex;
        gap: 8px;
      }

      .docs-delete-confirm-btns button {
        border: 2px solid rgba(255,255,255,0.7);
        border-radius: 4px;
        background: transparent;
        color: #fff;
        font-size: 0.75rem;
        padding: 4px 12px;
        cursor: pointer;
        transition: background 0.15s;
        font-weight: 500;
      }

      .docs-delete-confirm-btns button:first-child {
        background: rgba(255,255,255,0.25);
      }

      .docs-delete-confirm-btns button:first-child:hover {
        background: rgba(255,255,255,0.4);
      }

      .docs-delete-confirm-btns button:last-child:hover {
        background: rgba(255,255,255,0.15);
      }

      /* Image drag zone highlight */
      .docs-page.drag-over .ql-editor {
        outline: 3px dashed #1a73e8;
        border-radius: 4px;
      }

      /* Quill image in editor */
      .docs-page .ql-editor img {
        max-width: 100%;
        border-radius: 4px;
        cursor: pointer;
      }

      .docs-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 64px;
        color: #80868b;
        gap: 12px;
        font-size: 0.9rem;
      }

      /* Share button active dot */
      .docs-share-dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        background: #34a853;
        border-radius: 50%;
        vertical-align: middle;
        margin-left: 2px;
        flex-shrink: 0;
      }

      /* Share modal */
      .docs-share-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.45);
        z-index: 1050;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }

      .docs-share-modal {
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        width: 100%;
        max-width: 480px;
        padding: 24px;
      }

      .docs-share-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
      }

      .docs-share-modal-title {
        font-size: 1rem;
        font-weight: 600;
        color: #202124;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .docs-share-modal-title i { color: #1a73e8; }

      .docs-share-close {
        border: none;
        background: none;
        cursor: pointer;
        font-size: 1.2rem;
        color: #80868b;
        padding: 4px;
        border-radius: 50%;
        line-height: 1;
      }

      .docs-share-close:hover { background: #f1f3f4; color: #202124; }

      .docs-share-toggle-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 0;
        border-top: 1px solid #f0f0f0;
        border-bottom: 1px solid #f0f0f0;
        margin-bottom: 16px;
      }

      .docs-share-toggle-info { flex: 1; }
      .docs-share-toggle-info strong { font-size: 0.875rem; color: #202124; }
      .docs-share-toggle-info p { font-size: 0.75rem; color: #80868b; margin: 2px 0 0; }

      /* iOS-style toggle */
      .docs-share-toggle {
        position: relative;
        width: 44px;
        height: 24px;
        flex-shrink: 0;
      }

      .docs-share-toggle input { opacity: 0; width: 0; height: 0; }

      .docs-share-toggle-slider {
        position: absolute;
        inset: 0;
        background: #ccc;
        border-radius: 24px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .docs-share-toggle-slider::before {
        content: "";
        position: absolute;
        left: 3px;
        top: 3px;
        width: 18px;
        height: 18px;
        background: #fff;
        border-radius: 50%;
        transition: transform 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      }

      .docs-share-toggle input:checked + .docs-share-toggle-slider { background: #34a853; }
      .docs-share-toggle input:checked + .docs-share-toggle-slider::before { transform: translateX(20px); }

      .docs-share-link-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .docs-share-link-input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #dadce0;
        border-radius: 6px;
        font-size: 0.8rem;
        color: #3c4043;
        background: #f8f9fa;
        outline: none;
        min-width: 0;
      }

      .docs-share-copy-btn {
        border: 1px solid #dadce0;
        background: #fff;
        color: #1a73e8;
        font-size: 0.8rem;
        font-weight: 500;
        padding: 8px 14px;
        border-radius: 6px;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s;
        display: flex;
        align-items: center;
        gap: 5px;
        flex-shrink: 0;
      }

      .docs-share-copy-btn:hover { background: #f0f6ff; }
      .docs-share-copy-btn.copied { color: #34a853; border-color: #34a853; }

      .docs-share-notice {
        font-size: 0.72rem;
        color: #80868b;
        margin-top: 12px;
        display: flex;
        align-items: flex-start;
        gap: 6px;
      }

      .docs-share-notice i { flex-shrink: 0; margin-top: 1px; }

      /* Tags pill display on card */
      .docs-card-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        margin-top: 4px;
      }

      .docs-tag-pill {
        background: #e8f0fe;
        color: #1a73e8;
        font-size: 0.65rem;
        padding: 1px 6px;
        border-radius: 99px;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Container Shell ───────────────────────────────────────────────────────

  _renderContainer() {
    const container = document.getElementById("docs-container");
    if (!container) return;
    container.innerHTML = `
      <div id="docs-list-view"></div>
      <div id="docs-editor-view" style="display:none;height:100%;"></div>
    `;
    this._renderListView();
  }

  // ─── List View ─────────────────────────────────────────────────────────────

  _renderListView() {
    const listEl = document.getElementById("docs-list-view");
    if (!listEl) return;

    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const isAdmin = currentUser && currentUser.role === 'admin';

    listEl.innerHTML = `
      <div class="docs-header">
        <h2 class="docs-header-title">
          <i class="bi bi-file-richtext-fill"></i>
          <span data-i18n="docs.title">${this.t("title")}</span>
        </h2>
        <div class="docs-search">
          <i class="bi bi-search search-icon"></i>
          <input type="text" id="docsSearchInput" placeholder="${this.t("searchPlaceholder")}" value="${this._searchQuery}">
        </div>
        ${isAdmin ? `
        <button class="docs-new-btn" id="docsNewBtn">
          <i class="bi bi-plus-lg"></i>
          <span>${this.t("newDoc")}</span>
        </button>
        ` : ""}
      </div>
      <div class="docs-grid-section" id="docsGridSection">
        <div class="docs-loading" id="docsLoading">
          <span class="spinner-border spinner-border-sm"></span>
          Loading...
        </div>
        <div id="docsGridContainer" style="display:none;"></div>
      </div>
    `;

    document.getElementById("docsNewBtn")?.addEventListener("click", () => this._createNewDoc());

    const searchInput = document.getElementById("docsSearchInput");
    let searchTimer = null;
    searchInput?.addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      this._searchQuery = e.target.value;
      searchTimer = setTimeout(() => this._renderDocGrid(), 300);
    });

    this._loadDocs();
  }

  async _loadDocs() {
    try {
      const url = this._searchQuery
        ? `${API_CONFIG.ENDPOINTS.DOCS}?search=${encodeURIComponent(this._searchQuery)}`
        : API_CONFIG.ENDPOINTS.DOCS;
      const res = await API.get(url);
      const data = await res.json();
      if (data.success) {
        this.docs = data.docs || [];
      } else {
        this.docs = [];
      }
    } catch (e) {
      console.error("Failed to load docs:", e);
      this.docs = [];
    }
    this._renderDocGrid();
  }

  _renderDocGrid() {
    const loading = document.getElementById("docsLoading");
    const container = document.getElementById("docsGridContainer");
    if (!container) return;
    if (loading) loading.style.display = "none";
    container.style.display = "block";

    const filtered = this._searchQuery
      ? this.docs.filter(
          (d) =>
            d.title.toLowerCase().includes(this._searchQuery.toLowerCase()) ||
            d.name.toLowerCase().includes(this._searchQuery.toLowerCase()) ||
            (d.contentText || "").toLowerCase().includes(this._searchQuery.toLowerCase()),
        )
      : this.docs;

    let html = `<div class="docs-grid">`;

    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const isAdmin = currentUser && currentUser.role === 'admin';

    // New doc card (always first)
    if (!this._searchQuery && isAdmin) {
      html += `
        <div class="docs-new-card" id="docsNewCard" title="${this.t("newDoc")}">
          <i class="bi bi-plus-lg"></i>
          <span>${this.t("newDoc")}</span>
        </div>
      `;
    }

    if (filtered.length === 0) {
      if (this._searchQuery) {
        html += `
          <div class="docs-empty-state">
            <i class="bi bi-search"></i>
            <h3>${this.t("noResults")}</h3>
            <p>${this.t("noResultsDesc")}</p>
          </div>
        `;
      } else {
        html += `
          <div class="docs-empty-state" style="grid-column: 1 / -1;">
            <i class="bi bi-file-earmark-text"></i>
            <h3>${this.t("noDocuments")}</h3>
            <p>${this.t("noDocumentsDesc")}</p>
          </div>
        `;
      }
    } else {
      filtered.forEach((doc) => {
        const isPendingDelete = this._pendingDeleteId === doc._id;
        const preview = this._buildPreviewSnippet(doc);
        const timeAgo = this._timeAgo(doc.updatedAt);
        const tags = (doc.tags || []).slice(0, 3);

        html += `
          <div class="docs-card" data-doc-id="${doc._id}">
            <div class="docs-card-preview">
              ${preview}
            </div>
            <div class="docs-card-footer">
              <div class="docs-card-title">
                <i class="bi bi-file-richtext-fill"></i>
                <span>${escapeHtml(doc.title || doc.name || this.t("untitled"))}</span>
              </div>
              <div class="docs-card-meta">
                ${this.t("lastUpdated")} ${timeAgo} ${this.t("by")} ${escapeHtml(doc.updatedBy || "")}
              </div>
              ${tags.length ? `<div class="docs-card-tags">${tags.map((t) => `<span class="docs-tag-pill">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
            </div>
            ${isAdmin ? `
            <div class="docs-card-actions">
              <button class="docs-card-action-btn" data-action="delete" data-doc-id="${doc._id}" title="${this.t("deleteDoc")}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
            ` : ""}
            ${
              isPendingDelete
                ? `<div class="docs-delete-confirm">
                    <p>${this.t("confirmDelete")}</p>
                    <div class="docs-delete-confirm-btns">
                      <button data-action="confirm-delete" data-doc-id="${doc._id}">Delete</button>
                      <button data-action="cancel-delete">Cancel</button>
                    </div>
                   </div>`
                : ""
            }
          </div>
        `;
      });
    }

    html += `</div>`;
    container.innerHTML = html;

    // Bind events
    document.getElementById("docsNewCard")?.addEventListener("click", () => this._createNewDoc());

    container.querySelectorAll(".docs-card").forEach((card) => {
      const docId = card.dataset.docId;
      card.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (btn) return;
        this._openDoc(docId);
      });
    });

    container.querySelectorAll("[data-action='delete']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._pendingDeleteId = btn.dataset.docId;
        this._renderDocGrid();
      });
    });

    container.querySelectorAll("[data-action='confirm-delete']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._deleteDoc(btn.dataset.docId);
      });
    });

    container.querySelectorAll("[data-action='cancel-delete']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._pendingDeleteId = null;
        this._renderDocGrid();
      });
    });
  }

  _buildPreviewSnippet(doc) {
    const text = (doc.contentText || "").substring(0, 200);
    if (!text) return `<span style="color:#9aa0a6;font-style:italic;">Empty document</span>`;
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  _timeAgo(dateStr) {
    if (!dateStr) return "";
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return this.t("justNow");
    if (diff < 3600) return this.t("minutesAgo", { n: Math.floor(diff / 60) });
    if (diff < 86400) return this.t("hoursAgo", { n: Math.floor(diff / 3600) });
    return this.t("daysAgo", { n: Math.floor(diff / 86400) });
  }

  // ─── Create / Open / Delete ────────────────────────────────────────────────

  async _createNewDoc() {
    try {
      const res = await API.post(API_CONFIG.ENDPOINTS.DOCS, {
        title: this.t("untitled"),
        name: this.t("untitled"),
        content: { ops: [] },
        contentText: "",
      });
      const data = await res.json();
      if (data.success && data.doc) {
        this.docs.unshift(data.doc);
        this._openDoc(data.doc._id, data.doc);
      } else {
        showToast(this.t("createFailed"), "error");
      }
    } catch (e) {
      console.error("Failed to create doc:", e);
      showToast(this.t("createFailed"), "error");
    }
  }

  _docSlug(doc) {
    const titleSlug = SlugUtils.toSlug(doc.title || doc.name || "");
    return titleSlug ? `${titleSlug}-${doc._id}` : doc._id;
  }

  async _openDoc(docId, docData = null) {
    // Fetch full doc if not provided
    if (!docData) {
      try {
        const res = await API.get(API_CONFIG.ENDPOINTS.DOC_BY_ID(docId));
        const data = await res.json();
        if (data.success) {
          docData = data.doc;
        } else {
          showToast(this.t("loadFailed"), "error");
          return;
        }
      } catch (e) {
        showToast(this.t("loadFailed"), "error");
        return;
      }
    }

    this.currentDoc = docData;
    window.appRouter?.replace(`/docs/${this._docSlug(docData)}`);
    this._showEditorView(docData);
  }

  async _deleteDoc(docId) {
    try {
      const res = await API.delete(API_CONFIG.ENDPOINTS.DOC_BY_ID(docId));
      const data = await res.json();
      if (data.success) {
        this.docs = this.docs.filter((d) => d._id !== docId);
        this._pendingDeleteId = null;
        showToast(this.t("docDeleted"), "success");
        this._renderDocGrid();
      } else {
        showToast(this.t("deleteFailed"), "error");
      }
    } catch (e) {
      showToast(this.t("deleteFailed"), "error");
    }
  }

  // ─── Editor View ───────────────────────────────────────────────────────────

  _showEditorView(doc) {
    const listView = document.getElementById("docs-list-view");
    const editorView = document.getElementById("docs-editor-view");
    if (listView) listView.style.display = "none";
    if (editorView) {
      editorView.style.display = "flex";
      editorView.style.flexDirection = "column";
    }

    this._renderEditorView(doc);
  }

  _showListView() {
    const listView = document.getElementById("docs-list-view");
    const editorView = document.getElementById("docs-editor-view");
    if (editorView) editorView.style.display = "none";
    if (listView) listView.style.display = "block";

    this.quill = null;
    this.currentDoc = null;
    window.appRouter?.replace("/docs");

    // Reload docs to reflect any changes
    this._loadDocs();
  }

  _renderEditorView(doc) {
    const editorView = document.getElementById("docs-editor-view");
    if (!editorView) return;

    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const isAdmin = currentUser && currentUser.role === 'admin';

    editorView.innerHTML = `
      <div class="docs-editor-topbar" id="docsEditorTopbar">
        <button class="docs-back-btn" id="docsBackBtn" title="${this.t("backToList")}">
          <i class="bi bi-arrow-left"></i>
        </button>
        <input
          class="docs-title-input"
          id="docsTitleInput"
          type="text"
          value="${escapeHtml(doc.title || doc.name || this.t("untitled"))}"
          placeholder="${this.t("titlePlaceholder")}"
          maxlength="200"
          ${isAdmin ? "" : "readonly"}
        >
        <span class="docs-save-indicator" id="docsSaveIndicator"></span>
        <div class="docs-toolbar-actions">
          <button class="docs-action-btn" id="docsShareBtn" title="Share">
            <i class="bi bi-share"></i>
            <span class="d-none d-md-inline">Share</span>
            ${doc.isPublic ? '<span class="docs-share-dot"></span>' : ""}
          </button>
          <button class="docs-action-btn" id="docsExportBtn" title="${this.t("exportImage")}">
            <i class="bi bi-image"></i>
            <span class="d-none d-md-inline">${this.t("exportImage")}</span>
          </button>
          ${isAdmin ? `
          <button class="docs-action-btn primary" id="docsSaveBtn">
            <i class="bi bi-floppy"></i>
            <span>${this.t("saveDoc")}</span>
          </button>
          ` : ""}
        </div>
      </div>
      <div class="docs-editor-body" id="docsEditorBody">
        ${isAdmin ? `
        <div class="docs-quill-toolbar-wrap">
          <div id="docsQuillToolbar"></div>
        </div>
        ` : ""}
        <div class="docs-page" id="docsPage">
          <div class="docs-page-title" id="docsPageTitle">${escapeHtml(doc.title || doc.name || this.t("untitled"))}</div>
          <div id="docsQuillEditor"></div>
        </div>
      </div>
    `;

    // Back button
    document.getElementById("docsBackBtn")?.addEventListener("click", () => {
      this._showListView();
    });

    // Save button
    document.getElementById("docsSaveBtn")?.addEventListener("click", () => {
      this._saveDoc(true);
    });

    // Share button
    document.getElementById("docsShareBtn")?.addEventListener("click", () => {
      this._showShareModal();
    });

    // Export button
    document.getElementById("docsExportBtn")?.addEventListener("click", () => {
      this._exportAsImage();
    });

    // Title input — sync to page title element and trigger auto-save
    const titleInput = document.getElementById("docsTitleInput");
    titleInput?.addEventListener("input", () => {
      const pageTitle = document.getElementById("docsPageTitle");
      if (pageTitle) pageTitle.textContent = titleInput.value || this.t("untitled");
      if (isAdmin) this._scheduleSave();
    });

    // Initialize Quill
    this._initQuill(doc);
  }

  _initQuill(doc) {
    const toolbarEl = document.getElementById("docsQuillToolbar");
    const editorEl = document.getElementById("docsQuillEditor");
    if (!editorEl) return;

    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const isAdmin = currentUser && currentUser.role === 'admin';

    // Build toolbar HTML
    if (toolbarEl && isAdmin) {
      toolbarEl.innerHTML = `
        <span class="ql-formats">
          <select class="ql-header">
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
            <option selected>Normal</option>
          </select>
        </span>
        <span class="ql-formats">
          <button class="ql-bold"></button>
          <button class="ql-italic"></button>
          <button class="ql-underline"></button>
          <button class="ql-strike"></button>
        </span>
        <span class="ql-formats">
          <select class="ql-color"></select>
          <select class="ql-background"></select>
        </span>
        <span class="ql-formats">
          <button class="ql-list" value="ordered"></button>
          <button class="ql-list" value="bullet"></button>
          <button class="ql-list" value="check"></button>
          <button class="ql-indent" value="-1"></button>
          <button class="ql-indent" value="+1"></button>
        </span>
        <span class="ql-formats">
          <button class="ql-align" value=""></button>
          <button class="ql-align" value="center"></button>
          <button class="ql-align" value="right"></button>
          <button class="ql-align" value="justify"></button>
        </span>
        <span class="ql-formats">
          <button class="ql-blockquote"></button>
          <button class="ql-code-block"></button>
        </span>
        <span class="ql-formats">
          <button class="ql-link"></button>
          <button class="ql-image" title="Insert image"></button>
        </span>
        <span class="ql-formats">
          <button class="ql-clean"></button>
        </span>
      `;
    }

    this.quill = new Quill(editorEl, {
      theme: "snow",
      placeholder: this.t("editorPlaceholder"),
      modules: toolbarEl && isAdmin ? {
        toolbar: {
          container: toolbarEl,
          handlers: {
            image: () => this._imageUploadHandler(),
          },
        },
      } : { toolbar: false },
    });

    // Load existing content
    if (doc.content && doc.content.ops && doc.content.ops.length > 0) {
      this.quill.setContents(doc.content);
    }

    if (!isAdmin) {
      this.quill.disable();
    } else {
      // Auto-save on text change (debounced)
      this.quill.on("text-change", () => {
        this._scheduleSave();
      });

      // Drag & drop image support on the page
      this._initDragDrop();
    }
  }

  _initDragDrop() {
    const page = document.getElementById("docsPage");
    if (!page) return;

    page.addEventListener("dragover", (e) => {
      e.preventDefault();
      page.classList.add("drag-over");
    });

    page.addEventListener("dragleave", () => {
      page.classList.remove("drag-over");
    });

    page.addEventListener("drop", async (e) => {
      e.preventDefault();
      page.classList.remove("drag-over");

      const files = [...(e.dataTransfer?.files || [])].filter((f) =>
        f.type.startsWith("image/"),
      );

      for (const file of files) {
        await this._uploadAndInsertImage(file);
      }
    });
  }

  _imageUploadHandler() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async () => {
      const files = [...(input.files || [])];
      for (const file of files) {
        await this._uploadAndInsertImage(file);
      }
    };
    input.click();
  }

  async _uploadAndInsertImage(file) {
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPLOAD_TENANT_DOCUMENT}`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );

      const data = await res.json();
      if (data.success && (data.originalUrl || data.url)) {
        // Prefer Cloudinary URL for portability; fall back to proxy URL
        const imageUrl = data.originalUrl || `${API_CONFIG.BASE_URL}${data.url}`;
        const range = this.quill.getSelection(true);
        this.quill.insertEmbed(range.index, "image", imageUrl, "user");
        this.quill.setSelection(range.index + 1, "silent");
      } else {
        showToast("Image upload failed", "error");
      }
    } catch (e) {
      console.error("Image upload error:", e);
      showToast("Image upload failed", "error");
    }
  }

  // ─── Save ──────────────────────────────────────────────────────────────────

  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._setSaveState("saving");
    this._saveTimer = setTimeout(() => this._saveDoc(false), 1500);
  }

  _setSaveState(state) {
    this._saveState = state;
    const indicator = document.getElementById("docsSaveIndicator");
    if (!indicator) return;
    indicator.className = `docs-save-indicator ${state}`;
    const map = {
      idle: "",
      saving: this.t("saving"),
      saved: `<i class="bi bi-check-circle-fill me-1"></i>${this.t("saved")}`,
      error: this.t("saveFailed"),
    };
    indicator.innerHTML = map[state] || "";
  }

  async _saveDoc(manual = false) {
    if (!this.currentDoc) return;
    if (!this.quill) return;

    const titleInput = document.getElementById("docsTitleInput");
    const title = (titleInput?.value || "").trim() || this.t("untitled");
    const content = this.quill.getContents();
    const contentText = this.quill.getText().trim();

    this._setSaveState("saving");

    try {
      const res = await API.put(
        API_CONFIG.ENDPOINTS.DOC_BY_ID(this.currentDoc._id),
        { title, name: title, content, contentText },
      );
      const data = await res.json();
      if (data.success) {
        this.currentDoc = data.doc;
        // Update in-memory list
        const idx = this.docs.findIndex((d) => d._id === this.currentDoc._id);
        if (idx !== -1) {
          this.docs[idx] = { ...this.docs[idx], ...data.doc };
        }
        // Keep URL slug in sync with title
        window.appRouter?.replace(`/docs/${this._docSlug(this.currentDoc)}`);
        this._setSaveState("saved");
        if (manual) showToast(this.t("saved"), "success");
        // Fade back to idle after 3s
        setTimeout(() => {
          if (this._saveState === "saved") this._setSaveState("idle");
        }, 3000);
      } else {
        this._setSaveState("error");
        if (manual) showToast(this.t("saveFailed"), "error");
      }
    } catch (e) {
      console.error("Save doc failed:", e);
      this._setSaveState("error");
      if (manual) showToast(this.t("saveFailed"), "error");
    }
  }

  // ─── Export as Image ───────────────────────────────────────────────────────

  async _exportAsImage() {
    const exportBtn = document.getElementById("docsExportBtn");
    const page = document.getElementById("docsPage");
    if (!page) return;

    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${this.t("exporting")}`;
    }

    try {
      // Ensure html2canvas is available
      if (typeof html2canvas === "undefined") {
        showToast("html2canvas not available", "error");
        return;
      }

      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const link = document.createElement("a");
      const title = this.currentDoc?.title || "document";
      link.download = `${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      showToast("Exported!", "success");
    } catch (e) {
      console.error("Export failed:", e);
      showToast("Export failed: " + e.message, "error");
    } finally {
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.innerHTML = `<i class="bi bi-image"></i><span class="d-none d-md-inline">${this.t("exportImage")}</span>`;
      }
    }
  }

  // ─── Share modal ───────────────────────────────────────────────────────────

  _shareUrl(token) {
    return `${window.location.origin}/public-doc.html?t=${token}`;
  }

  _showShareModal() {
    if (!this.currentDoc) return;

    // Remove any existing modal
    document.getElementById("docsShareModalBackdrop")?.remove();

    const isPublic = !!this.currentDoc.isPublic;
    const token = this.currentDoc.shareToken || "";
    const shareUrl = isPublic && token ? this._shareUrl(token) : "";

    const backdrop = document.createElement("div");
    backdrop.id = "docsShareModalBackdrop";
    backdrop.className = "docs-share-modal-backdrop";
    backdrop.innerHTML = `
      <div class="docs-share-modal" id="docsShareModal">
        <div class="docs-share-modal-header">
          <div class="docs-share-modal-title">
            <i class="bi bi-share-fill"></i>
            Share document
          </div>
          <button class="docs-share-close" id="docsShareClose"><i class="bi bi-x-lg"></i></button>
        </div>

        <div class="docs-share-toggle-row">
          <div class="docs-share-toggle-info">
            <strong>Public link sharing</strong>
            <p>Anyone with the link can view this document</p>
          </div>
          <label class="docs-share-toggle">
            <input type="checkbox" id="docsShareToggle" ${isPublic ? "checked" : ""}>
            <span class="docs-share-toggle-slider"></span>
          </label>
        </div>

        <div id="docsShareLinkSection" style="display:${isPublic ? "block" : "none"};">
          <div class="docs-share-link-row">
            <input class="docs-share-link-input" id="docsShareLinkInput" type="text"
              value="${escapeHtml(shareUrl)}" readonly>
            <button class="docs-share-copy-btn" id="docsShareCopyBtn">
              <i class="bi bi-clipboard"></i> Copy
            </button>
          </div>
          <p class="docs-share-notice">
            <i class="bi bi-shield-lock-fill"></i>
            Link is unguessable. Disable sharing to revoke access immediately.
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    // Close on backdrop click (not modal itself)
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) this._closeShareModal();
    });

    document.getElementById("docsShareClose")?.addEventListener("click", () => {
      this._closeShareModal();
    });

    // Toggle sharing on/off
    document.getElementById("docsShareToggle")?.addEventListener("change", async (e) => {
      await this._toggleShare(e.target.checked);
    });

    // Copy link
    document.getElementById("docsShareCopyBtn")?.addEventListener("click", () => {
      this._copyShareLink();
    });
  }

  _closeShareModal() {
    document.getElementById("docsShareModalBackdrop")?.remove();
  }

  async _toggleShare(enable) {
    const toggle = document.getElementById("docsShareToggle");
    const linkSection = document.getElementById("docsShareLinkSection");
    const linkInput = document.getElementById("docsShareLinkInput");
    const shareBtn = document.getElementById("docsShareBtn");

    if (toggle) toggle.disabled = true;

    try {
      if (enable) {
        const res = await API.post(API_CONFIG.ENDPOINTS.DOC_SHARE(this.currentDoc._id));
        const data = await res.json();
        if (data.success) {
          this.currentDoc.isPublic = true;
          this.currentDoc.shareToken = data.shareToken;
          const url = this._shareUrl(data.shareToken);
          if (linkInput) linkInput.value = url;
          if (linkSection) linkSection.style.display = "block";
          // Update share button dot indicator
          if (shareBtn) {
            let dot = shareBtn.querySelector(".docs-share-dot");
            if (!dot) {
              dot = document.createElement("span");
              dot.className = "docs-share-dot";
              shareBtn.appendChild(dot);
            }
          }
          showToast("Sharing enabled — link copied to clipboard", "success");
          this._copyShareLink();
        } else {
          showToast("Failed to enable sharing", "error");
          if (toggle) toggle.checked = false;
        }
      } else {
        const res = await API.delete(API_CONFIG.ENDPOINTS.DOC_SHARE(this.currentDoc._id));
        const data = await res.json();
        if (data.success) {
          this.currentDoc.isPublic = false;
          this.currentDoc.shareToken = null;
          if (linkInput) linkInput.value = "";
          if (linkSection) linkSection.style.display = "none";
          // Remove share button dot
          shareBtn?.querySelector(".docs-share-dot")?.remove();
          showToast("Share link revoked — access disabled immediately", "success");
        } else {
          showToast("Failed to revoke sharing", "error");
          if (toggle) toggle.checked = true;
        }
      }
    } finally {
      if (toggle) toggle.disabled = false;
    }
  }

  _copyShareLink() {
    const input = document.getElementById("docsShareLinkInput");
    const copyBtn = document.getElementById("docsShareCopyBtn");
    const url = input?.value;
    if (!url) return;

    navigator.clipboard.writeText(url).then(() => {
      if (copyBtn) {
        copyBtn.classList.add("copied");
        copyBtn.innerHTML = `<i class="bi bi-check-lg"></i> Copied!`;
        setTimeout(() => {
          copyBtn.classList.remove("copied");
          copyBtn.innerHTML = `<i class="bi bi-clipboard"></i> Copy`;
        }, 2000);
      }
    }).catch(() => {
      // Fallback for browsers without clipboard API
      input?.select();
      document.execCommand("copy");
    });
  }

  // ─── Called when section becomes active ───────────────────────────────────

  refresh() {
    const container = document.getElementById("docs-container");
    if (!container) {
      this._renderContainer();
    } else {
      // If in list view, reload docs
      const listView = document.getElementById("docs-list-view");
      if (listView && listView.style.display !== "none") {
        this._loadDocs();
      }
    }
  }
}

// Register global instance
const docsManagement = new DocsManagement();
window.docsManagement = docsManagement;
