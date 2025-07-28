const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Configure multer for file uploads
const isServerless = process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY;

const storage = isServerless 
  ? multer.memoryStorage() // Use memory storage in serverless
  : multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, 'uploads/');
      },
      filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      }
    });

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  }
});

// Upload tenancy agreement
router.post('/tenancy-agreement', requireAuth, upload.single('agreement'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // In serverless, we'll use a mock filename since files are stored in memory
    const filename = isServerless 
      ? `demo-${Date.now()}.pdf`
      : req.file.filename;

    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        filename: filename,
        originalname: req.file.originalname,
        size: req.file.size,
        path: isServerless ? 'memory' : req.file.path
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

module.exports = router;