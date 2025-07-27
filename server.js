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

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
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
  res.sendFile(filePath);
});

// Main route
app.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
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