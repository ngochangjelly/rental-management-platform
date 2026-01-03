/**
 * PDF.js loader and configuration utility
 * Imports and configures PDF.js for use in the application
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker source from CDN (matches the npm package version)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// Export the configured PDF.js library
export { pdfjsLib };

// Make it globally available for compatibility with existing code
if (typeof window !== 'undefined') {
  window.pdfjsLib = pdfjsLib;
}
