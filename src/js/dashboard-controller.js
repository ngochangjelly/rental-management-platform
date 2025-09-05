/**
 * Dashboard Controller
 * Main controller that manages the dashboard sections and components
 */
class DashboardController {
  constructor() {
    this.components = {};
    this.currentSection = "dashboard";
    this.init();
  }

  init() {
    this.updateCurrentDate();
    this.setupNavigation();
    this.setupFeatureCards();
    this.loadUserInfo();
    this.loadDashboardStats();

    // Initialize components when their sections are first accessed
    this.initializeComponentsLazily();
    
    // Preload tenants data on dashboard entry for better UX
    this.preloadTenantData();
  }

  updateCurrentDate() {
    const now = new Date();
    const currentDateEl = document.getElementById("currentDate");
    if (currentDateEl) {
      currentDateEl.textContent = now.toLocaleDateString("en-US", {
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
    }

    // Update active nav link
    document
      .querySelectorAll(".nav-link")
      .forEach((l) => l.classList.remove("active"));
    const navLink = document.querySelector(
      `.nav-link[data-section="${sectionName}"]`
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
          console.log('🏗️ Creating TenantManagementComponent...');
          this.components.tenantManagement = new TenantManagementComponent();
          // Make it globally accessible for button onclick handlers
          window.tenantManager = this.components.tenantManagement;
          console.log('✅ TenantManagementComponent created');
          
          // Load tenants after section is shown
          setTimeout(() => {
            console.log('⏰ Loading tenants after section display...');
            this.components.tenantManagement.loadTenants();
          }, 100);
        } else {
          console.log('♻️ Using preloaded TenantManagementComponent - data already available');
        }
        break;
      case "contracts":
        if (!this.components.contractManagement) {
          console.log('🏗️ Creating ContractManagementComponent...');
          this.components.contractManagement = new ContractManagementComponent();
          // Make it globally accessible for button onclick handlers
          window.contractManager = this.components.contractManagement;
          console.log('✅ ContractManagementComponent created');
          
          // Set up contract form after section is shown
          setTimeout(async () => {
            console.log('⏰ Setting up contract form...');
            await Promise.all([
              this.components.contractManagement.loadTenants(),
              this.components.contractManagement.loadProperties()
            ]);
            this.components.contractManagement.populateTenantsDropdown();
            this.components.contractManagement.populatePropertiesDropdown();
            this.components.contractManagement.setupContractInputs();
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
      case "investors":
        if (!this.components.investorManagement) {
          this.components.investorManagement =
            new InvestorManagementComponent();
          // Make it globally accessible for button onclick handlers
          window.investorManager = this.components.investorManagement;
        }
        break;
    }
  }

  async loadUserInfo() {
    // Placeholder - would load from session/API
    const userInfoEl = document.getElementById("userInfo");
    if (userInfoEl) {
      userInfoEl.textContent = "Admin User";
    }
  }

  async loadDashboardStats() {
    try {
      // Load properties stats
      const propertiesResponse = await API.get(
        API_CONFIG.ENDPOINTS.PROPERTY_STATS
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
    console.log('🚀 Preloading tenant data on dashboard entry...');
    // Initialize tenant management component early
    if (!this.components.tenantManagement) {
      this.components.tenantManagement = new TenantManagementComponent();
      window.tenantManager = this.components.tenantManagement;
      console.log('✅ Tenant management component preloaded');
      
      // Load tenant data immediately
      this.components.tenantManagement.loadTenants();
    }
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.dashboardController = new DashboardController();
});

// Export for use in other modules
window.DashboardController = DashboardController;
