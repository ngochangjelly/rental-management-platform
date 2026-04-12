/**
 * CCTV Management Component
 * Live monitoring grid for Tapo TC71 (and other RTSP) cameras.
 * Uses HLS.js for browser playback of RTSP streams transcoded by the backend.
 */
class CctvManagementComponent {
  constructor() {
    this.cameras = [];
    this.hlsPlayers = {}; // cameraId → Hls instance
    this.editingId = null;
    this.properties = [];
    this.hlsLib = null; // loaded lazily
    this._container = null;
    this.init();
  }

  // ─── Bootstrap ─────────────────────────────────────────────────────────────

  init() {
    this._container = document.getElementById("cctv-container");
    if (!this._container) return;
    this._loadHls().then(() => this.loadCameras());
  }

  async _loadHls() {
    if (window.Hls) {
      this.hlsLib = window.Hls;
      return;
    }
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js";
      s.onload = () => {
        this.hlsLib = window.Hls;
        resolve();
      };
      s.onerror = () => resolve(); // graceful degradation
      document.head.appendChild(s);
    });
  }

  // ─── Data ──────────────────────────────────────────────────────────────────

  async loadCameras() {
    this._render(this._loadingHtml());
    try {
      const [camRes, propRes] = await Promise.all([
        API.get(API_CONFIG.ENDPOINTS.CCTV_CAMERAS),
        API.get(API_CONFIG.ENDPOINTS.PROPERTIES),
      ]);

      const camData = await camRes.json();
      const propData = await propRes.json();

      this.cameras = camData.success ? camData.cameras : [];
      this.properties = propData.success ? propData.properties : [];

      this._render(this._mainHtml());
      this._attachEvents();
    } catch (err) {
      this._render(this._errorHtml(err.message));
    }
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  _render(html) {
    if (this._container) this._container.innerHTML = html;
  }

  _loadingHtml() {
    return `<div class="text-center py-5 text-muted">
      <div class="spinner-border text-primary mb-3" role="status"></div>
      <p>Loading cameras…</p>
    </div>`;
  }

  _errorHtml(msg) {
    return `<div class="alert alert-danger m-3">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>Failed to load cameras: ${msg}
    </div>`;
  }

  _mainHtml() {
    const online = this.cameras.filter((c) => c.status === "online").length;
    const streaming = this.cameras.filter((c) => c.streaming).length;

    return `
    <div class="cctv-module">

      <!-- Header -->
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div class="d-flex align-items-center gap-3">
          <h5 class="mb-0 fw-bold">
            <i class="bi bi-camera-video-fill me-2 text-primary"></i>CCTV Monitor
          </h5>
          <span class="badge bg-primary">${this.cameras.length} camera${this.cameras.length !== 1 ? "s" : ""}</span>
          ${online > 0 ? `<span class="badge bg-success">${online} online</span>` : ""}
          ${streaming > 0 ? `<span class="badge bg-danger cctv-pulse">${streaming} streaming</span>` : ""}
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-secondary btn-sm" id="cctvRefreshBtn">
            <i class="bi bi-arrow-clockwise me-1"></i>Refresh
          </button>
          <button class="btn btn-primary btn-sm" id="cctvAddBtn">
            <i class="bi bi-plus-circle me-1"></i>Add Camera
          </button>
        </div>
      </div>

      <!-- go2rtc status bar -->
      <div id="cctvGo2rtcBar"></div>

      <!-- Camera grid -->
      ${
        this.cameras.length === 0
          ? this._emptyCamerasHtml()
          : `<div class="cctv-grid" id="cctvGrid">
              ${this.cameras.map((c) => this._cameraCardHtml(c)).join("")}
            </div>`
      }

      <!-- Add / Edit Modal -->
      ${this._modalHtml()}
    </div>

    <style>
      .cctv-module { padding: 0 0 2rem; }
      .cctv-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 1rem;
      }
      @media (max-width: 576px) {
        .cctv-grid { grid-template-columns: 1fr; }
      }
      .cctv-card {
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,.08);
        background: #fff;
        border: 1px solid #e9ecef;
        transition: box-shadow .2s;
      }
      .cctv-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.13); }
      .cctv-video-wrap {
        position: relative;
        background: #111;
        aspect-ratio: 16/9;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .cctv-video-wrap video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .cctv-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #666;
        gap: .5rem;
        width: 100%;
        height: 100%;
        font-size: .85rem;
      }
      .cctv-placeholder i { font-size: 2.5rem; color: #555; }
      .cctv-snapshot-preview {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .cctv-status-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        display: inline-block;
        margin-right: 4px;
      }
      .cctv-status-online { background: #22c55e; }
      .cctv-status-offline { background: #ef4444; }
      .cctv-status-unknown { background: #94a3b8; }
      .cctv-status-streaming { background: #f97316; }
      .cctv-pulse { animation: cctvPulse 1.5s ease-in-out infinite; }
      @keyframes cctvPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: .5; }
      }
      .cctv-card-body { padding: .75rem 1rem; }
      .cctv-card-actions { display: flex; gap: .4rem; flex-wrap: wrap; margin-top: .5rem; }
      .cctv-card-actions .btn { font-size: .75rem; padding: .25rem .55rem; }
      .cctv-stream-overlay {
        position: absolute;
        top: 6px; left: 6px;
        background: rgba(239,68,68,.9);
        color: #fff;
        font-size: .65rem;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        letter-spacing: .05em;
      }
      .cctv-live-badge {
        position: absolute; top: 6px; left: 6px;
      }
    </style>`;
  }

  _emptyCamerasHtml() {
    return `<div class="text-center py-5 text-muted">
      <i class="bi bi-camera-video-off" style="font-size:3rem;color:#adb5bd"></i>
      <p class="mt-3 mb-1 fw-semibold">No cameras registered</p>
      <p class="small">Add your first Tapo TC71 camera to start monitoring.</p>
      <button class="btn btn-primary btn-sm mt-2" onclick="window.cctvManager._openAddModal()">
        <i class="bi bi-plus-circle me-1"></i>Add Camera
      </button>
    </div>`;
  }

  _statusBadge(camera) {
    if (camera.streaming) {
      return `<span class="cctv-status-dot cctv-status-streaming"></span>Streaming`;
    }
    if (camera.status === "online") {
      return `<span class="cctv-status-dot cctv-status-online"></span>Online`;
    }
    if (camera.status === "offline") {
      return `<span class="cctv-status-dot cctv-status-offline"></span>Offline`;
    }
    return `<span class="cctv-status-dot cctv-status-unknown"></span>Unknown`;
  }

  _cameraCardHtml(camera) {
    const id = camera._id;
    const isStreaming = camera.streaming;
    const isProxy = camera.isProxy;
    const noProxy = !isProxy && !camera.proxyBaseUrl;

    // Show setup needed badge if not on same network and no proxy configured
    const setupNeeded = noProxy;

    return `<div class="cctv-card" id="cctv-card-${id}">
      <div class="cctv-video-wrap" id="cctv-video-wrap-${id}">
        ${
          isStreaming
            ? `<span class="cctv-stream-overlay cctv-pulse">● LIVE</span>
               <video id="cctv-video-${id}" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover"></video>`
            : setupNeeded
            ? `<div class="cctv-placeholder" style="padding:1rem;text-align:center">
                 <i class="bi bi-router" style="font-size:2rem;color:#f59e0b"></i>
                 <span class="mt-2" style="font-size:.8rem;color:#f59e0b;font-weight:600">Remote setup needed</span>
                 <span style="font-size:.72rem;color:#9ca3af;margin-top:4px">Add go2rtc proxy URL to stream remotely</span>
               </div>`
            : `<div class="cctv-placeholder">
                 <i class="bi bi-camera-video-off"></i>
                 <span>Stream off</span>
               </div>`
        }
      </div>
      <div class="cctv-card-body">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="fw-semibold">${this._esc(camera.name)}</div>
            <div class="text-muted small">${this._esc(camera.location || camera.ip)}</div>
          </div>
          <div class="text-end small d-flex flex-column align-items-end gap-1">
            ${this._statusBadge(camera)}
            ${isProxy ? `<span style="font-size:.65rem;color:#6366f1;font-weight:600"><i class="bi bi-cloud-check me-1"></i>Remote</span>` : `<span style="font-size:.65rem;color:#94a3b8">Local only</span>`}
          </div>
        </div>
        ${camera.propertyName ? `<div class="text-muted small mt-1"><i class="bi bi-building me-1"></i>${this._esc(camera.propertyName)}</div>` : ""}
        <div class="cctv-card-actions mt-2">
          ${
            isStreaming
              ? `<button class="btn btn-outline-danger btn-sm" onclick="window.cctvManager.stopStream('${id}')">
                   <i class="bi bi-stop-circle me-1"></i>Stop
                 </button>`
              : `<button class="btn btn-success btn-sm" onclick="window.cctvManager.startStream('${id}')" ${setupNeeded ? 'title="Configure go2rtc proxy first"' : ""}>
                   <i class="bi bi-play-circle me-1"></i>Stream
                 </button>`
          }
          <button class="btn btn-outline-secondary btn-sm" onclick="window.cctvManager.takeSnapshot('${id}')" title="Snapshot">
            <i class="bi bi-camera"></i>
          </button>
          <button class="btn btn-outline-info btn-sm" onclick="window.cctvManager.testCamera('${id}')" title="Test Connection">
            <i class="bi bi-wifi"></i>
          </button>
          <button class="btn btn-outline-primary btn-sm" onclick="window.cctvManager._openEditModal('${id}')">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-outline-danger btn-sm" onclick="window.cctvManager.deleteCamera('${id}')">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    </div>`;
  }

  _modalHtml() {
    const propOptions = this.properties
      .map((p) => `<option value="${p._id}">${this._esc(p.propertyId)} – ${this._esc(p.address || "")}</option>`)
      .join("");

    return `
    <div class="modal fade" id="cctvCameraModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="cctvModalTitle">Add Camera</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="cctvCameraForm">
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Camera Name <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" id="cctvName" placeholder="e.g. Kitchen Cam" required />
                </div>
                <div class="col-md-4">
                  <label class="form-label fw-semibold">IP Address <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" id="cctvIp" placeholder="192.168.0.146" required />
                </div>
                <div class="col-md-2">
                  <label class="form-label fw-semibold">Port</label>
                  <input type="number" class="form-control" id="cctvPort" value="554" min="1" max="65535" />
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Camera Account Username <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" id="cctvUsername" placeholder="Camera account (not Tapo login)" required autocomplete="off" />
                  <div class="form-text">Create this in Tapo app → Advanced Settings → Camera Account</div>
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Camera Account Password <span class="text-danger">*</span></label>
                  <div class="input-group">
                    <input type="password" class="form-control" id="cctvPassword" placeholder="Min 6 characters" autocomplete="new-password" />
                    <button type="button" class="btn btn-outline-secondary" id="cctvTogglePwd">
                      <i class="bi bi-eye" id="cctvTogglePwdIcon"></i>
                    </button>
                  </div>
                  <div class="form-text" id="cctvPasswordHint">Required for new cameras. Leave blank to keep existing.</div>
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Stream Quality</label>
                  <select class="form-select" id="cctvStreamPath">
                    <option value="stream1">stream1 — High quality</option>
                    <option value="stream2">stream2 — Standard quality (lighter)</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Location</label>
                  <input type="text" class="form-control" id="cctvLocation" placeholder="e.g. Kitchen, Living Room, Front Door" />
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Property</label>
                  <select class="form-select" id="cctvPropertyId">
                    <option value="">— No property —</option>
                    ${propOptions}
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Model</label>
                  <input type="text" class="form-control" id="cctvModel" value="TC71" placeholder="TC71" />
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">MAC Address</label>
                  <input type="text" class="form-control" id="cctvMacAddress" placeholder="B8-FB-B3-28-E5-F5 (optional)" />
                </div>
                <div class="col-12">
                  <label class="form-label fw-semibold">Notes</label>
                  <textarea class="form-control" id="cctvNotes" rows="2" placeholder="Optional notes…"></textarea>
                </div>
              </div>

              <!-- Remote access (go2rtc proxy) -->
              <hr class="my-3" />
              <div class="mb-2 d-flex align-items-center gap-2">
                <span class="fw-semibold">Remote Access via go2rtc</span>
                <span class="badge bg-primary">For viewing away from house</span>
              </div>
              <div class="row g-3">
                <div class="col-md-7">
                  <label class="form-label fw-semibold">go2rtc Base URL</label>
                  <input type="text" class="form-control" id="cctvProxyBaseUrl"
                    placeholder="http://100.x.x.x:1984 (Tailscale) or https://cam.yourdomain.com" />
                  <div class="form-text">Leave blank if on same network as camera</div>
                </div>
                <div class="col-md-5">
                  <label class="form-label fw-semibold">go2rtc Stream Name</label>
                  <input type="text" class="form-control" id="cctvProxyStreamName"
                    placeholder="e.g. kitchen" />
                  <div class="form-text">Name defined in go2rtc.yaml</div>
                </div>
              </div>

              <div class="alert alert-secondary d-flex align-items-start gap-2 mt-3 mb-0" style="font-size:.8rem">
                <i class="bi bi-router flex-shrink-0 mt-1"></i>
                <div>
                  <strong>Remote setup:</strong> Install
                  <a href="https://github.com/AlexxIT/go2rtc" target="_blank">go2rtc</a> +
                  <a href="https://tailscale.com" target="_blank">Tailscale</a>
                  on a Raspberry Pi at the property. go2rtc pulls RTSP from the camera locally;
                  Tailscale gives your backend a private IP to reach it securely from anywhere.
                  <a href="#" onclick="window.cctvManager._showSetupGuide(); return false">View setup guide →</a>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary" id="cctvSaveBtn">Save Camera</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;
  }

  // ─── Events ────────────────────────────────────────────────────────────────

  _attachEvents() {
    document.getElementById("cctvAddBtn")?.addEventListener("click", () => this._openAddModal());
    document.getElementById("cctvRefreshBtn")?.addEventListener("click", () => {
      this._stopAllPlayers();
      this.loadCameras();
    });
    document.getElementById("cctvCameraForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      this._saveCamera();
    });
    document.getElementById("cctvTogglePwd")?.addEventListener("click", () => {
      const input = document.getElementById("cctvPassword");
      const icon = document.getElementById("cctvTogglePwdIcon");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      icon.className = show ? "bi bi-eye-slash" : "bi bi-eye";
    });

    // Wire up property select to update property name field
    document.getElementById("cctvPropertyId")?.addEventListener("change", (e) => {
      const prop = this.properties.find((p) => p._id === e.target.value);
      this._selectedPropertyName = prop ? `${prop.propertyId} – ${prop.address || ""}` : "";
    });

    // Restart any already-streaming cameras
    this.cameras.filter((c) => c.streaming).forEach((c) => {
      this._attachHlsPlayer(c._id);
    });

    // Load go2rtc status bar
    this._refreshGo2rtcBar();
  }

  // ─── go2rtc Panel ──────────────────────────────────────────────────────────

  async _refreshGo2rtcBar() {
    const bar = document.getElementById("cctvGo2rtcBar");
    if (!bar) return;

    try {
      const res = await API.get(API_CONFIG.ENDPOINTS.CCTV_GO2RTC_STATUS);
      const data = await res.json();

      const streamCount = data.streams ? Object.keys(data.streams).length : 0;
      const alive = data.alive;
      const running = data.running;

      bar.innerHTML = `
      <div class="card mb-3 border-0" style="background:${alive ? "#f0fdf4" : "#fff7ed"};border-left:4px solid ${alive ? "#22c55e" : "#f97316"} !important;border-radius:8px">
        <div class="card-body py-2 px-3">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div class="d-flex align-items-center gap-3">
              <div>
                <span class="fw-semibold" style="font-size:.9rem">
                  <i class="bi bi-router me-1" style="color:${alive ? "#22c55e" : "#f97316"}"></i>
                  go2rtc Stream Gateway
                </span>
                <span class="ms-2 badge ${alive ? "bg-success" : "bg-warning text-dark"}">${alive ? `Running · ${streamCount} stream${streamCount !== 1 ? "s" : ""}` : "Not running"}</span>
              </div>
              ${!alive ? `<span class="text-muted small">Start go2rtc to stream cameras remotely via your laptop</span>` : ""}
            </div>
            <div class="d-flex gap-2 flex-wrap">
              ${alive
                ? `<button class="btn btn-outline-warning btn-sm" onclick="window.cctvManager._go2rtcReload()"><i class="bi bi-arrow-repeat me-1"></i>Reload</button>
                   <button class="btn btn-outline-danger btn-sm" onclick="window.cctvManager._go2rtcStop()"><i class="bi bi-stop-fill me-1"></i>Stop</button>
                   <a class="btn btn-outline-secondary btn-sm" href="http://localhost:1984" target="_blank"><i class="bi bi-box-arrow-up-right me-1"></i>go2rtc UI</a>`
                : `<button class="btn btn-success btn-sm" onclick="window.cctvManager._go2rtcApplyAll()"><i class="bi bi-play-fill me-1"></i>Start + Apply All Cameras</button>`
              }
              <button class="btn btn-outline-primary btn-sm" onclick="window.cctvManager._showSetupGuide()"><i class="bi bi-info-circle me-1"></i>Setup Guide</button>
              <a class="btn btn-outline-secondary btn-sm" href="${buildApiUrl(API_CONFIG.ENDPOINTS.CCTV_GO2RTC_CONFIG)}" download="go2rtc.yaml"><i class="bi bi-download me-1"></i>Config</a>
            </div>
          </div>
        </div>
      </div>`;
    } catch {
      // go2rtc bar optional — don't break UI
      bar.innerHTML = "";
    }
  }

  async _go2rtcApplyAll() {
    const btn = document.querySelector("#cctvGo2rtcBar .btn-success");
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Starting…`; }

    try {
      const res = await API.post(API_CONFIG.ENDPOINTS.CCTV_GO2RTC_APPLY_ALL);
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      window.showToast?.(`go2rtc started — ${data.cameraCount} camera(s) configured`, "success");
      await this.loadCameras();
    } catch (err) {
      window.showToast?.(`go2rtc error: ${err.message}`, "danger");
      await this._refreshGo2rtcBar();
    }
  }

  async _go2rtcStop() {
    await API.post(API_CONFIG.ENDPOINTS.CCTV_GO2RTC_STOP);
    window.showToast?.("go2rtc stopped", "info");
    await this._refreshGo2rtcBar();
  }

  async _go2rtcReload() {
    const res = await API.post(API_CONFIG.ENDPOINTS.CCTV_GO2RTC_RELOAD);
    const data = await res.json();
    if (data.success) window.showToast?.("go2rtc reloaded with latest camera list", "success");
    else window.showToast?.(data.message, "danger");
    await this._refreshGo2rtcBar();
  }

  // ─── Modal ─────────────────────────────────────────────────────────────────

  _openAddModal() {
    this.editingId = null;
    const title = document.getElementById("cctvModalTitle");
    if (title) title.textContent = "Add Camera";

    const hint = document.getElementById("cctvPasswordHint");
    if (hint) hint.textContent = "Required for new cameras.";

    const pwdInput = document.getElementById("cctvPassword");
    if (pwdInput) pwdInput.required = true;

    document.getElementById("cctvCameraForm")?.reset();
    document.getElementById("cctvPort").value = "554";
    document.getElementById("cctvModel").value = "TC71";

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("cctvCameraModal"));
    modal.show();
  }

  _openEditModal(id) {
    const cam = this.cameras.find((c) => c._id === id);
    if (!cam) return;

    this.editingId = id;
    this._selectedPropertyName = cam.propertyName || "";

    const title = document.getElementById("cctvModalTitle");
    if (title) title.textContent = "Edit Camera";

    const hint = document.getElementById("cctvPasswordHint");
    if (hint) hint.textContent = "Leave blank to keep existing password.";

    const pwdInput = document.getElementById("cctvPassword");
    if (pwdInput) pwdInput.required = false;

    document.getElementById("cctvName").value = cam.name || "";
    document.getElementById("cctvIp").value = cam.ip || "";
    document.getElementById("cctvPort").value = cam.port || 554;
    document.getElementById("cctvUsername").value = cam.username || "";
    document.getElementById("cctvPassword").value = "";
    document.getElementById("cctvStreamPath").value = cam.streamPath || "stream1";
    document.getElementById("cctvLocation").value = cam.location || "";
    document.getElementById("cctvPropertyId").value = cam.propertyId || "";
    document.getElementById("cctvModel").value = cam.cameraModel || cam.model || "TC71";
    document.getElementById("cctvMacAddress").value = cam.macAddress || "";
    document.getElementById("cctvNotes").value = cam.notes || "";
    document.getElementById("cctvProxyBaseUrl").value = cam.proxyBaseUrl || "";
    document.getElementById("cctvProxyStreamName").value = cam.proxyStreamName || "";

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("cctvCameraModal"));
    modal.show();
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async _saveCamera() {
    const saveBtn = document.getElementById("cctvSaveBtn");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving…"; }

    const propertyId = document.getElementById("cctvPropertyId").value;
    const selectedProp = this.properties.find((p) => p._id === propertyId);

    const proxyBaseUrl = document.getElementById("cctvProxyBaseUrl").value.trim();
    const proxyStreamName = document.getElementById("cctvProxyStreamName").value.trim();

    const payload = {
      name: document.getElementById("cctvName").value.trim(),
      ip: document.getElementById("cctvIp").value.trim(),
      port: parseInt(document.getElementById("cctvPort").value) || 554,
      username: document.getElementById("cctvUsername").value.trim(),
      password: document.getElementById("cctvPassword").value,
      streamPath: document.getElementById("cctvStreamPath").value,
      location: document.getElementById("cctvLocation").value.trim(),
      propertyId: propertyId || undefined,
      propertyName: selectedProp ? `${selectedProp.propertyId}` : undefined,
      model: document.getElementById("cctvModel").value.trim() || "TC71",
      macAddress: document.getElementById("cctvMacAddress").value.trim(),
      notes: document.getElementById("cctvNotes").value.trim(),
      proxyBaseUrl: proxyBaseUrl || undefined,
      proxyStreamName: proxyStreamName || undefined,
    };

    try {
      let res;
      if (this.editingId) {
        res = await API.put(API_CONFIG.ENDPOINTS.CCTV_CAMERA_BY_ID(this.editingId), payload);
      } else {
        if (!payload.password) {
          window.showToast?.("Password is required for new cameras", "warning");
          return;
        }
        res = await API.post(API_CONFIG.ENDPOINTS.CCTV_CAMERAS, payload);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Save failed");

      bootstrap.Modal.getInstance(document.getElementById("cctvCameraModal"))?.hide();
      window.showToast?.("Camera saved successfully", "success");
      this._stopAllPlayers();
      await this.loadCameras();
    } catch (err) {
      window.showToast?.(`Error: ${err.message}`, "danger");
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save Camera"; }
    }
  }

  async deleteCamera(id) {
    const cam = this.cameras.find((c) => c._id === id);
    if (!cam) return;
    if (!confirm(`Delete camera "${cam.name}"? This cannot be undone.`)) return;

    try {
      const res = await API.delete(API_CONFIG.ENDPOINTS.CCTV_CAMERA_BY_ID(id));
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      this._destroyPlayer(id);
      window.showToast?.("Camera deleted", "success");
      await this.loadCameras();
    } catch (err) {
      window.showToast?.(`Delete failed: ${err.message}`, "danger");
    }
  }

  // ─── Streaming ─────────────────────────────────────────────────────────────

  async startStream(id) {
    const btn = document.querySelector(`#cctv-card-${id} .btn-success`);
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Starting…`; }

    try {
      const res = await API.post(API_CONFIG.ENDPOINTS.CCTV_STREAM_START(id));
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to start stream");

      // Rebuild the card with video element, then attach HLS
      const cam = this.cameras.find((c) => c._id === id);
      if (cam) cam.streaming = true;

      const wrap = document.getElementById(`cctv-video-wrap-${id}`);
      if (wrap) {
        wrap.innerHTML = `<span class="cctv-stream-overlay cctv-pulse">● LIVE</span>
          <video id="cctv-video-${id}" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover"></video>`;
      }

      // Update action buttons
      this._refreshCardActions(id, true);

      await this._attachHlsPlayer(id);
    } catch (err) {
      window.showToast?.(`Stream error: ${err.message}`, "danger");
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-play-circle me-1"></i>Stream`; }
    }
  }

  async stopStream(id) {
    this._destroyPlayer(id);

    try {
      await API.post(API_CONFIG.ENDPOINTS.CCTV_STREAM_STOP(id));
    } catch {}

    const cam = this.cameras.find((c) => c._id === id);
    if (cam) cam.streaming = false;

    const wrap = document.getElementById(`cctv-video-wrap-${id}`);
    if (wrap) {
      wrap.innerHTML = `<div class="cctv-placeholder">
        <i class="bi bi-camera-video-off"></i><span>Stream off</span>
      </div>`;
    }
    this._refreshCardActions(id, false);
    window.showToast?.("Stream stopped", "info");
  }

  _refreshCardActions(id, isStreaming) {
    const actionsEl = document.querySelector(`#cctv-card-${id} .cctv-card-actions`);
    if (!actionsEl) return;

    const cam = this.cameras.find((c) => c._id === id);
    const streamBtn = isStreaming
      ? `<button class="btn btn-outline-danger btn-sm" onclick="window.cctvManager.stopStream('${id}')">
           <i class="bi bi-stop-circle me-1"></i>Stop
         </button>`
      : `<button class="btn btn-success btn-sm" onclick="window.cctvManager.startStream('${id}')">
           <i class="bi bi-play-circle me-1"></i>Stream
         </button>`;

    actionsEl.innerHTML = `
      ${streamBtn}
      <button class="btn btn-outline-secondary btn-sm" onclick="window.cctvManager.takeSnapshot('${id}')" title="Snapshot">
        <i class="bi bi-camera"></i>
      </button>
      <button class="btn btn-outline-info btn-sm" onclick="window.cctvManager.testCamera('${id}')" title="Test Connection">
        <i class="bi bi-wifi"></i>
      </button>
      <button class="btn btn-outline-primary btn-sm" onclick="window.cctvManager._openEditModal('${id}')">
        <i class="bi bi-pencil"></i>
      </button>
      <button class="btn btn-outline-danger btn-sm" onclick="window.cctvManager.deleteCamera('${id}')">
        <i class="bi bi-trash"></i>
      </button>`;
  }

  async _attachHlsPlayer(cameraId) {
    const videoEl = document.getElementById(`cctv-video-${cameraId}`);
    if (!videoEl) return;

    const streamUrl = buildApiUrl(API_CONFIG.ENDPOINTS.CCTV_HLS(cameraId));
    const token = getAuthToken();

    if (this.hlsLib && this.hlsLib.isSupported()) {
      const hls = new this.hlsLib({
        xhrSetup: (xhr) => {
          if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        },
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 5,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(videoEl);

      hls.on(this.hlsLib.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error(`[CCTV] HLS fatal error for ${cameraId}:`, data);
        }
      });

      this.hlsPlayers[cameraId] = hls;
    } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS — can't pass auth header easily, but try
      videoEl.src = streamUrl;
    }
  }

  _destroyPlayer(id) {
    const hls = this.hlsPlayers[id];
    if (hls) {
      try { hls.destroy(); } catch {}
      delete this.hlsPlayers[id];
    }
    const videoEl = document.getElementById(`cctv-video-${id}`);
    if (videoEl) {
      videoEl.pause();
      videoEl.src = "";
    }
  }

  _stopAllPlayers() {
    Object.keys(this.hlsPlayers).forEach((id) => this._destroyPlayer(id));
  }

  // ─── Camera Actions ────────────────────────────────────────────────────────

  async testCamera(id) {
    const btn = document.querySelector(`#cctv-card-${id} .btn-outline-info`);
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`; }

    try {
      const res = await API.post(API_CONFIG.ENDPOINTS.CCTV_CAMERA_TEST(id));
      const data = await res.json();

      const cam = this.cameras.find((c) => c._id === id);
      if (cam) cam.status = data.online ? "online" : "offline";

      // Update status display
      const statusEl = document.querySelector(`#cctv-card-${id} .text-end.small`);
      if (statusEl) statusEl.innerHTML = this._statusBadge(cam);

      window.showToast?.(
        data.online ? "Camera is online and reachable" : "Camera is offline or unreachable",
        data.online ? "success" : "warning"
      );
    } catch (err) {
      window.showToast?.(`Test failed: ${err.message}`, "danger");
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-wifi"></i>`; }
    }
  }

  async takeSnapshot(id) {
    const btn = document.querySelector(`#cctv-card-${id} .btn-outline-secondary`);
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`; }

    try {
      const snapshotUrl = buildApiUrl(API_CONFIG.ENDPOINTS.CCTV_CAMERA_SNAPSHOT(id));
      const token = getAuthToken();

      const res = await fetch(snapshotUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Show snapshot in a new tab
      const a = document.createElement("a");
      a.href = url;
      a.download = `snapshot-${id}-${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);

      window.showToast?.("Snapshot downloaded", "success");
    } catch (err) {
      window.showToast?.(`Snapshot failed: ${err.message}`, "danger");
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-camera"></i>`; }
    }
  }

  // ─── Setup Guide ───────────────────────────────────────────────────────────

  _showSetupGuide() {
    const html = `
    <div class="modal fade" id="cctvSetupGuideModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-router me-2"></i>Remote CCTV Setup Guide</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="font-size:.9rem">

            <div class="alert alert-primary mb-4">
              <strong>Goal:</strong> View cameras at your rental houses from anywhere — no port forwarding, no public IP needed.
            </div>

            <h6 class="fw-bold">What you need per property</h6>
            <ul>
              <li>A small always-on device: <strong>Raspberry Pi Zero 2W (~$15)</strong>, old laptop, or NAS</li>
              <li>Connected to the same Wi-Fi as the cameras</li>
            </ul>

            <hr/>
            <h6 class="fw-bold">Step 1 — Install Tailscale on the Pi</h6>
            <pre class="bg-dark text-light p-3 rounded" style="font-size:.8rem">curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up</pre>
            <p>Also install Tailscale on your backend server. They'll get private IPs like <code>100.x.x.x</code>.</p>

            <hr/>
            <h6 class="fw-bold">Step 2 — Install go2rtc on the Pi</h6>
            <pre class="bg-dark text-light p-3 rounded" style="font-size:.8rem">wget https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_linux_arm64
chmod +x go2rtc_linux_arm64
sudo mv go2rtc_linux_arm64 /usr/local/bin/go2rtc</pre>

            <hr/>
            <h6 class="fw-bold">Step 3 — Configure go2rtc</h6>
            <p>Create <code>/etc/go2rtc.yaml</code>:</p>
            <pre class="bg-dark text-light p-3 rounded" style="font-size:.8rem">streams:
  kitchen:
    - rtsp://043007414commonwealth:043007414commonwealth@192.168.0.146:554/stream1
  living_room:
    - rtsp://USERNAME:PASSWORD@CAMERA_IP:554/stream1

api:
  listen: ":1984"</pre>

            <hr/>
            <h6 class="fw-bold">Step 4 — Run go2rtc as a service</h6>
            <pre class="bg-dark text-light p-3 rounded" style="font-size:.8rem">sudo tee /etc/systemd/system/go2rtc.service &lt;&lt;EOF
[Unit]
Description=go2rtc
After=network.target

[Service]
ExecStart=/usr/local/bin/go2rtc --config /etc/go2rtc.yaml
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now go2rtc</pre>

            <hr/>
            <h6 class="fw-bold">Step 5 — Add proxy URL to camera in dashboard</h6>
            <p>Edit the camera → set:</p>
            <ul>
              <li><strong>go2rtc Base URL:</strong> <code>http://100.x.x.x:1984</code> (Pi's Tailscale IP)</li>
              <li><strong>go2rtc Stream Name:</strong> <code>kitchen</code> (matches go2rtc.yaml key)</li>
            </ul>

            <div class="alert alert-success mt-3 mb-0">
              Done! The backend fetches video from go2rtc via Tailscale and relays it to your browser — works from anywhere in the world.
            </div>

            <hr/>
            <h6 class="fw-bold text-warning">No Raspberry Pi? Use your router's built-in VPN instead</h6>
            <p>Most TP-Link routers have a free built-in VPN — no extra hardware needed.</p>

            <div class="mb-2 fw-semibold">Step 1 — Enable VPN on each property's TP-Link router</div>
            <ol style="font-size:.85rem">
              <li>Login to router admin: <code>http://192.168.0.1</code> (or tplinkwifi.net)</li>
              <li>Go to <strong>Advanced → VPN Server → OpenVPN</strong> (or WireGuard on newer models)</li>
              <li>Enable → Export client config file (.ovpn)</li>
              <li>Set router DDNS: <strong>Advanced → Network → Dynamic DNS</strong> → register a free <code>yourhome.tplinkdns.com</code></li>
            </ol>

            <div class="mb-2 fw-semibold">Step 2 — Connect your laptop to each VPN</div>
            <pre class="bg-dark text-light p-2 rounded" style="font-size:.8rem"># macOS — install Tunnelblick then import each .ovpn file
brew install --cask tunnelblick

# Connect to all property VPNs simultaneously (split tunneling works fine)</pre>

            <div class="mb-2 fw-semibold">Step 3 — Download + run go2rtc on your laptop</div>
            <pre class="bg-dark text-light p-2 rounded" style="font-size:.8rem"># macOS Apple Silicon
curl -L https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_mac_arm64 -o go2rtc
chmod +x go2rtc

# Download the config from your dashboard, then:
./go2rtc --config ~/go2rtc.yaml</pre>

            <div class="mb-2 fw-semibold">Step 4 — In CCTV Monitor dashboard</div>
            <p style="font-size:.85rem">Click <strong>"Start + Apply All Cameras"</strong> — this auto-configures all cameras to use go2rtc on your laptop and starts streaming.</p>

            <div class="alert alert-success mb-0">
              <strong>Result:</strong> Your laptop connects to all property VPNs → go2rtc pulls RTSP locally over VPN → backend serves HLS to your browser → view all cameras from anywhere.
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>`;

    // Remove existing guide modal if present
    document.getElementById("cctvSetupGuideModal")?.remove();
    document.body.insertAdjacentHTML("beforeend", html);
    bootstrap.Modal.getOrCreateInstance(document.getElementById("cctvSetupGuideModal")).show();
  }

  // ─── Utils ─────────────────────────────────────────────────────────────────

  _esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

// Auto-initialise
window.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("cctv-container")) {
    window.cctvManager = new CctvManagementComponent();
  }
});
