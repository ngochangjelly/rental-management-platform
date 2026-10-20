/**
 * Report Image Export
 *
 * Shared plumbing for "export as PNG" reports: embedding fonts/images into an
 * SVG, rasterising it, copying to clipboard and showing a preview modal.
 * Mirrors the financial report export (financial-reports.js) so every exported
 * image looks and behaves the same.
 */

/** "⌘" on Apple platforms, "Ctrl+" elsewhere — for hotkey labels */
export function getModifierLabel() {
  const isMac =
    /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent) ||
    navigator.userAgentData?.platform === "macOS";
  return isMac ? "⌘" : "Ctrl+";
}

export function svgEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Fetch a URL as a data: URI, or null on failure */
export async function fetchAsDataUri(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** { url: dataUri } for every URL that loaded */
export async function fetchImagesAsDataUris(urls) {
  const unique = [...new Set(urls.filter(Boolean))];
  const results = await Promise.all(unique.map(fetchAsDataUri));
  return Object.fromEntries(unique.map((url, i) => [url, results[i]]).filter(([, uri]) => uri));
}

/**
 * Brand assets every report embeds: Noto Serif @font-face (canvas rendering
 * can't use page fonts) and the logo.
 */
export async function loadReportAssets() {
  const [fontRegular, fontBold, logo] = await Promise.all([
    fetchAsDataUri("/fonts/NotoSerif-Regular.ttf"),
    fetchAsDataUri("/fonts/NotoSerif-Bold.ttf"),
    fetchAsDataUri("/logo.png"),
  ]);
  const fontFaceStyle =
    fontRegular || fontBold
      ? `<style>
      @font-face { font-family: 'Noto Serif'; font-weight: 400; src: url('${fontRegular}') format('truetype'); }
      @font-face { font-family: 'Noto Serif'; font-weight: 700; src: url('${fontBold}') format('truetype'); }
    </style>`
      : "";
  return { fontFaceStyle, logo };
}

/**
 * SVG string → PNG Blob at 3× scale, capped by a pixel budget so very tall
 * reports still rasterise on mobile browsers.
 */
export function svgToPngBlob(svgString) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const TARGET_SCALE = 3;
      const MAX_CANVAS_PIXELS = 24_000_000;
      const scale = Math.min(TARGET_SCALE, Math.sqrt(MAX_CANVAS_PIXELS / (img.naturalWidth * img.naturalHeight)));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to render SVG"));
    };
    img.src = url;
  });
}

/** Best-effort copy of a PNG to the clipboard; resolves true on success */
export async function copyImageToClipboard(blob) {
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

/** Copy text, falling back to execCommand where the Clipboard API is blocked */
export async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

/** Preview modal with a download link; cleans itself up on close */
export function showImagePreviewModal(blob, { title, subtitle = "", fileName }) {
  const objectUrl = URL.createObjectURL(blob);
  const modalId = "reportImagePreviewModal";
  document.getElementById(modalId)?.remove();

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content" style="border-radius:16px;overflow:hidden;">
          <div class="modal-header border-0 pb-0" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);">
            <div class="d-flex align-items-center gap-2">
              <div class="rounded-circle bg-white d-flex align-items-center justify-content-center" style="width:32px;height:32px;flex-shrink:0;">
                <i class="bi bi-image text-primary" style="font-size:1rem;"></i>
              </div>
              <h6 class="modal-title text-white fw-bold mb-0">
                ${svgEscape(title)}
                ${subtitle ? `<small class="fw-normal opacity-75 ms-2" style="font-size:0.75rem;">${svgEscape(subtitle)}</small>` : ""}
              </h6>
            </div>
            <button type="button" class="btn-close btn-close-white ms-auto" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-0 text-center bg-dark" style="min-height:200px;">
            <img src="${objectUrl}" alt="${svgEscape(title)}" style="max-width:100%;display:block;margin:0 auto;" />
          </div>
          <div class="modal-footer border-0 justify-content-between" style="background:#f8f9fa;">
            <div class="text-muted" style="font-size:0.78rem;"><i class="bi bi-keyboard me-1"></i>Press <kbd>Esc</kbd> to close</div>
            <div class="d-flex gap-2">
              <a href="${objectUrl}" download="${svgEscape(fileName)}" class="btn btn-primary btn-sm">
                <i class="bi bi-download me-1"></i>Download PNG
              </a>
              <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">
                <i class="bi bi-x-lg me-1"></i>Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`
  );

  const modalEl = document.getElementById(modalId);
  const modal = new bootstrap.Modal(modalEl, { backdrop: true, keyboard: true });
  // Dynamically created modals can miss Bootstrap's keyboard trap
  const onKeyDown = (e) => {
    if (e.key === "Escape") modal.hide();
  };
  document.addEventListener("keydown", onKeyDown);
  modalEl.addEventListener(
    "hidden.bs.modal",
    () => {
      document.removeEventListener("keydown", onKeyDown);
      URL.revokeObjectURL(objectUrl);
      modalEl.remove();
    },
    { once: true }
  );
  modal.show();
}
