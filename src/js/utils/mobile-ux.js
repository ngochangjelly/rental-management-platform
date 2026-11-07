/**
 * Phone-only helpers shared by the Properties and Tenants screens.
 *
 * - isMobileViewport(): same breakpoint as the CSS (<768px).
 * - mobileLayers: full-screen views (detail panels, the tenant modal, action
 *   sheets) that the phone's back button / swipe-back should close, instead
 *   of leaving the section. Each open layer adds one browser history entry.
 * - createSectionNav(): sticky row of chips that jumps between sections of a
 *   long form and highlights the section currently on screen.
 * - openActionSheet(): bottom sheet menu for secondary actions.
 * - trackUserEdits(): notices real user edits, for "discard changes?" prompts.
 * - applyMobileInputHints(): numeric keypads for number fields.
 *
 * Everything here is a no-op or invisible on desktop.
 */

import i18next, { onLanguageChange } from "../i18n.js";

const MOBILE_QUERY = "(max-width: 767.98px)";

export function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;
}

// ─── Back-gesture aware layers ───────────────────────────────────────────────

class MobileLayerStack {
  constructor() {
    this.stack = []; // [{ name, onBack }]
    this._ignorePopUntil = 0;
    this._pendingBack = null; // resolves once our own history.back() has landed
    window.addEventListener("popstate", (e) => this._onPopState(e));
    window.matchMedia(MOBILE_QUERY).addEventListener?.("change", () => this._syncBodyLock());
  }

  /**
   * Registers `name` as open. On phones, also adds a history entry so the
   * back gesture closes it. `onBack` runs when the user goes back; return
   * false from it to keep the layer open (e.g. they cancelled "discard
   * changes?").
   */
  open(name, onBack) {
    const existing = this.stack.find((l) => l.name === name);
    if (existing) {
      existing.onBack = onBack;
      return;
    }
    this.stack.push({ name, onBack });
    if (isMobileViewport() && history.state?.mobileLayer !== name) {
      history.pushState({ mobileLayer: name }, "", window.location.href);
    }
    this._syncBodyLock();
  }

  /**
   * Call when the UI closed the layer itself (back arrow, Cancel, Save...).
   * Removes its history entry without letting the router react to it.
   * Resolves once the history entry is gone, so a follow-up pushState (e.g.
   * opening the next screen) can't race with it.
   */
  close(name) {
    const idx = this.stack.findIndex((l) => l.name === name);
    if (idx === -1) return Promise.resolve();
    this.stack.splice(idx, 1);
    this._syncBodyLock();
    if (history.state?.mobileLayer !== name) return Promise.resolve();

    this._ignorePopUntil = Date.now() + 1000;
    window.appRouter?.suppressRouting?.();
    return new Promise((resolve) => {
      this._pendingBack = resolve;
      setTimeout(() => this._resolvePendingBack(), 400); // safety net
      history.back();
    });
  }

  _resolvePendingBack() {
    const resolve = this._pendingBack;
    this._pendingBack = null;
    resolve?.();
  }

  _onPopState(e) {
    if (Date.now() < this._ignorePopUntil) {
      this._ignorePopUntil = 0;
      this._resolvePendingBack();
      return;
    }
    if (this.stack.length === 0) return;

    const target = e.state?.mobileLayer || null;
    let closedAny = false;
    while (this.stack.length && this.stack[this.stack.length - 1].name !== target) {
      const top = this.stack[this.stack.length - 1];
      if (top.onBack && top.onBack() === false) {
        // Vetoed: put the history entry back so the next back still works.
        history.pushState({ mobileLayer: top.name }, "", window.location.href);
        break;
      }
      // onBack may already have removed it (via close()); don't pop a second layer.
      const i = this.stack.indexOf(top);
      if (i !== -1) this.stack.splice(i, 1);
      closedAny = true;
    }
    // The URL of the entry we landed on may differ (selection changes rewrite
    // the current entry); the screen already handled the back, so keep the
    // router from re-opening whatever that URL points at.
    if (closedAny) window.appRouter?.suppressRouting?.();
    this._syncBodyLock();
  }

  _syncBodyLock() {
    document.body.classList.toggle("m-layer-open", this.stack.length > 0 && isMobileViewport());
  }
}

export const mobileLayers = typeof window !== "undefined" ? new MobileLayerStack() : null;

// ─── Section chip navigation ─────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {HTMLElement} opts.mount      element the chip bar is inserted before
 * @param {HTMLElement} opts.scrollEl   the scrolling container holding the sections
 * @param {HTMLElement} opts.root       where to look for [data-msec] sections
 *   (data-msec="Label|bi-icon"; add data-msec-i18n="key" to translate the label)
 * @returns {{ refresh(): void, reset(): void }}
 */
export function createSectionNav({ mount, scrollEl, root }) {
  const bar = document.createElement("div");
  bar.className = "m-secnav";
  bar.setAttribute("role", "tablist");
  mount.parentNode.insertBefore(bar, mount);

  let sections = [];
  let chips = [];
  let activeIdx = -1;
  let lockUntil = 0;
  let ticking = false;

  const build = () => {
    sections = Array.from(root.querySelectorAll("[data-msec]"));
    bar.innerHTML = sections
      .map((el, i) => {
        const [fallbackLabel, icon] = el.dataset.msec.split("|");
        const label = el.dataset.msecI18n ? i18next.t(el.dataset.msecI18n) : fallbackLabel;
        return `<button type="button" class="m-secnav-chip" data-idx="${i}">${icon ? `<i class="bi ${icon}"></i>` : ""}<span>${label}</span></button>`;
      })
      .join("");
    chips = Array.from(bar.querySelectorAll(".m-secnav-chip"));
    activeIdx = -1;
  };

  const visible = (el) => el.offsetParent !== null;

  const setActive = (idx) => {
    if (idx === activeIdx || !chips[idx]) return;
    chips[activeIdx]?.classList.remove("active");
    activeIdx = idx;
    const chip = chips[idx];
    chip.classList.add("active");
    const left = chip.offsetLeft - bar.clientWidth / 2 + chip.offsetWidth / 2;
    bar.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  };

  const offsetOf = (el) =>
    el.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;

  const spy = () => {
    ticking = false;
    if (Date.now() < lockUntil) return;
    const y = scrollEl.scrollTop + 24;
    let idx = 0;
    sections.forEach((el, i) => {
      if (visible(el) && offsetOf(el) <= y) idx = i;
    });
    // At the very bottom, the last sections may never reach the top edge.
    if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 4) {
      for (let i = sections.length - 1; i >= 0; i--) {
        if (visible(sections[i])) { idx = i; break; }
      }
    }
    setActive(idx);
  };

  bar.addEventListener("click", (e) => {
    const chip = e.target.closest(".m-secnav-chip");
    if (!chip) return;
    const idx = Number(chip.dataset.idx);
    const el = sections[idx];
    if (!el) return;
    lockUntil = Date.now() + 700;
    setActive(idx);
    scrollEl.scrollTo({ top: Math.max(0, offsetOf(el) - 8), behavior: "smooth" });
  });

  scrollEl.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(spy);
      }
    },
    { passive: true },
  );

  build();
  // Relabel the chips in the new language, keeping hidden/active state
  onLanguageChange(() => {
    const idx = activeIdx;
    build();
    sections.forEach((el, i) => chips[i]?.classList.toggle("d-none", !visible(el)));
    if (idx >= 0) setActive(idx);
  });

  return {
    /** Re-reads which sections are visible (e.g. signature shown/hidden). */
    refresh() {
      if (sections.length !== root.querySelectorAll("[data-msec]").length) build();
      sections.forEach((el, i) => chips[i]?.classList.toggle("d-none", !visible(el)));
      spy();
    },
    /** Jump back to the first section (new record opened). */
    reset() {
      scrollEl.scrollTop = 0;
      bar.scrollLeft = 0;
      this.refresh();
    },
  };
}

// ─── Bottom action sheet ─────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string} [opts.title]  plain text (labels and hints are plain text too)
 * @param {Array<{icon?:string,label:string,hint?:string,danger?:boolean,opensScreen?:boolean,onClick:Function}|'divider'>} opts.actions
 *   Set opensScreen on actions that navigate or open another back-gesture
 *   layer; they run once the sheet has fully closed.
 * @param {Function} [opts.onClose]  called once when the sheet closes, with the
 *   picked action, or null when dismissed
 */
export function openActionSheet({ title, actions, onClose }) {
  const esc = (text) => {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  };
  const backdrop = document.createElement("div");
  backdrop.className = "m-sheet-backdrop";
  const sheet = document.createElement("div");
  sheet.className = "m-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");

  const items = actions.filter(Boolean);
  sheet.innerHTML = `
    <div class="m-sheet-grabber"></div>
    ${title ? `<div class="m-sheet-title">${esc(title)}</div>` : ""}
    <div class="m-sheet-list">
      ${items
        .map((a, i) =>
          a === "divider"
            ? '<div class="m-sheet-divider"></div>'
            : `<button type="button" class="m-sheet-item${a.danger ? " danger" : ""}" data-i="${i}">
                 ${a.icon ? `<i class="bi ${esc(a.icon)}"></i>` : ""}
                 <span class="m-sheet-item-text"><span>${esc(a.label)}</span>${a.hint ? `<small>${esc(a.hint)}</small>` : ""}</span>
               </button>`,
        )
        .join("")}
    </div>
    <button type="button" class="m-sheet-cancel">${esc(i18next.t("common.cancel"))}</button>`;

  document.body.append(backdrop, sheet);
  requestAnimationFrame(() => {
    backdrop.classList.add("show");
    sheet.classList.add("show");
  });

  const layerName = `sheet-${Date.now()}`;
  let closed = false;
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  const teardown = (picked = null) => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    onClose?.(picked);
    backdrop.classList.remove("show");
    sheet.classList.remove("show");
    setTimeout(() => {
      backdrop.remove();
      sheet.remove();
    }, 250);
  };
  function close(picked = null) {
    teardown(picked);
    return mobileLayers ? mobileLayers.close(layerName) : Promise.resolve();
  }

  mobileLayers?.open(layerName, () => {
    teardown();
  });

  document.addEventListener("keydown", onKey);
  backdrop.addEventListener("click", () => close());
  sheet.querySelector(".m-sheet-cancel").addEventListener("click", () => close());
  sheet.addEventListener("click", (e) => {
    const btn = e.target.closest(".m-sheet-item");
    if (!btn) return;
    const action = items[Number(btn.dataset.i)];
    if (action.opensScreen) {
      // Wait until the sheet's history entry is gone, so the screen it opens
      // gets its own clean back-gesture entry.
      close(action).then(() => action.onClick?.());
    } else {
      // Run inside the tap itself: iOS only allows clipboard writes and file
      // pickers during the user's gesture.
      close(action);
      action.onClick?.();
    }
  });

  return { close };
}

// ─── Unsaved-edit tracking ───────────────────────────────────────────────────

/**
 * Calls onEdit() whenever the user (not code) changes something inside `root`:
 * typing, selects/checkboxes, buttons that edit (add room, remove photo,
 * status...), dropdown picks and signature strokes. Toggles that only open a
 * menu or panel ([data-bs-toggle]) don't count, and neither do controls inside
 * [data-saves-itself] (e.g. room photos, which are saved the moment they change).
 */
export function trackUserEdits(root, onEdit) {
  if (!root) return;
  // The path as dispatched, so it still holds when a click redrew (detached) its target
  const savesItself = (e) =>
    e.composedPath().some((el) => el instanceof Element && el.hasAttribute("data-saves-itself"));
  const mark = (e) => {
    if (e.isTrusted && !savesItself(e)) onEdit();
  };
  root.addEventListener("input", mark);
  root.addEventListener("change", mark);
  root.addEventListener("click", (e) => {
    if (e.target.closest("button:not([data-bs-toggle]), .dropdown-item")) mark(e);
  });
  root.addEventListener("pointerup", (e) => {
    if (e.target.closest("canvas")) mark(e);
  });
}

// ─── Keyboard hints ──────────────────────────────────────────────────────────

/** Number fields get a digit keypad (decimal when they accept cents). */
export function applyMobileInputHints(root) {
  if (!root) return;
  root.querySelectorAll('input[type="number"]:not([inputmode])').forEach((input) => {
    const step = input.getAttribute("step");
    const decimal = step === "any" || (step && !Number.isInteger(Number(step)));
    input.setAttribute("inputmode", decimal ? "decimal" : "numeric");
  });
}
