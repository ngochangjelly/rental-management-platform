// Investor Management entry point
import "./i18n.js";
import "./config.js";
import "./components/toast/toast.js";
import "./components/investor-management.js";

// Setup i18n for this page
import i18next from "./i18n.js";

document.addEventListener("DOMContentLoaded", () => {
  // Update translations
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = i18next.t(key);
  });

  // Setup language toggle
  const languageToggle = document.getElementById("languageToggle");
  if (languageToggle) {
    // Set initial flag
    languageToggle.textContent = i18next.language === "vi" ? "🇻🇳" : "🇺🇸";
    languageToggle.addEventListener("click", () => {
      const newLang = i18next.language === "vi" ? "en" : "vi";
      i18next.changeLanguage(newLang).then(() => {
        languageToggle.textContent = newLang === "vi" ? "🇻🇳" : "🇺🇸";
        document.querySelectorAll("[data-i18n]").forEach((el) => {
          const key = el.getAttribute("data-i18n");
          el.textContent = i18next.t(key);
        });
      });
    });
  }
});
