const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();

// Hardcoded admin credentials from environment
const ADMIN_USERNAME = process.env.APP_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.APP_PASSWORD || "RentalAdmin2024!@#$";

// Login page
router.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/");
  }

  try {
    // Try multiple possible paths for serverless environment
    let loginHtml;
    const possiblePaths = [
      path.join(__dirname, "../public", "login.html"),
      path.join(process.cwd(), "public", "login.html"),
      "./public/login.html",
      "public/login.html",
    ];

    for (const filePath of possiblePaths) {
      try {
        if (fs.existsSync(filePath)) {
          loginHtml = fs.readFileSync(filePath, "utf8");
          console.log("Successfully loaded login.html from:", filePath);
          break;
        }
      } catch (e) {
        console.log("Failed to load from path:", filePath);
      }
    }

    if (!loginHtml) {
      // Fallback to embedded HTML
      loginHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Rental Management Platform</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet">
    <style>
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
        }
        .login-card {
            background: white;
            border-radius: 20px;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .login-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }
        .form-control {
            border-radius: 10px;
            border: 2px solid #f8f9fa;
            padding: 12px 20px;
            transition: all 0.3s ease;
        }
        .form-control:focus {
            border-color: #667eea;
            box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
        }
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 10px;
            padding: 12px;
            font-weight: 600;
            transition: transform 0.2s ease;
        }
        .btn-primary:hover {
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-6 col-lg-4">
                <div class="login-card">
                    <div class="login-header">
                        <i class="bi bi-building fs-1 mb-3"></i>
                        <h3>Rental Management</h3>
                        <p class="mb-0">Welcome back! Please sign in to continue.</p>
                    </div>
                    <div class="p-4">
                        <form id="loginForm" autocomplete="on">
                            <div class="mb-3">
                                <label for="username" class="form-label">
                                    <i class="bi bi-person me-2"></i>Username
                                </label>
                                <input type="text" class="form-control" id="username" name="username" autocomplete="username" required>
                            </div>
                            <div class="mb-4">
                                <label for="password" class="form-label">
                                    <i class="bi bi-lock me-2"></i>Password
                                </label>
                                <input type="password" class="form-control" id="password" name="password" autocomplete="current-password" required>
                            </div>
                            <button type="submit" class="btn btn-primary w-100">
                                <i class="bi bi-box-arrow-in-right me-2"></i>Sign In
                            </button>
                        </form>
                        <div id="errorAlert" class="alert alert-danger mt-3" style="display: none;">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            <span id="errorMessage"></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const username = formData.get('username');
            const password = formData.get('password');
            
            const errorAlert = document.getElementById('errorAlert');
            const errorMessage = document.getElementById('errorMessage');
            
            try {
                const response = await fetch('/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    window.location.href = result.redirectUrl || '/';
                } else {
                    errorMessage.textContent = result.message;
                    errorAlert.style.display = 'block';
                }
            } catch (error) {
                errorMessage.textContent = 'Network error. Please try again.';
                errorAlert.style.display = 'block';
            }
        });
        
        document.getElementById('username').addEventListener('input', () => {
            document.getElementById('errorAlert').style.display = 'none';
        });
        document.getElementById('password').addEventListener('input', () => {
            document.getElementById('errorAlert').style.display = 'none';
        });
    </script>
</body>
</html>`;
      console.log("Using fallback embedded HTML for login page");
    }

    res.setHeader("Content-Type", "text/html");
    res.send(loginHtml);
  } catch (error) {
    console.error("Error serving login page:", error);
    res.status(500).send("Error loading login page");
  }
});

// Login endpoint
router.post("/login", (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Simple authentication against hardcoded credentials
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      req.session.user = {
        id: 1,
        username: ADMIN_USERNAME,
        role: "admin",
      };

      return res.json({
        success: true,
        message: "Login successful",
        redirectUrl: "/",
      });
    } else {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Logout endpoint (POST)
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Could not log out",
      });
    }
    res.json({
      success: true,
      message: "Logged out successfully",
      redirectUrl: "/auth/login",
    });
  });
});

// Logout endpoint (GET) - for direct links
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.redirect("/auth/login?error=logout_failed");
    }
    res.redirect("/auth/login");
  });
});

// Check authentication status
router.get("/status", (req, res) => {
  res.json({
    authenticated: !!req.session.user,
    user: req.session.user || null,
  });
});

module.exports = router;
