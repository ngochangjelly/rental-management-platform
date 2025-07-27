const express = require('express');
const path = require('path');
const router = express.Router();

// Hardcoded admin credentials from environment
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'RentalAdmin2024!@#$';

// Login page
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '../public', 'login.html'));
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }

    // Simple authentication against hardcoded credentials
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      req.session.user = {
        id: 1,
        username: ADMIN_USERNAME,
        role: 'admin'
      };
      
      return res.json({ 
        success: true, 
        message: 'Login successful',
        redirectUrl: '/'
      });
    } else {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Could not log out' 
      });
    }
    res.json({ 
      success: true, 
      message: 'Logged out successfully',
      redirectUrl: '/auth/login'
    });
  });
});

// Check authentication status
router.get('/status', (req, res) => {
  res.json({ 
    authenticated: !!req.session.user,
    user: req.session.user || null
  });
});

module.exports = router;