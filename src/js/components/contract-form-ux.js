/**
 * Layout layer for the Create Contract screen. UI only: the contract logic
 * stays in contract-management.js, which still finds every field by its id.
 *
 * - Property picker: once a property is chosen the card grid folds into a
 *   one-line "selected property" bar (Change reopens it); the grid has search.
 * - The form is split into numbered, collapsible sections. Each header shows
 *   a live summary and turns into a check mark once its key fields are filled.
 * - Saved templates live in a slide-out drawer with search.
 * - Below 992px: Details | Preview tabs and an export bar pinned to the
 *   bottom; on phones the "more" menu opens as a bottom action sheet.
 *
 * contract-management.js calls refresh(), onPropertyChange() and
 * onCardsRendered() when its own state changes.
 */
import i18next, { onLanguageChange } from "../i18n.js";
import {
  isMobileViewport,
  openActionSheet,
  applyMobileInputHints,
} from "../utils/mobile-ux.js";

const OPEN_KEY = "contractSectionsOpen";
// Workspace width for the properties | form | preview layout. Keep in sync
// with the @container ctws rule in dashboard.html.
const WIDE_MIN = 1100;
const DEFAULT_OPEN = {
  property: true,
  tenants: true,
  dates: true,
  payment: true,
  clauses: false,
  signatures: false,
};

const esc = (text) => {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
};

export function initContractFormUx(manager) {
  const root = document.getElementById("contractWorkspace");
  if (!root) return null;

  const $ = (id) => document.getElementById(id);
  const t = (key, opts) => i18next.t(`createContract.ux.${key}`, opts);
  const val = (id) => ($(id)?.value || "").trim();
  const isChecked = (id) => Boolean($(id)?.checked);
  const optionText = (id) => {
    const option = $(id)?.selectedOptions?.[0];
    return option && option.value ? option.textContent.trim().replace(/\s+/g, " ") : "";
  };
  const money = (v) => {
    const n = Number(v);
    return v !== "" && Number.isFinite(n)
      ? `S$${n.toLocaleString("en-SG", { maximumFractionDigits: 2 })}`
      : "";
  };
  const shortDate = (v) => {
    if (!v) return "";
    const d = new Date(`${v}T00:00:00`);
    if (Number.isNaN(d.getTime())) return v;
    const locale = i18next.language?.startsWith("vi") ? "vi-VN" : "en-SG";
    return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  };

  // ─── Collapsible sections ──────────────────────────────────────────────────

  const sections = Array.from(root.querySelectorAll(".ct-sec"));
  const openState = { ...DEFAULT_OPEN };
  try {
    Object.assign(openState, JSON.parse(localStorage.getItem(OPEN_KEY) || "{}"));
  } catch {
    /* keep defaults */
  }

  const setOpen = (sec, open, save = true) => {
    sec.classList.toggle("is-open", open);
    sec.querySelector(".ct-sec-head")?.setAttribute("aria-expanded", String(open));
    openState[sec.dataset.ctSec] = open;
    if (!save) return;
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(openState));
    } catch {
      /* private mode: just don't remember */
    }
  };

  sections.forEach((sec) => {
    setOpen(sec, openState[sec.dataset.ctSec] !== false, false);
    sec
      .querySelector(".ct-sec-head")
      ?.addEventListener("click", () => setOpen(sec, !sec.classList.contains("is-open")));
  });

  // ─── Property picker ───────────────────────────────────────────────────────

  const cards = $("contractPropertyCards");
  const picker = $("ctPropPicker");
  const current = $("ctPropCurrent");
  const search = $("ctPropSearch");
  const noMatch = $("ctPropNoMatch");
  const cancelPick = $("ctPropCancel");
  const addressSelect = $("contractAddress");

  const paneBody = $("ctPropPaneBody");
  const paneCount = $("ctPropCount");
  const pickerHome = document.createComment("property picker");
  picker.before(pickerHome);

  let pickerOpen = null; // null: open only while nothing is chosen
  let pendingId = null; // card tapped, the manager is still loading it
  let wide = false; // picker lives in its own column, always open

  const idOf = (p) => String(p?.propertyId || p?.id || p?._id || "");
  const findProperty = (id) => (manager.properties || []).find((p) => idOf(p) === String(id));
  const addressMode = () =>
    ["CUSTOM_TEXT", "ADD_NEW_PROPERTY"].includes(addressSelect?.value) ? addressSelect.value : null;
  const selectedId = () => pendingId || manager.selectedPropertyId || null;
  const hasSelection = () =>
    Boolean(selectedId() || addressMode() || manager.contractData?.address);

  const renderCurrent = () => {
    const id = selectedId();
    const property = id ? findProperty(id) : null;
    const mode = id ? null : addressMode();
    let icon = "bi-geo-alt";
    let title = manager.contractData?.address || "";
    let sub = "";
    let image = "";

    if (id) {
      icon = "bi-buildings";
      title = property ? property.address || property.location || property.name || "" : title;
      sub = [property?.unit, `ID ${id}`].filter(Boolean).join(" · ");
      image = property?.propertyImage || "";
    } else if (mode === "CUSTOM_TEXT") {
      icon = "bi-pencil";
      title = t("typedAddress");
      sub = val("customAddressText") || t("typeAddressHint");
    } else if (mode === "ADD_NEW_PROPERTY") {
      icon = "bi-plus-lg";
      title = t("newPropertyLabel");
      sub = val("newPropertyAddress") || t("typeAddressHint");
    }

    current.innerHTML = `
      <div class="ct-prop-thumb">${image ? "" : `<i class="bi ${icon}"></i>`}</div>
      <div class="ct-prop-meta">
        <div class="ct-prop-addr">${esc(title)}</div>
        ${sub ? `<div class="ct-prop-sub">${esc(sub)}</div>` : ""}
      </div>
      <button type="button" class="btn btn-sm btn-outline-primary ct-prop-change" data-ct-change>
        <i class="bi bi-arrow-left-right me-1"></i>${esc(t("change"))}
      </button>`;
    if (image) current.querySelector(".ct-prop-thumb").style.backgroundImage = `url(${JSON.stringify(image)})`;
  };

  const syncPicker = () => {
    if (wide) {
      picker.hidden = false;
      current.hidden = true;
      return;
    }
    const selected = hasSelection();
    const open = pickerOpen === null ? !selected : pickerOpen;
    picker.hidden = !open;
    current.hidden = open || !selected;
    cancelPick.hidden = !selected;
    if (!current.hidden) renderCurrent();
  };

  const applyFilter = () => {
    const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    cards.querySelectorAll(".property-card-compact").forEach((card) => {
      const haystack = `${card.dataset.propertyId} ${card.textContent}`
        .toLowerCase()
        .replace(/\s+/g, " ");
      const match = words.every((w) => haystack.includes(w));
      card.hidden = !match;
      if (match) shown++;
    });
    noMatch.hidden = shown > 0 || words.length === 0;
  };

  const openPicker = () => {
    pickerOpen = true;
    syncPicker();
    const chosen = cards.querySelector(".selected-card");
    if (chosen) chosen.scrollIntoView({ block: "nearest" });
    if (!isMobileViewport()) search.focus();
  };

  const closePicker = () => {
    pickerOpen = null;
    // In the side column the list stays as filtered
    if (!wide) {
      search.value = "";
      applyFilter();
    }
    syncPicker();
  };

  // Keep the chosen property in view inside the side column's list
  const revealSelected = () => {
    if (!wide) return;
    const chosen = cards.querySelector(".selected-card:not([hidden])");
    if (!chosen) return;
    const top = chosen.offsetTop - cards.offsetTop;
    if (top < cards.scrollTop || top + chosen.offsetHeight > cards.scrollTop + cards.clientHeight) {
      cards.scrollTop = Math.max(0, top - cards.clientHeight / 2 + chosen.offsetHeight / 2);
    }
  };

  // Move the picker between its own column (wide) and the Property section
  const placePicker = () => {
    const nowWide = Boolean(paneBody) && root.clientWidth >= WIDE_MIN;
    if (nowWide === wide && (wide ? picker.parentElement === paneBody : true)) return;
    wide = nowWide;
    root.classList.toggle("ct-wide", wide);
    if (wide) paneBody.append(picker);
    else pickerHome.after(picker);
    pickerOpen = null;
    syncPicker();
    revealSelected();
  };

  current.addEventListener("click", (e) => {
    if (e.target.closest("[data-ct-change]")) openPicker();
  });
  cancelPick.addEventListener("click", closePicker);

  // The card's own onclick selects it; this only folds the picker right away
  cards.addEventListener("click", (e) => {
    const card = e.target.closest(".property-card-compact");
    if (!card) return;
    pendingId = card.dataset.propertyId || null;
    closePicker();
    refresh();
  });

  search.addEventListener("input", applyFilter);
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && hasSelection()) {
      e.preventDefault();
      closePicker();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const visible = cards.querySelectorAll(".property-card-compact:not([hidden])");
      if (visible.length === 1) visible[0].click();
    }
  });

  // "New property" / "Type address": same as picking those options in the
  // (hidden) address dropdown
  root.querySelectorAll("[data-ct-address-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.ctAddressMode;
      if (addressSelect) addressSelect.value = mode;
      pendingId = null;
      closePicker();
      manager.handleAddressSelection(mode);
      refresh();
    });
  });

  // ─── Section summaries ─────────────────────────────────────────────────────

  const summarize = {
    property() {
      const id = selectedId();
      const property = id ? findProperty(id) : null;
      let address = property
        ? [property.address || property.location || property.name, property.unit]
            .filter(Boolean)
            .join(" ")
        : "";
      if (!address) {
        const mode = addressMode();
        address =
          mode === "CUSTOM_TEXT"
            ? val("customAddressText")
            : mode === "ADD_NEW_PROPERTY"
              ? val("newPropertyAddress")
              : manager.contractData?.address || "";
      }
      const room = optionText("contractRoom");
      return {
        text: [address || t("chooseProperty"), room].filter(Boolean).join(" · "),
        done: Boolean(address && room),
      };
    },
    tenants() {
      const a =
        manager.selectedTenantA?.name ||
        val("customTenantAText") ||
        val("newTenantAName") ||
        optionText("contractTenantA");
      const bNames = (Array.isArray(manager.selectedTenantB) ? manager.selectedTenantB : [])
        .map((tenant) => tenant?.name)
        .filter(Boolean);
      const b = bNames.length ? bNames.join(", ") : val("customTenantBText");
      return {
        text: a ? [a, b && `B: ${b}`].filter(Boolean).join(" · ") : t("noTenantA"),
        done: Boolean(a),
      };
    },
    dates() {
      const moveIn = val("contractMoveInDate");
      const moveOut = val("contractMoveOutDate");
      const lease = val("contractLeasePeriod");
      return {
        text:
          moveIn || moveOut
            ? `${shortDate(moveIn) || "?"} → ${shortDate(moveOut) || "?"}${lease ? ` · ${lease}` : ""}`
            : t("noDates"),
        done: Boolean(moveIn && moveOut),
      };
    },
    payment() {
      const rent = val("contractMonthlyRental");
      const deposit = val("contractSecurityDeposit");
      return {
        text:
          rent || deposit
            ? [rent && `${money(rent)}${t("perMonth")}`, deposit && `${t("deposit")} ${money(deposit)}`]
                .filter(Boolean)
                .join(" · ")
            : t("noRent"),
        done: Boolean(rent && deposit),
      };
    },
    clauses() {
      const extra = manager.additionalClauses?.length || 0;
      const items = [
        isChecked("pestControlClause") && t("pestControl"),
        isChecked("airconFreeOfCharge") && t("airconFree"),
        isChecked("forfeitAcCleanFee") && t("forfeitAc"),
        extra && t("extraClauses", { count: extra }),
      ].filter(Boolean);
      return { text: items.length ? items.join(" · ") : t("standardClauses"), done: null };
    },
    signatures() {
      const a = Boolean(manager.signatures?.tenantA);
      const b = Boolean(manager.signatures?.tenantB);
      return {
        text: a || b ? [a && t("signedA"), b && t("signedB")].filter(Boolean).join(" · ") : t("noSignatures"),
        done: a && b ? true : null,
      };
    },
  };

  // Batched: a reset or template load changes many fields in one go
  let scheduled = false;
  function refresh() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      sections.forEach((sec) => {
        const summary = summarize[sec.dataset.ctSec]?.();
        if (!summary) return;
        const el = sec.querySelector("[data-ct-summary]");
        if (el && el.textContent !== summary.text) {
          el.textContent = summary.text;
          el.title = summary.text;
        }
        sec.classList.toggle("is-done", summary.done === true);
      });
      syncPicker();
    });
  }

  root.addEventListener("input", refresh);
  root.addEventListener("change", refresh);
  onLanguageChange(refresh);

  // ─── Templates drawer ──────────────────────────────────────────────────────

  const drawer = $("contractTemplatesDrawer");
  const templatesList = $("templatesList");
  const templateSearch = $("contractTemplateSearch");
  const templateCount = $("contractTemplateCount");

  const filterTemplates = () => {
    const q = (templateSearch?.value || "").trim().toLowerCase();
    const items = templatesList.querySelectorAll(".template-item[data-template-name]");
    items.forEach((item) => {
      item.hidden = Boolean(q) && !item.textContent.toLowerCase().includes(q);
    });
    if (templateCount) {
      templateCount.textContent = String(items.length);
      templateCount.hidden = items.length === 0;
    }
  };

  if (drawer && templatesList) {
    new MutationObserver(filterTemplates).observe(templatesList, { childList: true });
    templateSearch?.addEventListener("input", filterTemplates);
    // Loading a template fills the form: get the drawer out of the way
    templatesList.addEventListener("click", (e) => {
      if (e.target.closest(".template-info")) window.bootstrap?.Offcanvas.getInstance(drawer)?.hide();
    });
    drawer.addEventListener("shown.bs.offcanvas", () => {
      if (!isMobileViewport()) templateSearch?.focus();
    });
  }

  // ─── Details | Preview tabs (below 992px) ─────────────────────────────────

  root.querySelectorAll("[data-ct-view]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const view = tab.dataset.ctView;
      root.dataset.view = view;
      root.querySelectorAll("[data-ct-view]").forEach((other) => {
        const on = other.dataset.ctView === view;
        other.classList.toggle("active", on);
        other.setAttribute("aria-selected", String(on));
      });
      // Start the other view at its top, keeping the tabs in place
      const top = root.getBoundingClientRect().top + window.scrollY;
      if (window.scrollY > top) window.scrollTo({ top, behavior: "instant" });
    });
  });

  // ─── "More" export menu ────────────────────────────────────────────────────

  const moreBtn = $("contractMoreBtn");
  const moreMenu = $("contractMoreMenu");
  if (moreBtn && moreMenu) {
    // Phones get a bottom sheet; desktop keeps the Bootstrap dropdown.
    // Stopping the click here keeps it from reaching Bootstrap's handler.
    moreBtn.addEventListener("click", (e) => {
      if (!isMobileViewport()) return;
      e.preventDefault();
      e.stopPropagation();
      openActionSheet({
        title: t("moreExports"),
        actions: Array.from(moreMenu.querySelectorAll("button.dropdown-item")).map((item) => ({
          icon: item.querySelector("i")?.className.match(/bi-[\w-]+/)?.[0],
          label: item.textContent.trim().replace(/\s+/g, " "),
          onClick: () => item.click(),
        })),
      });
    });

    // The export functions show their spinner on the menu item itself, which
    // is out of sight in a closed menu: mirror it onto the "more" button.
    const syncBusy = () =>
      moreBtn.classList.toggle("is-busy", Boolean(moreMenu.querySelector("button:disabled")));
    new MutationObserver(syncBusy).observe(moreMenu, {
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
  }

  if (window.ResizeObserver) new ResizeObserver(placePicker).observe(root);
  placePicker();

  applyMobileInputHints(root);
  refresh();

  return {
    refresh,
    /** The manager finished (re)selecting a property, or cleared it. */
    onPropertyChange() {
      pendingId = null;
      refresh();
      revealSelected();
    },
    /** The card grid was redrawn (properties loaded, language switched). */
    onCardsRendered() {
      applyFilter();
      if (paneCount) paneCount.textContent = String(cards.querySelectorAll(".property-card-compact").length || "");
      refresh();
      revealSelected();
    },
  };
}
