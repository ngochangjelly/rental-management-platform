require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cookieParser = require("cookie-parser");
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
app.use(cookieParser());

// Initialize sessions with optimized configuration for serverless
const initSessionMiddleware = () => {
  const config = {
    secret: process.env.APP_SECRET || "your-secret-key-here",
    resave: false,
    saveUninitialized: false,
    rolling: false, // Don't extend expiry on every request
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax'
    },
  };

  // For serverless, use simpler session handling
  if (isServerless) {
    console.log("🔧 Using memory sessions for serverless");
    // Use memory store for serverless to avoid connection timeouts
    // Sessions will be lost on function restart but that's acceptable
  } else if (process.env.MONGODB_URI) {
    try {
      config.store = MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        dbName: 'test',
        collectionName: 'sessions',
        ttl: 24 * 60 * 60, // 24 hours
        touchAfter: 24 * 3600, // lazy session update
        stringify: false,
        autoRemove: 'native',
        // Optimized for serverless - very short timeouts
        serverSelectionTimeoutMS: 2000,
        socketTimeoutMS: 3000,
        connectTimeoutMS: 2000,
        family: 4
      });
      console.log("🔧 MongoDB session store configured");
    } catch (error) {
      console.warn("⚠️ Failed to configure MongoDB session store:", error.message);
      console.log("📝 Using memory sessions as fallback");
    }
  } else {
    console.warn("⚠️ No MONGODB_URI found, using memory sessions");
  }

  return session(config);
};

// Initialize session middleware
app.use(initSessionMiddleware());
console.log("🔧 Session middleware initialized");

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
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || process.env.APP_SECRET || "your-jwt-secret-key-here";
  
  if (isServerless) {
    // JWT authentication for serverless
    console.log('Auth check - Using JWT for serverless');
    const token = req.cookies.auth_token;
    console.log('Auth check - Token exists:', !!token);
    
    if (!token) {
      console.warn('Authentication failed: No JWT token');
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required - no token' 
      });
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      console.log('Auth check - JWT valid:', decoded.username);
      next();
    } catch (error) {
      console.warn('Authentication failed: Invalid JWT token:', error.message);
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required - invalid token' 
      });
    }
  } else {
    // Session authentication for local development
    console.log('Auth check - Using sessions for local');
    console.log('Auth check - Session exists:', !!req.session);
    console.log('Auth check - User in session:', !!req.session?.user);
    
    if (!req.session) {
      console.warn('Authentication failed: No session object');
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required - no session' 
      });
    }
    
    if (!req.session.user) {
      console.warn('Authentication failed: No user in session');
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required - not logged in' 
      });
    }
    
    req.user = req.session.user;
    next();
  }
};

// Routes - remove DB middleware for auth routes to avoid timeout
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
    if (isServerless) {
      console.log("Main route accessed in serverless");
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || process.env.APP_SECRET || "your-jwt-secret-key-here";
      const token = req.cookies.auth_token;
      
      if (!token) {
        console.log("No JWT token found, redirecting to login");
        return res.redirect("/auth/login");
      }
      
      try {
        jwt.verify(token, JWT_SECRET);
        console.log("Valid JWT token, redirecting to dashboard");
        return res.redirect("/dashboard.html");
      } catch (error) {
        console.log("Invalid JWT token, redirecting to login");
        return res.redirect("/auth/login");
      }
    } else {
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
    }
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
