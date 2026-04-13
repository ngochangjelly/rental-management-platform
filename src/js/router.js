/**
 * AppRouter — hash-based client-side router.
 *
 * URL scheme:
 *   #/                                              → dashboard
 *   #/<section>                                     → any named section
 *   #/financial/<property-slug>                     → financial report (current month)
 *   #/financial/<property-slug>/<year>/<month>      → financial report detail
 *   #/tenants/<property-slug>                       → tenants for a property
 *   #/tenants/<property-slug>/<tenant-name-slug>    → specific tenant (opens modal)
 *
 * Property slug  = slugify(unit) + "-" + slugify(address)
 *   e.g.  "#05-12" + "123 Clementi Road"  →  "05-12-123-clementi-road"
 *
 * Tenant slug    = mongoId + "-" + slugify(name)
 *   e.g.  "6616f6a1d3b2e5f4a9c8b7d1-john-doe"
 *   Parse back: tenantId = slug.slice(0, 24)   (ObjectId is always 24 hex chars)
 *
 * Tenant-in-property URL  = /tenants/<property-slug>/<slugify(tenant.name)>
 *   e.g.  /tenants/05-12-123-clementi-road/john-doe
 *   Human-readable: full name + unit + address — no raw IDs in the URL.
 *
 * Adding new deep-link routes:
 *   Insert an entry into this.routes BEFORE the generic section catch-all.
 *   Each entry needs { pattern: RegExp, handle(matchArray): Function }.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Slug utilities ──────────────────────────────────────────────────────────

const SlugUtils = {
  /** Convert any string to a URL-safe slug. */
  toSlug(str) {
    return (str || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric → hyphen
      .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
  },

  /**
   * Human-readable property slug from unit + address.
   * e.g.  { unit: "#05-12", address: "123 Clementi Road" }
   *    →  "05-12-123-clementi-road"
   */
  propertySlug(property) {
    const unit = this.toSlug(property.unit || "");
    const address = this.toSlug(property.address || "");
    return [unit, address].filter(Boolean).join("-");
  },

  /**
   * Human-readable tenant slug: mongoId prefix + slugified name.
   * e.g.  { _id: "6616f6a1d3b2e5f4a9c8b7d1", name: "John Doe" }
   *    →  "6616f6a1d3b2e5f4a9c8b7d1-john-doe"
   *
   * Parsing: tenantId = slug.slice(0, 24)   (ObjectId is always 24 hex chars)
   */
  tenantSlug(tenant) {
    const id = tenant._id || "";
    const name = this.toSlug(tenant.name || "");
    return [id, name].filter(Boolean).join("-");
  },

  /** Extract the MongoDB _id from a tenant slug. */
  parseTenantId(slug) {
    return slug.slice(0, 24);
  },
};

window.SlugUtils = SlugUtils;

// ─── Router ──────────────────────────────────────────────────────────────────

class AppRouter {
  constructor() {
    this.routes = [
      // Financial detail — property slug + year + month
      {
        pattern: /^\/financial\/(.+)\/(\d{4})\/(\d{1,2})$/,
        handle: ([, slug, year, month]) =>
          this._goFinancial(slug, +year, +month),
      },
      // Financial — property slug, current month
      {
        pattern: /^\/financial\/(.+)$/,
        handle: ([, slug]) => this._goFinancial(slug),
      },
      // Financial section root (no property selected)
      {
        pattern: /^\/financial$/,
        handle: () => this._goSection("financial"),
      },
      // Utility bills — property slug
      {
        pattern: /^\/utility-bills\/(.+)$/,
        handle: ([, slug]) => this._goUtility(slug),
      },
      // Utility bills section root (no property selected)
      {
        pattern: /^\/utility-bills$/,
        handle: () => this._goSection("utility-bills"),
      },
      // Tenants — property slug + tenant name slug (opens specific tenant modal)
      {
        pattern: /^\/tenants\/(.+)\/([^/]+)$/,
        handle: ([, propSlug, nameSlug]) => this._goTenant(propSlug, nameSlug),
      },
      // Tenants — property slug (show property's tenants)
      {
        pattern: /^\/tenants\/(.+)$/,
        handle: ([, propSlug]) => this._goTenant(propSlug),
      },
      // Generic section: /dashboard, /properties, /tenants, /contracts, etc.
      {
        pattern: /^\/([a-z][a-z0-9-]*)$/,
        handle: ([, section]) => this._goSection(section),
      },
      // Root → dashboard
      {
        pattern: /^\/?$/,
        handle: () => this._goSection("dashboard"),
      },
    ];

    // Prevents re-entrant hashchange firing when we update the hash ourselves.
    this._busy = false;

    window.addEventListener("hashchange", () => this._onHashChange());
  }

  /** Call once after DashboardController is ready. */
  start() {
    this._onHashChange();
  }

  /**
   * Navigate to path — updates hash and triggers routing.
   * Use for navigation you want in browser history (back/forward).
   */
  navigate(path) {
    window.location.hash = "#" + path;
  }

  /**
   * Silently sync the URL to reflect component state without triggering routing.
   * Call inside component methods (selectProperty, changeMonth, etc.) to keep
   * the URL bookmarkable without causing routing loops.
   */
  replace(path) {
    const target = "#" + path;
    if (window.location.hash === target) return;
    this._busy = true;
    window.location.hash = target;
    setTimeout(() => {
      this._busy = false;
    }, 50);
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  _onHashChange() {
    if (this._busy) return;
    const path = (window.location.hash || "#/").slice(1) || "/";
    this._dispatch(path);
  }

  _dispatch(path) {
    for (const route of this.routes) {
      const m = path.match(route.pattern);
      if (m) {
        route.handle(m);
        return;
      }
    }
    this._goSection("dashboard");
  }

  _goSection(name) {
    window.dashboardController?.showSection(name, { fromRouter: true });
  }

  async _goFinancial(slug, year, month) {
    // Show the section — creates FinancialReportsComponent if not yet done.
    this._goSection("financial");

    const fr = window.financialReports;
    if (!fr) return;

    // Resolve human-readable slug → property object with propertyId
    const property = await this._resolvePropertySlug(slug);
    if (!property) {
      console.warn(`[Router] No property found for slug: "${slug}"`);
      return;
    }

    // Make the resolved property available to selectProperty() in case
    // this.properties hasn't been populated yet (async race on first load).
    fr._slugResolvedProperty = property;

    if (year && month) {
      fr.currentDate = new Date(year, month - 1, 1);
    }

    await fr.selectProperty(property.propertyId);

    fr._slugResolvedProperty = null;
  }

  /**
   * Resolve a property slug → property object.
   * Uses the already-loaded properties list when available; falls back to a
   * direct API fetch so deep-links work on first page load.
   */
  async _resolvePropertySlug(slug) {
    const cached = window.financialReports?.properties;
    if (cached?.length > 0) {
      return cached.find((p) => SlugUtils.propertySlug(p) === slug) || null;
    }

    try {
      // Fetch first page — enough for slug lookup (properties rarely exceed 200)
      const res = await API.get(
        `${API_CONFIG.ENDPOINTS.PROPERTIES}?limit=200`,
      );
      const data = await res.json();
      const props = data.properties || [];
      return props.find((p) => SlugUtils.propertySlug(p) === slug) || null;
    } catch (e) {
      console.error("[Router] Failed to resolve property slug:", e);
      return null;
    }
  }

  async _goUtility(slug) {
    this._goSection("utility-bills");

    const ut = window.utilityBillTracker;
    if (!ut) return;

    const property = await this._resolveUtilitySlug(slug);
    if (!property) {
      console.warn(`[Router] No property found for utility slug: "${slug}"`);
      return;
    }

    ut._slugResolvedProperty = property;
    await ut.selectProperty(property.propertyId);
    ut._slugResolvedProperty = null;
  }

  async _resolveUtilitySlug(slug) {
    const cached = window.utilityBillTracker?.properties;
    if (cached?.length > 0) {
      return cached.find((p) => SlugUtils.propertySlug(p) === slug) || null;
    }

    try {
      const res = await API.get(
        `${API_CONFIG.ENDPOINTS.PROPERTIES}?limit=200`,
      );
      const data = await res.json();
      const props = data.properties || [];
      return props.find((p) => SlugUtils.propertySlug(p) === slug) || null;
    } catch (e) {
      console.error("[Router] Failed to resolve utility property slug:", e);
      return null;
    }
  }

  async _goTenant(propertySlug, tenantNameSlug) {
    this._goSection("tenants");

    const tm = window.tenantManager;
    if (!tm) return;

    // Resolve property slug → property object
    const property = await this._resolveTenantPropertySlug(propertySlug);
    if (!property) {
      console.warn(`[Router] No property found for tenant slug: "${propertySlug}"`);
      return;
    }

    tm._slugResolvedProperty = property;
    await tm.selectProperty(property.propertyId);
    tm._slugResolvedProperty = null;

    // If a tenant name slug is provided, open that tenant's modal
    if (tenantNameSlug) {
      const tenant = tm.tenants.find(
        (t) => SlugUtils.toSlug(t.name || "") === tenantNameSlug,
      );
      if (tenant) {
        await tm.editTenant(tenant._id);
      } else {
        console.warn(`[Router] No tenant matched name slug: "${tenantNameSlug}"`);
      }
    }
  }

  async _resolveTenantPropertySlug(slug) {
    const cached = window.tenantManager?.properties;
    if (cached?.length > 0) {
      return cached.find((p) => SlugUtils.propertySlug(p) === slug) || null;
    }

    try {
      const res = await API.get(
        `${API_CONFIG.ENDPOINTS.PROPERTIES}?limit=200`,
      );
      const data = await res.json();
      const props = data.properties || [];
      return props.find((p) => SlugUtils.propertySlug(p) === slug) || null;
    } catch (e) {
      console.error("[Router] Failed to resolve tenant property slug:", e);
      return null;
    }
  }
}

const appRouter = new AppRouter();
window.appRouter = appRouter;
