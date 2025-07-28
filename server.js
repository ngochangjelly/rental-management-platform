require('dotenv').config();

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const analysisRoutes = require('./routes/analysis');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
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

// Routes
app.use('/auth', authRoutes);
app.use('/upload', uploadRoutes);
app.use('/analysis', analysisRoutes);

// Serve PDF files
app.get('/pdf/:filename', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
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

// Main route
app.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  
  try {
    // Try multiple possible paths for serverless environment
    let dashboardHtml;
    const possiblePaths = [
      path.join(__dirname, 'public', 'dashboard.html'),
      path.join(process.cwd(), 'public', 'dashboard.html'),
      './public/dashboard.html',
      'public/dashboard.html'
    ];
    
    for (const filePath of possiblePaths) {
      try {
        if (fs.existsSync(filePath)) {
          dashboardHtml = fs.readFileSync(filePath, 'utf8');
          console.log('Successfully loaded dashboard.html from:', filePath);
          break;
        }
      } catch (e) {
        console.log('Failed to load dashboard from path:', filePath);
      }
    }
    
    if (!dashboardHtml) {
      // Fallback to a simple dashboard HTML
      dashboardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - Rental Management Platform</title>
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
                            <i class="bi bi-file-text me-2"></i>Contract Analysis
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
                <div class="p-4">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h2>Dashboard</h2>
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
                            <div class="card h-100">
                                <div class="card-body text-center">
                                    <i class="bi bi-file-earmark-text display-3 text-primary mb-3"></i>
                                    <h5>Contract Analysis</h5>
                                    <p class="text-muted">Upload and analyze tenancy agreements for potentially unfavorable terms</p>
                                    <span class="badge bg-primary">Available Now</span>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card h-100">
                                <div class="card-body text-center">
                                    <i class="bi bi-building display-3 text-secondary mb-3"></i>
                                    <h5>Property Management</h5>
                                    <p class="text-muted">Manage your rental properties and track performance</p>
                                    <span class="badge bg-secondary">Coming Soon</span>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card h-100">
                                <div class="card-body text-center">
                                    <i class="bi bi-people display-3 text-secondary mb-3"></i>
                                    <h5>Tenant Portal</h5>
                                    <p class="text-muted">Allow tenants to submit requests and make payments</p>
                                    <span class="badge bg-secondary">Coming Soon</span>
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
        // Initialize date
        document.addEventListener('DOMContentLoaded', function() {
            const now = new Date();
            document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        });

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