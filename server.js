require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { connectDB } = require("./config/database");

const app = express();
const PORT = process.env.PORT || 3000;

// Check if running in serverless environment (Netlify)
const isServerless =
  process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME;
console.log("Running in serverless environment:", isServerless);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize sessions with fallback for production
const initSessionConfig = () => {
  const config = {
    secret: process.env.APP_SECRET || "your-secret-key-here",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  };

  // In serverless, use memory sessions but ensure they work
  if (isServerless) {
    config.cookie.httpOnly = true;
    config.cookie.sameSite = 'lax';
  }

  return config;
};

try {
  // Use session config with serverless optimizations
  app.use(session(initSessionConfig()));
  console.log("🔧 Session middleware initialized successfully");
} catch (error) {
  console.error("❌ Failed to initialize session middleware:", error);
  throw error;
}

// Static files
app.use(express.static("public"));

// Upload configuration - use memory storage in serverless environments
const uploadDir = isServerless ? "/tmp" : "uploads/";
const upload = multer({
  storage: isServerless
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: uploadDir,
      }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Database connection middleware for API routes
const ensureDBConnection = async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('Database connection failed in middleware:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database connection failed' 
    });
  }
};

// Authentication middleware for API routes
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
  }
  next();
};

// Routes
app.use("/auth", require("./routes/auth"));
app.use("/api/properties", requireAuth, ensureDBConnection, require("./routes/properties"));
app.use("/api/tenants", requireAuth, ensureDBConnection, require("./routes/tenants"));
app.use("/upload", requireAuth, require("./routes/upload"));
app.use("/analysis", requireAuth, require("./routes/analysis"));

// Serve PDF files
app.get("/pdf/:filename", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "PDF file not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error serving PDF:", error);
    res.status(500).json({ error: "Error loading PDF file" });
  }
});

// Main route - redirect to dashboard.html if logged in
app.get("/", (req, res) => {
  try {
    console.log(
      "Main route accessed, session:",
      req.session ? "exists" : "missing"
    );

    if (!req.session) {
      console.log("No session object found");
      return res.redirect("/auth/login");
    }

    if (!req.session.user) {
      console.log("No user in session, redirecting to login");
      return res.redirect("/auth/login");
    }

    console.log("User logged in, redirecting to dashboard");
    return res.redirect("/dashboard.html");
  } catch (error) {
    console.error("Error in main route:", error);
    return res
      .status(500)
      .json({ error: "Internal server error in main route" });
  }
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Initialize database and start server
async function startServer() {
  try {
    // Connect to database if MongoDB URI is provided
    if (process.env.MONGODB_URI) {
      try {
        await connectDB();
      } catch (dbError) {
        console.warn(
          "⚠️ Database connection failed, continuing without database:",
          dbError.message
        );
      }
    } else {
      console.log("⚠️ No MONGODB_URI provided - running without database");
    }

    // Only start server if not in serverless environment
    if (require.main === module) {
      app.listen(PORT, () => {
        console.log(
          `🚀 Rental Management Platform running on http://localhost:${PORT}`
        );
        console.log(`📊 Dashboard: http://localhost:${PORT}`);
        console.log(`🔐 Login: http://localhost:${PORT}/auth/login`);
      });
    }
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Initialize for serverless or start server
if (require.main === module) {
  startServer();
} else {
  console.log("📱 Serverless environment detected - using memory sessions");
}

module.exports = app;
