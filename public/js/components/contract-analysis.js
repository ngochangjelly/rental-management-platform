/**
 * Contract Analysis Component
 * Handles PDF upload, analysis, and result display
 */
class ContractAnalysisComponent {
    constructor() {
        this.currentPage = 1;
        this.pdfDoc = null;
        this.scale = 1.0;
        this.analysisData = null;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.init();
    }

    init() {
        this.setupFileUpload();
        this.setupPDFControls();
        this.setupEventListeners();
    }

    setupFileUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        if (!uploadArea || !fileInput) return;

        // Click to upload
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileUpload(files[0]);
            }
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        });
    }

    async handleFileUpload(file) {
        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file only.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            alert('File size must be less than 10MB.');
            return;
        }

        const formData = new FormData();
        formData.append('agreement', file);

        // Show progress
        const progressContainer = document.getElementById('uploadProgress');
        const progressBar = progressContainer.querySelector('.progress-bar');
        const analysisProgress = document.getElementById('analysisProgress');
        
        progressContainer.style.display = 'block';
        analysisProgress.style.display = 'block';

        try {
            // Upload file
            const uploadResponse = await fetch('/upload/agreement', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error('Upload failed');
            }

            const uploadResult = await uploadResponse.json();
            console.log('File uploaded:', uploadResult.filename);

            // Analyze uploaded file
            const analysisResponse = await fetch('/analysis/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    filename: uploadResult.filename
                })
            });

            if (!analysisResponse.ok) {
                throw new Error('Analysis failed');
            }

            const result = await analysisResponse.json();
            console.log('Analysis completed:', result);

            // Store analysis data globally
            this.analysisData = result;

            // Display results
            this.displayAnalysisResults(result);

            // Load PDF viewer
            await this.loadPDF(uploadResult.filename);

            // Show download button
            const downloadBtn = document.getElementById('downloadReportBtn');
            if (downloadBtn) {
                downloadBtn.style.display = 'inline-block';
            }

        } catch (error) {
            console.error('Error:', error);
            alert('Error processing file: ' + error.message);
        } finally {
            progressContainer.style.display = 'none';
            analysisProgress.style.display = 'none';
        }
    }

    displayAnalysisResults(data) {
        const resultsContainer = document.getElementById('resultsContainer');
        
        if (!resultsContainer) return;
        
        if (!data.success) {
            resultsContainer.innerHTML = '<div class="alert alert-danger">Analysis failed: ' + data.error + '</div>';
            return;
        }

        const analysis = data.analysis;
        const issues = analysis.keywordAnalysis || [];
        
        let html = '<div class="analysis-results">';
        
        // Summary stats
        html += '<div class="row mb-3">';
        html += '<div class="col-4 text-center"><div class="border rounded p-2"><strong>' + issues.length + '</strong><br><small class="text-muted">Total Issues</small></div></div>';
        html += '<div class="col-4 text-center"><div class="border rounded p-2"><strong>' + issues.filter(i => i.severity === 'HIGH').length + '</strong><br><small class="text-danger">High Risk</small></div></div>';
        html += '<div class="col-4 text-center"><div class="border rounded p-2"><strong>' + issues.filter(i => i.severity === 'MEDIUM').length + '</strong><br><small class="text-warning">Medium Risk</small></div></div>';
        html += '</div>';
        
        if (issues.length === 0) {
            html += '<div class="alert alert-success"><i class="bi bi-check-circle me-2"></i>No issues found in this contract!</div>';
        } else {
            // Group issues by severity
            const highIssues = issues.filter(i => i.severity === 'HIGH');
            const mediumIssues = issues.filter(i => i.severity === 'MEDIUM');
            const lowIssues = issues.filter(i => i.severity === 'LOW');
            
            [
                { title: 'High Risk Issues', issues: highIssues, class: 'danger', icon: 'exclamation-triangle' },
                { title: 'Medium Risk Issues', issues: mediumIssues, class: 'warning', icon: 'exclamation-circle' },
                { title: 'Low Risk Issues', issues: lowIssues, class: 'info', icon: 'info-circle' }
            ].forEach(group => {
                if (group.issues.length > 0) {
                    html += '<div class="alert alert-' + group.class + ' mb-3">';
                    html += '<h6><i class="bi bi-' + group.icon + ' me-2"></i>' + group.title + ' (' + group.issues.length + ')</h6>';
                    html += '<ul class="mb-0">';
                    group.issues.forEach(issue => {
                        html += '<li><strong>' + issue.name + '</strong><br><small>' + issue.description + '</small></li>';
                    });
                    html += '</ul>';
                    html += '</div>';
                }
            });
        }
        
        html += '</div>';
        resultsContainer.innerHTML = html;
    }

    setupPDFControls() {
        // Add event listeners to PDF navigation buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('#nextPageBtn')) {
                this.nextPage();
            }
            if (e.target.closest('#prevPageBtn')) {
                this.previousPage();
            }
        });
    }

    async loadPDF(filename) {
        try {
            console.log('Loading PDF:', filename);
            
            const url = `/pdf/${filename}`;
            console.log('PDF URL:', url);
            
            // Test if PDF endpoint is accessible
            const response = await fetch(url, {
                credentials: 'include'
            });
            console.log('PDF response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`Failed to load PDF: ${response.status}`);
            }
            
            this.pdfDoc = await pdfjsLib.getDocument(url).promise;
            const totalPagesEl = document.getElementById('totalPages');
            if (totalPagesEl) {
                totalPagesEl.textContent = this.pdfDoc.numPages;
            }
            
            await this.renderAllPages();
            console.log('PDF loaded successfully');
        } catch (error) {
            console.error('Error loading PDF:', error);
            // Show error message to user
            const pdfContainer = document.getElementById('pdfContainer');
            if (pdfContainer) {
                pdfContainer.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Unable to load PDF: ${error.message}
                    </div>
                `;
            }
        }
    }

    async renderAllPages() {
        try {
            if (!this.pdfDoc) {
                throw new Error('PDF document not loaded');
            }
            
            const pdfContainer = document.getElementById('pdfContainer');
            if (!pdfContainer) return;
            
            pdfContainer.innerHTML = ''; // Clear existing content
            
            console.log(`Rendering all ${this.pdfDoc.numPages} pages`);
            
            for (let pageNum = 1; pageNum <= this.pdfDoc.numPages; pageNum++) {
                console.log(`Rendering page ${pageNum} of ${this.pdfDoc.numPages}`);
                
                const page = await this.pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: this.scale });
                
                // Create canvas for this page
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.className = 'pdf-canvas';
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                canvas.style.marginBottom = '20px';
                canvas.style.border = '1px solid #ddd';
                
                // Create container for page and highlights
                const pageContainer = document.createElement('div');
                pageContainer.style.position = 'relative';
                pageContainer.style.marginBottom = '20px';
                
                // Create highlight layer for this page
                const highlightLayer = document.createElement('div');
                highlightLayer.className = 'highlight-layer';
                highlightLayer.style.position = 'absolute';
                highlightLayer.style.top = '0';
                highlightLayer.style.left = '0';
                highlightLayer.style.width = viewport.width + 'px';
                highlightLayer.style.height = viewport.height + 'px';
                highlightLayer.style.pointerEvents = 'none';
                
                // Render page
                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport
                };
                
                await page.render(renderContext).promise;
                
                pageContainer.appendChild(canvas);
                pageContainer.appendChild(highlightLayer);
                pdfContainer.appendChild(pageContainer);
                
                console.log(`Page ${pageNum} rendered successfully`);
            }
            
            // Update zoom level display
            const zoomLevelEl = document.getElementById('zoomLevel');
            if (zoomLevelEl) {
                zoomLevelEl.textContent = Math.round(this.scale * 100) + '%';
            }
            
            console.log('All pages rendered successfully');
        } catch (error) {
            console.error('Error rendering pages:', error);
            const pdfContainer = document.getElementById('pdfContainer');
            if (pdfContainer) {
                pdfContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Error rendering pages: ${error.message}
                    </div>
                `;
            }
        }
    }

    previousPage() {
        if (!this.pdfDoc) {
            console.error('PDF not loaded');
            return;
        }
        if (this.currentPage <= 1) {
            console.log('Already on first page');
            return;
        }
        this.currentPage--;
        this.renderPage(this.currentPage);
    }

    nextPage() {
        if (!this.pdfDoc) {
            console.error('PDF not loaded');
            alert('PDF not loaded yet. Please wait for the PDF to load completely.');
            return;
        }
        if (this.currentPage >= this.pdfDoc.numPages) {
            console.log('Already on last page');
            alert('Already on the last page');
            return;
        }
        this.currentPage++;
        this.renderPage(this.currentPage);
    }

    zoomIn() {
        this.scale += 0.2;
        this.renderAllPages();
    }

    zoomOut() {
        if (this.scale <= 0.4) return;
        this.scale -= 0.2;
        this.renderAllPages();
    }

    setupEventListeners() {
        // Download report
        const downloadBtn = document.getElementById('downloadReportBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', async () => {
                if (!this.analysisData) {
                    alert('No analysis data available');
                    return;
                }
                
                try {
                    const response = await fetch('/analysis/report', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify(this.analysisData)
                    });
                    
                    if (response.ok) {
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = 'contract-analysis-report.pdf';
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                    } else {
                        throw new Error('Failed to generate report');
                    }
                } catch (error) {
                    console.error('Error downloading report:', error);
                    alert('Error generating report: ' + error.message);
                }
            });
        }
    }
}

// Export for use in other modules
window.ContractAnalysisComponent = ContractAnalysisComponent;