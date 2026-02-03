import i18next from "./i18n.js";

/**
 * Dashboard Controller
 * Main controller that manages the dashboard sections and components
 */
class DashboardController {
  constructor() {
    this.components = {};
    this.currentSection = "dashboard";
    // Data version tracking for cross-module synchronization
    this.dataVersions = {
      tenants: 0,
      properties: 0,
      investors: 0,
    };
    this.init();
  }

  init() {
    this.updateCurrentDate();
    this.setupNavigation();
    this.setupFeatureCards();
    this.loadUserInfo();
    this.loadDashboardStats();
    this.setupLanguageSwitcher();
    this.updateTranslations();

    // Initialize components when their sections are first accessed
    this.initializeComponentsLazily();

    // Preload tenants data on dashboard entry for better UX
    this.preloadTenantData();
  }

  updateCurrentDate() {
    const now = new Date();
    const currentDateEl = document.getElementById("currentDate");
    if (currentDateEl) {
      currentDateEl.textContent =
        i18next.t("dashboard.currentDate") +
        " " +
        now.toLocaleDateString(i18next.language === "vi" ? "vi-VN" : "en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
    }
  }

  setupNavigation() {
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const section = link.getAttribute("data-section");
        if (section) {
          this.showSection(section);

          // Update active nav link
          document
            .querySelectorAll(".nav-link")
            .forEach((l) => l.classList.remove("active"));
          link.classList.add("active");
        }
      });
    });
  }

  setupFeatureCards() {
    // Add click handlers for feature cards using event delegation
    document.addEventListener("click", (e) => {
      const featureCard = e.target.closest("[data-section]");

      if (featureCard && featureCard.classList.contains("feature-card")) {
        const section = featureCard.getAttribute("data-section");
        this.showSection(section);
      }
    });
  }

  showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll(".content-section").forEach((section) => {
      section.style.display = "none";
    });

    // Show target section
    const targetSectionId = sectionName + "-section";
    const targetSection = document.getElementById(targetSectionId);

    if (targetSection) {
      targetSection.style.display = "block";
      this.currentSection = sectionName;

      // Initialize component for this section if not already done
      this.initializeComponentForSection(sectionName);

      // Refresh data if it has changed since last visit
      this.refreshSectionDataIfNeeded(sectionName);
    }

    // Update active nav link
    document
      .querySelectorAll(".nav-link")
      .forEach((l) => l.classList.remove("active"));
    const navLink = document.querySelector(
      `.nav-link[data-section="${sectionName}"]`,
    );
    if (navLink) {
      navLink.classList.add("active");
    }
  }

  initializeComponentsLazily() {
    // Components will be initialized when their sections are first shown
    // This improves initial page load performance
  }

  initializeComponentForSection(sectionName) {
    // Initialize component if not already initialized
    switch (sectionName) {
      case "analysis":
        if (!this.components.contractAnalysis) {
          this.components.contractAnalysis = new ContractAnalysisComponent();
        }
        break;
      case "properties":
        if (!this.components.propertyManagement) {
          this.components.propertyManagement =
            new PropertyManagementComponent();
          // Make it globally accessible for button onclick handlers
          window.propertyManager = this.components.propertyManagement;
        }
        break;
      case "tenants":
        if (!this.components.tenantManagement) {
          console.log("🏗️ Creating TenantManagementComponent...");
          this.components.tenantManagement = new TenantManagementComponent();
          // Make it globally accessible for button onclick handlers
          window.tenantManager = this.components.tenantManagement;
          console.log("✅ TenantManagementComponent created");

          // Load tenants after section is shown
          setTimeout(() => {
            console.log("⏰ Loading tenants after section display...");
            this.components.tenantManagement.loadTenants();
          }, 100);
        } else {
          console.log(
            "♻️ Using preloaded TenantManagementComponent - data already available",
          );
        }
        break;
      case "contracts":
        if (!this.components.contractManagement) {
          console.log("🏗️ Creating ContractManagementComponent...");
          this.components.contractManagement =
            new ContractManagementComponent();
          // Make it globally accessible for button onclick handlers
          window.contractManager = this.components.contractManagement;
          console.log("✅ ContractManagementComponent created");

          // Set up contract form after section is shown
          setTimeout(async () => {
            console.log("⏰ Setting up contract form...");
            await Promise.all([
              this.components.contractManagement.loadTenants(),
              this.components.contractManagement.loadProperties(),
            ]);
            this.components.contractManagement.populateTenantsDropdown();
            this.components.contractManagement.populatePropertiesDropdown();
            this.components.contractManagement.setupContractInputs();

            // Initialize template section
            console.log("🔧 Initializing contract templates...");
            await this.components.contractManagement.initializeTemplateSection();
            this.components.contractManagement.updateContractPreview();
          }, 100);
        }
        break;
      case "financial":
        if (!this.components.financialReports) {
          this.components.financialReports = new FinancialReportsComponent();
          // Make it globally accessible for button onclick handlers
          window.financialReports = this.components.financialReports;
        }
        break;
      case "bulk-reports":
        if (!this.components.bulkPropertyReports) {
          this.components.bulkPropertyReports =
            new BulkPropertyReportsComponent();
          // Make it globally accessible for button onclick handlers
          window.bulkPropertyReports = this.components.bulkPropertyReports;
        }
        break;
      case "bills":
        if (!this.components.billManagement) {
          console.log("🏗️ Creating BillManagementComponent...");
          this.components.billManagement = new BillManagementComponent();
          // Make it globally accessible for button onclick handlers
          window.billManager = this.components.billManagement;
          console.log("✅ BillManagementComponent created");
        }
        break;
      case "investors":
        if (!this.components.investorManagement) {
          this.components.investorManagement =
            new InvestorManagementComponent();
          // Make it globally accessible for button onclick handlers
          window.investorManager = this.components.investorManagement;
        }
        break;
      case "users":
        if (!this.components.userManagement) {
          this.components.userManagement = new UserManagement();
          // Make it globally accessible for button onclick handlers
          window.userManagement = this.components.userManagement;
        }
        break;
      case "tenancy-occupancy":
        // Tenancy occupancy component is initialized globally
        // Just trigger data load when section is shown
        if (window.tenancyOccupancyComponent) {
          window.tenancyOccupancyComponent.loadData();
        } else {
          console.error(
            "[DEBUG] tenancyOccupancyComponent not found on window!",
          );
        }
        break;
    }
  }

  async loadUserInfo() {
    // Load user info from API and show/hide admin-only features
    const userInfoEl = document.getElementById("userInfo");

    // Check if user is admin and show/hide admin-only nav items
    const user = getCurrentUser();
    const usersNavItem = document.getElementById("usersNavItem");
    const investorsNavItem = document.getElementById("investorsNavItem");

    if (user && user.role === "admin") {
      if (usersNavItem) {
        usersNavItem.style.display = "block";
      }
      if (investorsNavItem) {
        investorsNavItem.style.display = "block";
      }
    }

    if (userInfoEl) {
      userInfoEl.textContent = "Admin User";
    }
  }

  async loadDashboardStats() {
    try {
      // Load properties stats
      const propertiesResponse = await API.get(
        API_CONFIG.ENDPOINTS.PROPERTY_STATS,
      );
      const propertiesResult = await propertiesResponse.json();

      if (propertiesResult.success) {
        const propertiesCountEl = document.getElementById("propertiesCount");
        if (propertiesCountEl) {
          propertiesCountEl.textContent =
            propertiesResult.stats.totalProperties || 0;
        }
      }

      // Load tenants stats
      const tenantsResponse = await API.get(API_CONFIG.ENDPOINTS.TENANT_STATS);
      const tenantsResult = await tenantsResponse.json();

      if (tenantsResult.success) {
        const stats = tenantsResult.stats;
        const totalTenants = stats.totalTenants || 0;
        const registeredCount = stats.registeredTenants || 0;
        const tenantsWithProperties = stats.tenantsWithProperties || 0;

        const tenantsCountEl = document.getElementById("tenantsCount");
        const registeredTenantsEl =
          document.getElementById("registeredTenants");
        const occupiedPropertiesEl =
          document.getElementById("occupiedProperties");

        if (tenantsCountEl) tenantsCountEl.textContent = totalTenants;
        if (registeredTenantsEl)
          registeredTenantsEl.textContent = registeredCount;
        if (occupiedPropertiesEl)
          occupiedPropertiesEl.textContent = tenantsWithProperties;
      }

      // Update contracts analyzed count (placeholder)
      const contractsCountEl = document.getElementById("contractsCount");
      if (contractsCountEl) {
        contractsCountEl.textContent = "0"; // Would be loaded from analytics
      }

      const issuesCountEl = document.getElementById("issuesCount");
      if (issuesCountEl) {
        issuesCountEl.textContent = "0"; // Would be loaded from analytics
      }

      const cleanCountEl = document.getElementById("cleanCount");
      if (cleanCountEl) {
        cleanCountEl.textContent = "0"; // Would be loaded from analytics
      }
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
      // Silently fail - dashboard stats are not critical
    }
  }

  // Public methods for external access
  getComponent(componentName) {
    return this.components[componentName];
  }

  refreshCurrentSection() {
    this.initializeComponentForSection(this.currentSection);

    // Refresh component data if available
    const component = this.getComponent(this.currentSection);
    if (component && component.refresh) {
      component.refresh();
    }
  }

  // Data version management for cross-module synchronization
  markTenantDataChanged() {
    this.dataVersions.tenants++;
    console.log(
      `📊 Tenant data version updated to ${this.dataVersions.tenants}`,
    );
  }

  markPropertyDataChanged() {
    this.dataVersions.properties++;
    console.log(
      `📊 Property data version updated to ${this.dataVersions.properties}`,
    );
  }

  markInvestorDataChanged() {
    this.dataVersions.investors++;
    console.log(
      `📊 Investor data version updated to ${this.dataVersions.investors}`,
    );
  }

  refreshSectionDataIfNeeded(sectionName) {
    // Map sections to their data dependencies and refresh methods
    const sectionDataDependencies = {
      contracts: {
        dependencies: ["tenants", "properties", "investors"],
        refresh: async () => {
          if (this.components.contractManagement) {
            console.log("🔄 Refreshing contract management data...");
            await Promise.all([
              this.components.contractManagement.loadTenants(),
              this.components.contractManagement.loadInvestors(),
              this.components.contractManagement.loadProperties(),
            ]);
            this.components.contractManagement.populateTenantsDropdown();
            this.components.contractManagement.populatePropertiesDropdown();
          }
        },
      },
      properties: {
        dependencies: ["tenants", "properties"],
        refresh: async () => {
          if (
            this.components.propertyManagement &&
            this.components.propertyManagement.refresh
          ) {
            console.log("🔄 Refreshing property management data...");
            this.components.propertyManagement.refresh();
          }
        },
      },
      financial: {
        dependencies: ["tenants", "properties"],
        refresh: async () => {
          if (
            this.components.financialReports &&
            this.components.financialReports.loadProperties
          ) {
            console.log("🔄 Refreshing financial reports data...");
            await this.components.financialReports.loadProperties();
          }
        },
      },
      "bulk-reports": {
        dependencies: ["tenants", "properties"],
        refresh: async () => {
          if (
            this.components.bulkPropertyReports &&
            this.components.bulkPropertyReports.loadProperties
          ) {
            console.log("🔄 Refreshing bulk reports data...");
            await this.components.bulkPropertyReports.loadProperties();
          }
        },
      },
    };

    const config = sectionDataDependencies[sectionName];
    if (!config) return;

    // Get the component and check if it has tracked versions
    const componentKey = this.getComponentKeyForSection(sectionName);
    const component = this.components[componentKey];

    if (!component) return;

    // Initialize component's version tracking if not present
    if (!component._dataVersions) {
      component._dataVersions = { tenants: -1, properties: -1, investors: -1 };
    }

    // Check if any dependency has changed
    let needsRefresh = false;
    for (const dep of config.dependencies) {
      if (component._dataVersions[dep] < this.dataVersions[dep]) {
        needsRefresh = true;
        console.log(
          `📊 ${sectionName}: ${dep} data changed (${component._dataVersions[dep]} -> ${this.dataVersions[dep]})`,
        );
      }
    }

    if (needsRefresh) {
      // Update component's tracked versions
      for (const dep of config.dependencies) {
        component._dataVersions[dep] = this.dataVersions[dep];
      }
      // Trigger refresh
      config.refresh();
    }
  }

  getComponentKeyForSection(sectionName) {
    const sectionToComponent = {
      contracts: "contractManagement",
      properties: "propertyManagement",
      financial: "financialReports",
      "bulk-reports": "bulkPropertyReports",
      tenants: "tenantManagement",
      investors: "investorManagement",
    };
    return sectionToComponent[sectionName];
  }

  refreshDashboardStats() {
    this.loadDashboardStats();
  }

  // Navigation helper methods
  goToSection(sectionName) {
    this.showSection(sectionName);
  }

  goToDashboard() {
    this.showSection("dashboard");
  }

  goToAnalysis() {
    this.showSection("analysis");
  }

  goToProperties() {
    this.showSection("properties");
  }

  goToTenants() {
    this.showSection("tenants");
  }

  goToInvestors() {
    this.showSection("investors");
  }

  // Preload tenant data when dashboard loads for better UX
  preloadTenantData() {
    console.log("🚀 Preloading tenant data on dashboard entry...");
    // Initialize tenant management component early
    if (!this.components.tenantManagement) {
      this.components.tenantManagement = new TenantManagementComponent();
      window.tenantManager = this.components.tenantManagement;
      console.log("✅ Tenant management component preloaded");

      // Load tenant data immediately
      this.components.tenantManagement.loadTenants();
    }
  }

  setupLanguageSwitcher() {
    const languageControl = document.getElementById("languageSwitcherControl");
    if (!languageControl) return;

    // Helper to update UI state
    const updateToggleUI = (lang) => {
      const normalizedLang = (lang || "vi").substring(0, 2).toLowerCase();

      // Update active state
      const options = newControl.querySelectorAll(".segment-option");
      options.forEach(opt => {
        if (opt.getAttribute("data-lang") === normalizedLang) {
          opt.classList.add("active");
        } else {
          opt.classList.remove("active");
        }
      });
    };

    // Remove existing listener to prevent duplicates (using cloneNode approach on container)
    const newControl = languageControl.cloneNode(true);
    languageControl.parentNode.replaceChild(newControl, languageControl);

    // Initial setup
    updateToggleUI(i18next.language);

    // Add click listeners to segments
    newControl.querySelectorAll(".segment-option").forEach(option => {
      option.addEventListener("click", async (e) => {
        e.preventDefault();
        const targetLang = option.getAttribute("data-lang");

        // Don't do anything if already active
        if (option.classList.contains("active")) return;

        try {
          await i18next.changeLanguage(targetLang);
          updateToggleUI(targetLang);
          this.updateTranslations();
          this.updateCurrentDate();
        } catch (err) {
          console.error("Failed to switch language:", err);
        }
      });
    });
  }

  updateTranslations() {
    // Update all elements with data-i18n
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const translated = i18next.t(key);
      if (translated) {
        el.textContent = translated;
      }
    });
    // Update all elements with data-i18n-placeholder
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const translated = i18next.t(key);
      if (translated) {
        el.placeholder = translated;
      }
    });
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.dashboardController = new DashboardController();
});

// Export for use in other modules
window.DashboardController = DashboardController;
