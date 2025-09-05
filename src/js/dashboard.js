// Dashboard entry point
import './config.js';
import './lib/html2canvas-loader.js'; // Load html2canvas locally
import './lib/jspdf-loader.js'; // Load jsPDF for PDF export
import './components/toast/toast.js';
import './components/contract-analysis.js';
import './components/property-management.js';
import './components/tenant-management.js';
import './components/contract-management.js';
import './components/financial-reports.js';
import './components/investor-management.js';
import './dashboard-controller.js';

// Suppress MetaMask-related errors that don't affect our application
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && 
      (event.reason.message.includes('MetaMask') || 
       event.reason.message.includes('ethereum') ||
       event.reason.message.includes('Failed to connect to MetaMask'))) {
    console.warn('Suppressed MetaMask error (unrelated to rental management):', event.reason.message);
    event.preventDefault();
  }
});

// Also catch regular errors from extensions
window.addEventListener('error', (event) => {
  if (event.message && 
      (event.message.includes('MetaMask') || 
       event.message.includes('ethereum') ||
       event.message.includes('Failed to connect to MetaMask') ||
       event.filename?.includes('chrome-extension') ||
       event.filename?.includes('inpage.js'))) {
    console.warn('Suppressed extension error (unrelated to rental management):', event.message);
    event.preventDefault();
    return true; // Prevent default error handling
  }
});