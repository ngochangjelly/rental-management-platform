/**
 * Live signature drawing pad on a <canvas> (same idea as the public
 * create-contract page's pad, reusable from the dashboard).
 *
 * - Pointer Events cover mouse, touch and stylus. The pointer is captured
 *   for the whole stroke, so a finger sliding off the edge doesn't cut the
 *   line short; a second finger is ignored while one is drawing.
 * - Strokes are smoothed (quadratic curves through segment midpoints) and a
 *   tap leaves a dot, so "i" dots and full stops show up.
 * - The canvas keeps a fixed internal resolution — only its CSS size
 *   changes — so ink survives the pad being hidden or resized. Give it a CSS
 *   aspect-ratio matching width/height so strokes aren't stretched. The pen
 *   width is set per stroke from the on-screen size, so it looks the same on
 *   a phone and a desktop.
 * - The canvas needs `touch-action: none` in CSS so drawing doesn't scroll
 *   the page on touch screens.
 */
export class SignaturePad {
  constructor(canvas, { penWidth = 2.5, color = "#111111", onBegin, onEnd } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.penWidth = penWidth; // in CSS pixels
    this.color = color;
    this.onBegin = onBegin;
    this.onEnd = onEnd;
    this._pointerId = null;
    this._last = null;
    this._lastMid = null;
    this._lineWidth = penWidth;
    this._bounds = null; // ink bounding box in canvas pixels
    this._bindEvents();
  }

  isEmpty() {
    return !this._bounds;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._bounds = null;
    this._pointerId = null;
    this._last = null;
    this._lastMid = null;
  }

  _bindEvents() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => this._start(e));
    c.addEventListener("pointermove", (e) => this._move(e));
    c.addEventListener("pointerup", (e) => this._end(e));
    c.addEventListener("pointercancel", (e) => this._end(e));
    c.addEventListener("lostpointercapture", (e) => this._end(e));
  }

  _point(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (e.clientY - rect.top) * (this.canvas.height / rect.height),
    };
  }

  _grow(p) {
    const r = this._lineWidth;
    const b = this._bounds;
    if (!b) {
      this._bounds = { minX: p.x - r, minY: p.y - r, maxX: p.x + r, maxY: p.y + r };
      return;
    }
    b.minX = Math.min(b.minX, p.x - r);
    b.minY = Math.min(b.minY, p.y - r);
    b.maxX = Math.max(b.maxX, p.x + r);
    b.maxY = Math.max(b.maxY, p.y + r);
  }

  _start(e) {
    if (this._pointerId !== null) {
      if (e.pointerId !== this._pointerId) return; // a second finger — ignore
      // Same pointer pressing again: its previous release was missed (e.g.
      // released outside the pad without capture), so close that stroke.
      this._end(e);
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    e.preventDefault();
    this._pointerId = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety — drawing works without it */
    }

    this._lineWidth = this.penWidth * (this.canvas.width / rect.width);
    const ctx = this.ctx;
    ctx.strokeStyle = this.color;
    ctx.fillStyle = this.color;
    ctx.lineWidth = this._lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const p = this._point(e);
    this._last = p;
    this._lastMid = p;
    ctx.beginPath();
    ctx.arc(p.x, p.y, this._lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    this._grow(p);
    this.onBegin?.();
  }

  _move(e) {
    if (e.pointerId !== this._pointerId) return;
    e.preventDefault();
    // Coalesced events give every sample the browser saw since the last
    // frame — smoother curves on fast strokes.
    const events = e.getCoalescedEvents?.() || [];
    for (const ev of events.length ? events : [e]) {
      const p = this._point(ev);
      const mid = { x: (this._last.x + p.x) / 2, y: (this._last.y + p.y) / 2 };
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.moveTo(this._lastMid.x, this._lastMid.y);
      ctx.quadraticCurveTo(this._last.x, this._last.y, mid.x, mid.y);
      ctx.stroke();
      this._grow(p);
      this._last = p;
      this._lastMid = mid;
    }
  }

  _end(e) {
    if (e.pointerId !== this._pointerId) return;
    this._pointerId = null;
    if (this._last && this._lastMid) {
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.moveTo(this._lastMid.x, this._lastMid.y);
      ctx.lineTo(this._last.x, this._last.y);
      ctx.stroke();
    }
    this._last = null;
    this._lastMid = null;
    this.onEnd?.();
  }

  /**
   * Exports the ink cropped to its bounding box (plus a margin), centred on
   * a solid background at a fixed aspect ratio. A fixed ratio matters
   * because contract PDFs stretch the signature into a 60×20 (3:1) box, and
   * a solid background because uploads are served as JPEG, which has no
   * transparency. Resolves null when nothing is drawn.
   */
  toBlob({
    aspect = 3,
    height = 300,
    margin = 0.08,
    background = "#ffffff",
    type = "image/png",
  } = {}) {
    if (!this._bounds) return Promise.resolve(null);
    // Strokes can run past the edge (pointer capture) — only the part on the
    // canvas actually holds ink.
    const b = {
      minX: Math.max(0, this._bounds.minX),
      minY: Math.max(0, this._bounds.minY),
      maxX: Math.min(this.canvas.width, this._bounds.maxX),
      maxY: Math.min(this.canvas.height, this._bounds.maxY),
    };
    const inkW = Math.max(b.maxX - b.minX, 1);
    const inkH = Math.max(b.maxY - b.minY, 1);
    let boxW = inkW * (1 + 2 * margin);
    let boxH = inkH * (1 + 2 * margin);
    // Widen or heighten the crop (never squash the ink) to hit the ratio
    if (boxW / boxH > aspect) boxH = boxW / aspect;
    else boxW = boxH * aspect;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;

    const out = document.createElement("canvas");
    out.width = Math.round(height * aspect);
    out.height = height;
    const ctx = out.getContext("2d");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // Draw the whole pad scaled + offset so the crop box fills the output —
    // avoids source rects that fall outside the canvas.
    const scale = out.width / boxW;
    ctx.drawImage(
      this.canvas,
      (boxW / 2 - cx) * scale,
      (boxH / 2 - cy) * scale,
      this.canvas.width * scale,
      this.canvas.height * scale,
    );
    return new Promise((resolve) => out.toBlob(resolve, type));
  }
}
