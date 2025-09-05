/**
 * jsPDF Library Loader
 * Loads jsPDF from local npm dependency
 */

import { jsPDF } from 'jspdf';

// Make jsPDF available globally for the contract component
window.jsPDF = jsPDF;

console.log('✅ jsPDF loaded successfully from npm dependency');