require('dotenv').config();

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const { connectDB } = require('./config/database');

const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const analysisRoutes = require('./routes/analysis');
const tenantRoutes = require('./routes/tenants');
const propertyRoutes = require('./routes/properties');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize MongoDB connection
let dbConnectionPromise = null;

// Function to ensure database connection
const ensureDBConnection = async () => {
  if (!dbConnectionPromise) {
    dbConnectionPromise = connectDB();
  }
  return dbConnectionPromise;
};

// Connect to MongoDB on startup (but don't block server start)
ensureDBConnection().catch(console.error);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://*.cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://*.cdn.jsdelivr.net", "data:"],
      connectSrc: ["'self'", "blob:"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"]
    }
  }
}));
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'rental-management-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Static files
app.use(express.static('public'));

// Create uploads directory if it doesn't exist (only in non-serverless environments)
const isServerless = process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY;
if (!isServerless) {
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

// Database connection middleware for API routes
const dbMiddleware = async (req, res, next) => {
  try {
    await ensureDBConnection();
    next();
  } catch (error) {
    console.error('Database connection failed in middleware:', error);
    res.status(503).json({ 
      success: false, 
      error: 'Database temporarily unavailable. Please try again in a moment.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Routes
app.use('/auth', authRoutes);
app.use('/upload', uploadRoutes);
app.use('/analysis', analysisRoutes);
app.use('/api/tenants', dbMiddleware, tenantRoutes);
app.use('/api/properties', dbMiddleware, propertyRoutes);

// Serve PDF files
app.get('/pdf/:filename', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // In serverless environment, files are not persisted after upload
  // Return a message explaining this limitation
  if (isServerless) {
    return res.status(404).json({ 
      error: 'PDF viewing not available in serverless mode',
      message: 'Files are processed in memory and not persisted for viewing'
    });
  }
  
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline');
  
  try {
    const pdfBuffer = fs.readFileSync(filePath);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error serving PDF:', error);
    res.status(500).json({ error: 'Error loading PDF file' });
  }
});

// Dashboard route - redirect to static file
app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  // Force redirect to static dashboard.html
  return res.redirect(301, '/dashboard.html');
});

// Main route
app.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  
  try {
    // Try to load dashboard.html with improved path resolution
    let dashboardHtml;
    
    // In serverless environment, try relative to function location
    const possiblePaths = isServerless ? [
      path.resolve(__dirname, '../../public/dashboard.html'),
      path.resolve(process.cwd(), 'public/dashboard.html'),
      'public/dashboard.html'
    ] : [
      path.join(__dirname, 'public', 'dashboard.html'),
      path.join(process.cwd(), 'public', 'dashboard.html'),
      './public/dashboard.html',
      'public/dashboard.html'
    ];
    
    console.log('Environment:', isServerless ? 'serverless' : 'local');
    console.log('__dirname:', __dirname);
    console.log('process.cwd():', process.cwd());
    
    for (const filePath of possiblePaths) {
      try {
        console.log('Trying path:', filePath);
        if (fs.existsSync(filePath)) {
          dashboardHtml = fs.readFileSync(filePath, 'utf8');
          console.log('Successfully loaded dashboard.html from:', filePath);
          break;
        } else {
          console.log('Path does not exist:', filePath);
        }
      } catch (e) {
        console.log('Error loading from path:', filePath, 'error:', e.message);
      }
    }
    
    if (!dashboardHtml) {
      // Fallback to a simple dashboard HTML
      dashboardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - Rental Management Platform [SERVER.JS FALLBACK]</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet">
    <style>
        .sidebar {
            background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
        }
        .nav-link {
            color: rgba(255, 255, 255, 0.8);
            transition: all 0.3s ease;
        }
        .nav-link:hover, .nav-link.active {
            color: white;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
        }
        .main-content {
            background: #f8f9fa;
            min-height: 100vh;
        }
        .card {
            border: none;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
            transition: transform 0.2s ease;
        }
        .card:hover {
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container-fluid">
        <div class="row">
            <!-- Sidebar -->
            <div class="col-md-3 col-lg-2 sidebar">
                <div class="p-3">
                    <h4 class="mb-4">
                        <i class="bi bi-building me-2"></i>
                        Rental Hub
                    </h4>
                    <nav class="nav flex-column">
                        <a class="nav-link active" href="#" data-section="dashboard">
                            <i class="bi bi-speedometer2 me-2"></i>Dashboard
                        </a>
                        <a class="nav-link" href="#" data-section="contract-analysis">
                            <i class="bi bi-file-earmark-text me-2"></i>Contract Analysis
                        </a>
                        <a class="nav-link" href="#" data-section="properties">
                            <i class="bi bi-building me-2"></i>Properties
                        </a>
                        <a class="nav-link" href="#" data-section="tenants">
                            <i class="bi bi-people me-2"></i>Tenants
                        </a>
                    </nav>
                    <hr class="my-4">
                    <div class="user-info">
                        <small class="text-light opacity-75">Logged in as:</small>
                        <div class="fw-bold">Admin User</div>
                        <button class="btn btn-outline-light btn-sm mt-2" onclick="logout()">
                            <i class="bi bi-box-arrow-right me-1"></i>Logout
                        </button>
                    </div>
                </div>
            </div>

            <!-- Main Content -->
            <div class="col-md-9 col-lg-10 main-content">
                <!-- Dashboard Section -->
                <div id="dashboard-section" class="content-section">
                    <div class="p-4">
                        <div class="d-flex justify-content-between align-items-center mb-4">
                            <h2>Dashboard <small class="text-danger">[SERVER.JS FALLBACK VERSION]</small></h2>
                            <div class="text-muted">
                                <i class="bi bi-calendar me-1"></i>
                                <span id="currentDate"></span>
                            </div>
                        </div>

                    <!-- Stats Cards -->
                    <div class="row mb-4">
                        <div class="col-md-3">
                            <div class="card">
                                <div class="card-body text-center">
                                    <i class="bi bi-file-text display-4 text-primary mb-3"></i>
                                    <h5>Contracts Analyzed</h5>
                                    <h3 class="text-primary">0</h3>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card">
                                <div class="card-body text-center">
                                    <i class="bi bi-exclamation-triangle display-4 text-warning mb-3"></i>
                                    <h5>Issues Found</h5>
                                    <h3 class="text-warning">0</h3>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card">
                                <div class="card-body text-center">
                                    <i class="bi bi-shield-check display-4 text-success mb-3"></i>
                                    <h5>Clean Contracts</h5>
                                    <h3 class="text-success">0</h3>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card">
                                <div class="card-body text-center">
                                    <i class="bi bi-clock display-4 text-info mb-3"></i>
                                    <h5>Avg Analysis Time</h5>
                                    <h3 class="text-info">2.3s</h3>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Feature Cards -->
                    <div class="row">
                        <div class="col-md-4">
                            <div class="card feature-card h-100" data-section="contract-analysis" style="cursor: pointer;">
                                <div class="card-body text-center">
                                    <i class="bi bi-file-earmark-text display-3 text-primary mb-3"></i>
                                    <h5>Contract Analysis</h5>
                                    <p class="text-muted">Upload and analyze tenancy agreements for potentially unfavorable terms</p>
                                    <span class="badge bg-primary">Available Now</span>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card feature-card h-100" data-section="properties" style="cursor: pointer;">
                                <div class="card-body text-center">
                                    <i class="bi bi-building display-3 text-success mb-3"></i>
                                    <h5>Property Management</h5>
                                    <p class="text-muted">Manage your rental properties and track performance</p>
                                    <span class="badge bg-success">Available Now</span>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card feature-card h-100" data-section="tenants" style="cursor: pointer;">
                                <div class="card-body text-center">
                                    <i class="bi bi-people display-3 text-info mb-3"></i>
                                    <h5>Tenant Management</h5>
                                    <p class="text-muted">Manage tenant information and property assignments</p>
                                    <span class="badge bg-info">Available Now</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>

                <!-- Contract Analysis Section -->
                <div id="contract-analysis-section" class="content-section" style="display: none;">
                    <div class="p-4">
                        <div class="d-flex justify-content-between align-items-center mb-4">
                            <h2>Contract Analysis</h2>
                            <button class="btn btn-outline-secondary" onclick="showSection('dashboard')">
                                <i class="bi bi-arrow-left me-1"></i>Back to Dashboard
                            </button>
                        </div>

                        <!-- Upload Area -->
                        <div class="row">
                            <div class="col-lg-8">
                                <div class="card mb-4">
                                    <div class="card-body">
                                        <h5 class="card-title mb-3">
                                            <i class="bi bi-cloud-upload me-2"></i>Upload Tenancy Agreement
                                        </h5>
                                        <div class="upload-area" id="uploadArea" style="border: 2px dashed #dee2e6; border-radius: 15px; padding: 3rem; text-align: center; cursor: pointer;">
                                            <i class="bi bi-file-earmark-pdf display-1 text-muted mb-3"></i>
                                            <h6>Drag & Drop PDF here or click to browse</h6>
                                            <p class="text-muted mb-3">Maximum file size: 10MB</p>
                                            <input type="file" id="fileInput" accept=".pdf" style="display: none;">
                                            <button class="btn btn-primary" onclick="document.getElementById('fileInput').click()">
                                                <i class="bi bi-folder me-2"></i>Choose File
                                            </button>
                                        </div>
                                        <div id="uploadProgress" class="mt-3" style="display: none;">
                                            <div class="progress">
                                                <div class="progress-bar" role="progressbar" style="width: 0%"></div>
                                            </div>
                                        </div>
                                        <div id="uploadSuccess" class="alert alert-success mt-3" style="display: none;">
                                            <i class="bi bi-check-circle me-2"></i>
                                            <span>File uploaded successfully!</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-lg-4">
                                <div class="card">
                                    <div class="card-body">
                                        <h6 class="card-title">
                                            <i class="bi bi-info-circle me-2"></i>Analysis Criteria
                                        </h6>
                                        <small class="text-muted">Our AI analyzes contracts for:</small>
                                        <ul class="list-unstyled mt-2 small">
                                            <li><i class="bi bi-check text-success me-1"></i> Mandatory service providers</li>
                                            <li><i class="bi bi-check text-success me-1"></i> Excessive deposits</li>
                                            <li><i class="bi bi-check text-success me-1"></i> Subletting restrictions</li>
                                            <li><i class="bi bi-check text-success me-1"></i> Pet policies</li>
                                            <li><i class="bi bi-check text-success me-1"></i> Modification restrictions</li>
                                            <li><i class="bi bi-check text-success me-1"></i> Early termination penalties</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Analysis Results -->
                        <div id="analysisResults" style="display: none;">
                            <div class="card">
                                <div class="card-header d-flex justify-content-between align-items-center">
                                    <h5 class="mb-0">
                                        <i class="bi bi-clipboard-data me-2"></i>Analysis Results
                                    </h5>
                                </div>
                                <div class="card-body">
                                    <!-- Summary -->
                                    <div class="row mb-4">
                                        <div class="col-md-3">
                                            <div class="text-center">
                                                <h4 class="text-primary">4</h4>
                                                <small class="text-muted">Total Issues</small>
                                            </div>
                                        </div>
                                        <div class="col-md-3">
                                            <div class="text-center">
                                                <h4 class="text-danger">2</h4>
                                                <small class="text-muted">High Risk</small>
                                            </div>
                                        </div>
                                        <div class="col-md-3">
                                            <div class="text-center">
                                                <h4 class="text-warning">2</h4>
                                                <small class="text-muted">Medium Risk</small>
                                            </div>
                                        </div>
                                        <div class="col-md-3">
                                            <div class="text-center">
                                                <h4 class="text-info">0</h4>
                                                <small class="text-muted">Low Risk</small>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Note about serverless limitations -->
                                    <div class="alert alert-info">
                                        <i class="bi bi-info-circle me-2"></i>
                                        <strong>Note:</strong> PDF viewing is not available in serverless mode. Files are processed in memory for analysis only.
                                    </div>

                                    <!-- Issues List -->
                                    <div class="row">
                                        <div class="col-12">
                                            <h6>Issues Found</h6>
                                            <div style="max-height: 400px; overflow-y: auto;">
                                                <!-- Issue 1 -->
                                                <div class="card mb-3" style="border-left: 4px solid #dc3545;">
                                                    <div class="card-body">
                                                        <div class="d-flex justify-content-between align-items-start">
                                                            <h6 class="card-title">
                                                                <i class="bi bi-exclamation-triangle me-2"></i>
                                                                Early Termination Penalties
                                                            </h6>
                                                            <span class="badge" style="background-color: #dc3545;">HIGH</span>
                                                        </div>
                                                        <p class="card-text">Excessive penalties for early termination</p>
                                                        <small class="text-muted">Category: FINANCIAL</small>
                                                        <div class="mt-2">
                                                            <strong>Found in contract:</strong>
                                                            <div class="bg-light p-2 rounded mt-1">
                                                                <small>"security deposit shall be absolutely forfeited if tenant prematurely terminates this agreement..."</small>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <!-- Issue 2 -->
                                                <div class="card mb-3" style="border-left: 4px solid #dc3545;">
                                                    <div class="card-body">
                                                        <div class="d-flex justify-content-between align-items-start">
                                                            <h6 class="card-title">
                                                                <i class="bi bi-exclamation-triangle me-2"></i>
                                                                Excessive Security Deposit
                                                            </h6>
                                                            <span class="badge" style="background-color: #dc3545;">HIGH</span>
                                                        </div>
                                                        <p class="card-text">Security deposit exceeds standard 2 months rent</p>
                                                        <small class="text-muted">Category: FINANCIAL</small>
                                                    </div>
                                                </div>

                                                <!-- Issue 3 -->
                                                <div class="card mb-3" style="border-left: 4px solid #fd7e14;">
                                                    <div class="card-body">
                                                        <div class="d-flex justify-content-between align-items-start">
                                                            <h6 class="card-title">
                                                                <i class="bi bi-exclamation-triangle me-2"></i>
                                                                Mandatory AC Service Provider
                                                            </h6>
                                                            <span class="badge" style="background-color: #fd7e14;">MEDIUM</span>
                                                        </div>
                                                        <p class="card-text">Landlord forces tenant to use specific AC service provider</p>
                                                        <small class="text-muted">Category: RESTRICTIONS</small>
                                                        <div class="mt-2">
                                                            <strong>Found in contract:</strong>
                                                            <div class="bg-light p-2 rounded mt-1">
                                                                <small>"tenant shall bear the cost of any repairs to the air-conditioning contractor referred by the landlord..."</small>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <!-- Issue 4 -->
                                                <div class="card mb-3" style="border-left: 4px solid #fd7e14;">
                                                    <div class="card-body">
                                                        <div class="d-flex justify-content-between align-items-start">
                                                            <h6 class="card-title">
                                                                <i class="bi bi-exclamation-triangle me-2"></i>
                                                                Subletting Restrictions
                                                            </h6>
                                                            <span class="badge" style="background-color: #fd7e14;">MEDIUM</span>
                                                        </div>
                                                        <p class="card-text">Tenant prohibited from subletting or assigning tenancy</p>
                                                        <small class="text-muted">Category: RESTRICTIONS</small>
                                                        <div class="mt-2">
                                                            <strong>Found in contract:</strong>
                                                            <div class="bg-light p-2 rounded mt-1">
                                                                <small>"tenant shall not assign, sublet, or part with the possession of the demised premises..."</small>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Property Management Section -->
                <div id="properties-section" class="content-section" style="display: none;">
                    <div class="p-4">
                        <div class="d-flex justify-content-between align-items-center mb-4">
                            <h2>Property Management</h2>
                            <button class="btn btn-outline-secondary" onclick="showSection('dashboard')">
                                <i class="bi bi-arrow-left me-1"></i>Back to Dashboard
                            </button>
                        </div>

                        <!-- Property Management Controls -->
                        <div class="row mb-4">
                            <div class="col-md-6">
                                <button class="btn btn-primary" onclick="showAddPropertyModal()">
                                    <i class="bi bi-plus-circle me-2"></i>Add New Property
                                </button>
                            </div>
                            <div class="col-md-6">
                                <div class="input-group">
                                    <input type="text" class="form-control" id="propertySearch" placeholder="Search properties...">
                                    <button class="btn btn-outline-secondary" onclick="searchProperties()">
                                        <i class="bi bi-search"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Properties List -->
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0">
                                    <i class="bi bi-building me-2"></i>Properties
                                </h5>
                            </div>
                            <div class="card-body">
                                <div id="propertiesContainer">
                                    <div class="text-center py-4">
                                        <div class="spinner-border" role="status">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
                                        <p class="mt-2">Loading properties...</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tenant Portal Section -->
                <div id="tenants-section" class="content-section" style="display: none;">
                    <div class="p-4">
                        <div class="d-flex justify-content-between align-items-center mb-4">
                            <h2>Tenant Management</h2>
                            <button class="btn btn-outline-secondary" onclick="showSection('dashboard')">
                                <i class="bi bi-arrow-left me-1"></i>Back to Dashboard
                            </button>
                        </div>

                        <!-- Tenant Management Controls -->
                        <div class="row mb-4">
                            <div class="col-md-6">
                                <button class="btn btn-primary" onclick="showAddTenantModal()">
                                    <i class="bi bi-person-plus me-2"></i>Add New Tenant
                                </button>
                            </div>
                            <div class="col-md-6">
                                <div class="input-group">
                                    <input type="text" class="form-control" id="tenantSearch" placeholder="Search tenants...">
                                    <button class="btn btn-outline-secondary" onclick="searchTenants()">
                                        <i class="bi bi-search"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Tenants List -->
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0">
                                    <i class="bi bi-people me-2"></i>Tenants
                                </h5>
                            </div>
                            <div class="card-body">
                                <div id="tenantsContainer">
                                    <div class="text-center py-4">
                                        <div class="spinner-border" role="status">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
                                        <p class="mt-2">Loading tenants...</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Initialize date and setup navigation
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 PRODUCTION DEBUG (SERVER): DOMContentLoaded fired');
            console.log('🚀 PRODUCTION DEBUG (SERVER): Current URL:', window.location.href);
            console.log('🚀 PRODUCTION DEBUG (SERVER): User Agent:', navigator.userAgent);
            console.log('🚀 PRODUCTION DEBUG (SERVER): Starting setup functions...');
            
            const now = new Date();
            document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            try {
                setupNavigation();
                console.log('✅ PRODUCTION DEBUG (SERVER): setupNavigation completed');
            } catch (e) {
                console.error('❌ PRODUCTION DEBUG (SERVER): setupNavigation failed:', e);
            }
            
            try {
                setupFeatureCards();
                console.log('✅ PRODUCTION DEBUG (SERVER): setupFeatureCards completed');
            } catch (e) {
                console.error('❌ PRODUCTION DEBUG (SERVER): setupFeatureCards failed:', e);
            }
            
            try {
                setupFileUpload();
                console.log('✅ PRODUCTION DEBUG (SERVER): setupFileUpload completed');
            } catch (e) {
                console.error('❌ PRODUCTION DEBUG (SERVER): setupFileUpload failed:', e);
            }
            
            console.log('🚀 PRODUCTION DEBUG (SERVER): All setup functions completed');
        });

        function setupNavigation() {
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const section = this.getAttribute('data-section');
                    if (section) {
                        showSection(section);
                        
                        // Update active nav link
                        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                        this.classList.add('active');
                    }
                });
            });
        }

        function setupFeatureCards() {
            console.log('🎯 PRODUCTION DEBUG (SERVER): setupFeatureCards called');
            
            // Check if feature cards exist
            const featureCards = document.querySelectorAll('[data-section].feature-card');
            console.log('🎯 PRODUCTION DEBUG (SERVER): Found feature cards:', featureCards.length);
            featureCards.forEach(function(card, index) {
                console.log('🎯 PRODUCTION DEBUG (SERVER): Card ' + index + ':', {
                    section: card.getAttribute('data-section'),
                    hasFeatureCardClass: card.classList.contains('feature-card'),
                    classList: Array.from(card.classList)
                });
            });
            
            // Add click handlers for feature cards using event delegation
            document.addEventListener('click', function(e) {
                console.log('🎯 PRODUCTION DEBUG (SERVER): Click detected on:', e.target);
                
                const featureCard = e.target.closest('[data-section]');
                console.log('🎯 PRODUCTION DEBUG (SERVER): Closest data-section element:', featureCard);
                
                if (featureCard) {
                    console.log('🎯 PRODUCTION DEBUG (SERVER): Feature card found:', {
                        section: featureCard.getAttribute('data-section'),
                        hasFeatureCardClass: featureCard.classList.contains('feature-card'),
                        classList: Array.from(featureCard.classList)
                    });
                    
                    if (featureCard.classList.contains('feature-card')) {
                        const section = featureCard.getAttribute('data-section');
                        console.log('🎯 PRODUCTION DEBUG (SERVER): Feature card clicked: ' + section);
                        alert('SERVER.JS FALLBACK: Clicked section: ' + section + ' - This should not appear if redirect is working!');
                        showSection(section);
                        
                        // Load data for specific sections
                        if (section === 'properties') {
                            loadProperties();
                        } else if (section === 'tenants') {
                            loadTenants();
                        }
                    } else {
                        console.log('🎯 PRODUCTION DEBUG (SERVER): Element has data-section but not feature-card class');
                    }
                } else {
                    console.log('🎯 PRODUCTION DEBUG (SERVER): No data-section element found in click path');
                }
            });
            
            console.log('🎯 PRODUCTION DEBUG (SERVER): Event delegation listener added');
        }

        function showSection(sectionName) {
            console.log('showSection called with:', sectionName);
            
            // Hide all sections
            document.querySelectorAll('.content-section').forEach(section => {
                section.style.display = 'none';
            });
            
            // Show target section
            const targetSection = document.getElementById(sectionName + '-section');
            if (targetSection) {
                targetSection.style.display = 'block';
                console.log('Section displayed:', sectionName);
            } else {
                console.error('Section not found:', sectionName + '-section');
            }
            
            // Update active nav link
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            const navLink = document.querySelector('.nav-link[data-section="' + sectionName + '"]');
            if (navLink) {
                navLink.classList.add('active');
            }
        }

        function setupFileUpload() {
            const uploadArea = document.getElementById('uploadArea');
            const fileInput = document.getElementById('fileInput');

            if (!uploadArea || !fileInput) return;

            // Click to upload
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });

            // File input change
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleFileUpload(e.target.files[0]);
                }
            });
        }

        async function handleFileUpload(file) {
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
            const successAlert = document.getElementById('uploadSuccess');
            
            progressContainer.style.display = 'block';
            progressBar.style.width = '0%';
            successAlert.style.display = 'none';

            try {
                // Simulate progress
                let progress = 0;
                const progressInterval = setInterval(() => {
                    progress += 10;
                    progressBar.style.width = progress + '%';
                    if (progress >= 90) {
                        clearInterval(progressInterval);
                    }
                }, 100);

                const response = await fetch('/upload/tenancy-agreement', {
                    method: 'POST',
                    body: formData
                });

                clearInterval(progressInterval);
                progressBar.style.width = '100%';

                const result = await response.json();
                
                if (result.success) {
                    successAlert.style.display = 'block';
                    
                    // Trigger actual analysis
                    setTimeout(() => {
                        analyzeContract(result.file.filename);
                    }, 1000);
                } else {
                    throw new Error(result.error || 'Upload failed');
                }
            } catch (error) {
                alert('Upload failed: ' + error.message);
                progressContainer.style.display = 'none';
            }
        }

        async function analyzeContract(filename) {
            try {
                const response = await fetch('/analysis/analyze', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ filename: filename })
                });

                const result = await response.json();
                
                if (result.success) {
                    displayAnalysisResults(result);
                } else {
                    throw new Error(result.error || 'Analysis failed');
                }
            } catch (error) {
                console.error('Analysis failed:', error);
                alert('Analysis failed: ' + error.message);
            }
        }

        function displayAnalysisResults(data) {
            const summary = data.analysis.summary;
            const issues = data.analysis.keywordAnalysis;

            // Update summary counts
            document.querySelector('.text-center h4.text-primary').textContent = summary.totalIssues;
            document.querySelector('.text-center h4.text-danger').textContent = summary.highSeverity;
            document.querySelector('.text-center h4.text-warning').textContent = summary.mediumSeverity;
            document.querySelector('.text-center h4.text-info').textContent = summary.lowSeverity;

            // Update issues list
            const issuesContainer = document.querySelector('#analysisResults .card-body');
            let issuesHtml = '';

            if (issues.length === 0) {
                issuesHtml = '<div class="row mb-4">' +
                    '<div class="col-md-3"><div class="text-center"><h4 class="text-primary">0</h4><small class="text-muted">Total Issues</small></div></div>' +
                    '<div class="col-md-3"><div class="text-center"><h4 class="text-danger">0</h4><small class="text-muted">High Risk</small></div></div>' +
                    '<div class="col-md-3"><div class="text-center"><h4 class="text-warning">0</h4><small class="text-muted">Medium Risk</small></div></div>' +
                    '<div class="col-md-3"><div class="text-center"><h4 class="text-info">0</h4><small class="text-muted">Low Risk</small></div></div>' +
                    '</div>' +
                    '<div class="alert alert-success">' +
                    '<i class="bi bi-check-circle me-2"></i>No major issues found in this tenancy agreement.' +
                    '</div>';
            } else {
                // Build summary row
                issuesHtml = '<div class="row mb-4">' +
                    '<div class="col-md-3"><div class="text-center"><h4 class="text-primary">' + summary.totalIssues + '</h4><small class="text-muted">Total Issues</small></div></div>' +
                    '<div class="col-md-3"><div class="text-center"><h4 class="text-danger">' + summary.highSeverity + '</h4><small class="text-muted">High Risk</small></div></div>' +
                    '<div class="col-md-3"><div class="text-center"><h4 class="text-warning">' + summary.mediumSeverity + '</h4><small class="text-muted">Medium Risk</small></div></div>' +
                    '<div class="col-md-3"><div class="text-center"><h4 class="text-info">' + summary.lowSeverity + '</h4><small class="text-muted">Low Risk</small></div></div>' +
                    '</div>' +
                    '<div class="alert alert-info">' +
                    '<i class="bi bi-info-circle me-2"></i><strong>Note:</strong> PDF viewing is not available in serverless mode. Files are processed in memory for analysis only.' +
                    '</div>' +
                    '<div class="row"><div class="col-12"><h6>Issues Found</h6><div style="max-height: 400px; overflow-y: auto;">';

                // Add each issue
                issues.forEach(issue => {
                    const severityColor = issue.severity === 'high' ? '#dc3545' : 
                                        issue.severity === 'medium' ? '#fd7e14' : '#ffc107';
                    
                    issuesHtml += '<div class="card mb-3" style="border-left: 4px solid ' + severityColor + ';">' +
                        '<div class="card-body">' +
                        '<div class="d-flex justify-content-between align-items-start">' +
                        '<h6 class="card-title"><i class="bi bi-exclamation-triangle me-2"></i>' + issue.name + '</h6>' +
                        '<span class="badge" style="background-color: ' + severityColor + ';">' + issue.severity.toUpperCase() + '</span>' +
                        '</div>' +
                        '<p class="card-text">' + issue.description + '</p>' +
                        '<small class="text-muted">Category: ' + issue.category.replace('_', ' ').toUpperCase() + '</small>';
                    
                    if (issue.snippets && issue.snippets.length > 0) {
                        issuesHtml += '<div class="mt-2"><strong>Found in contract:</strong>' +
                            '<div class="bg-light p-2 rounded mt-1">' +
                            '<small>"' + issue.snippets[0].substring(0, 200) + '..."</small>' +
                            '</div></div>';
                    }
                    
                    issuesHtml += '</div></div>';
                });

                issuesHtml += '</div></div></div>';
            }

            issuesContainer.innerHTML = issuesHtml;
            document.getElementById('analysisResults').style.display = 'block';
        }

        // Property Management Functions
        async function loadProperties() {
            try {
                const response = await fetch('/api/properties');
                const result = await response.json();
                
                if (result.success) {
                    displayProperties(result.properties);
                } else {
                    document.getElementById('propertiesContainer').innerHTML = 
                        '<div class="alert alert-danger">Failed to load properties: ' + result.error + '</div>';
                }
            } catch (error) {
                console.error('Error loading properties:', error);
                document.getElementById('propertiesContainer').innerHTML = 
                    '<div class="alert alert-danger">Error loading properties: ' + error.message + '</div>';
            }
        }

        function displayProperties(properties) {
            const container = document.getElementById('propertiesContainer');
            
            if (!properties || properties.length === 0) {
                container.innerHTML = '<div class="alert alert-info">No properties found. Add your first property to get started!</div>';
                return;
            }

            let html = '<div class="table-responsive"><table class="table table-hover">';
            html += '<thead><tr><th>Property ID</th><th>Address</th><th>Unit</th><th>Rent</th><th>Max Pax</th><th>Actions</th></tr></thead><tbody>';
            
            properties.forEach(property => {
                html += '<tr>';
                html += '<td><strong>' + property.propertyId + '</strong></td>';
                html += '<td>' + property.address + '</td>';
                html += '<td>' + property.unit + '</td>';
                html += '<td>$' + (property.rent || 0).toLocaleString() + '</td>';
                html += '<td>' + property.maxPax + '</td>';
                html += '<td>';
                html += '<button class="btn btn-sm btn-outline-primary me-1" onclick="editProperty(\'' + property.propertyId + '\')">Edit</button>';
                html += '<button class="btn btn-sm btn-outline-danger" onclick="deleteProperty(\'' + property.propertyId + '\')">Delete</button>';
                html += '</td>';
                html += '</tr>';
            });
            
            html += '</tbody></table></div>';
            container.innerHTML = html;
        }

        // Tenant Management Functions
        async function loadTenants() {
            try {
                const response = await fetch('/api/tenants');
                const result = await response.json();
                
                if (result.success) {
                    displayTenants(result.tenants);
                } else {
                    document.getElementById('tenantsContainer').innerHTML = 
                        '<div class="alert alert-danger">Failed to load tenants: ' + result.error + '</div>';
                }
            } catch (error) {
                console.error('Error loading tenants:', error);
                document.getElementById('tenantsContainer').innerHTML = 
                    '<div class="alert alert-danger">Error loading tenants: ' + error.message + '</div>';
            }
        }

        function displayTenants(tenants) {
            const container = document.getElementById('tenantsContainer');
            
            if (!tenants || tenants.length === 0) {
                container.innerHTML = '<div class="alert alert-info">No tenants found. Add your first tenant to get started!</div>';
                return;
            }

            let html = '<div class="table-responsive"><table class="table table-hover">';
            html += '<thead><tr><th>Name</th><th>FIN</th><th>Passport</th><th>Properties</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
            
            tenants.forEach(tenant => {
                html += '<tr>';
                html += '<td><strong>' + tenant.name + '</strong></td>';
                html += '<td>' + tenant.fin + '</td>';
                html += '<td>' + tenant.passportNumber + '</td>';
                html += '<td>' + (tenant.properties && tenant.properties.length > 0 ? tenant.properties.join(', ') : 'None') + '</td>';
                html += '<td>';
                if (tenant.isMainTenant) html += '<span class="badge bg-primary me-1">Main Tenant</span>';
                if (tenant.isRegistered) html += '<span class="badge bg-success">Registered</span>';
                if (!tenant.isMainTenant && !tenant.isRegistered) html += '<span class="badge bg-secondary">Regular</span>';
                html += '</td>';
                html += '<td>';
                html += '<button class="btn btn-sm btn-outline-primary me-1" onclick="editTenant(\'' + tenant.fin + '\')">Edit</button>';
                html += '<button class="btn btn-sm btn-outline-danger" onclick="deleteTenant(\'' + tenant.fin + '\')">Delete</button>';
                html += '</td>';
                html += '</tr>';
            });
            
            html += '</tbody></table></div>';
            container.innerHTML = html;
        }

        // Placeholder functions for modal operations
        function showAddPropertyModal() {
            alert('Add Property modal would open here. This requires additional modal HTML implementation.');
        }

        function showAddTenantModal() {
            alert('Add Tenant modal would open here. This requires additional modal HTML implementation.');
        }

        function editProperty(propertyId) {
            alert('Edit property: ' + propertyId + '. This requires additional modal HTML implementation.');
        }

        function editTenant(fin) {
            alert('Edit tenant: ' + fin + '. This requires additional modal HTML implementation.');
        }

        function deleteProperty(propertyId) {
            if (confirm('Are you sure you want to delete property ' + propertyId + '?')) {
                // Implementation would go here
                alert('Delete property functionality needs to be implemented.');
            }
        }

        function deleteTenant(fin) {
            if (confirm('Are you sure you want to delete tenant ' + fin + '?')) {
                // Implementation would go here
                alert('Delete tenant functionality needs to be implemented.');
            }
        }

        function searchProperties() {
            const searchTerm = document.getElementById('propertySearch').value.toLowerCase();
            // Implementation would filter the displayed properties
            alert('Search properties: ' + searchTerm + '. This feature needs implementation.');
        }

        function searchTenants() {
            const searchTerm = document.getElementById('tenantSearch').value.toLowerCase();
            // Implementation would filter the displayed tenants
            alert('Search tenants: ' + searchTerm + '. This feature needs implementation.');
        }

        async function logout() {
            try {
                const response = await fetch('/auth/logout', { method: 'POST' });
                const result = await response.json();
                
                if (result.success) {
                    window.location.href = result.redirectUrl;
                }
            } catch (error) {
                console.error('Logout failed:', error);
                window.location.href = '/auth/login';
            }
        }
    </script>
</body>
</html>`;
      console.log('Using fallback embedded HTML for dashboard');
    }
    
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHtml);
  } catch (error) {
    console.error('Error serving dashboard:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Only start server if not in serverless environment
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Rental Management Platform running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔐 Login: http://localhost:${PORT}/auth/login`);
  });
}

module.exports = app;