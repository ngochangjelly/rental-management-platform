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

// Initialize session configuration with async function
async function setupSessionConfig() {
  const sessionConfig = {
    secret: process.env.APP_SECRET || "your-secret-key-here",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  // Use MongoDB for session storage if available and connection works
  if (process.env.MONGODB_URI) {
    try {
      // Test if we can connect to MongoDB first
      const mongoose = require('mongoose');
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 3000,
        socketTimeoutMS: 3000,
      });
      
      sessionConfig.store = MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        dbName: process.env.DATABASE_NAME,
        touchAfter: 24 * 3600, // lazy session update
        serverSelectionTimeoutMS: 3000,
        socketTimeoutMS: 3000,
      });
      console.log("✅ MongoDB session store configured successfully");
      
      // Close the test connection
      await mongoose.disconnect();
    } catch (error) {
      console.warn(
        "⚠️ Could not connect to MongoDB for sessions, using memory store:",
        error.message
      );
      // Don't set store, will use default memory store
    }
  } else {
    console.log(
      "📝 Using memory session store (not suitable for production scaling)"
    );
  }

  return sessionConfig;
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

// Routes
app.use("/auth", require("./routes/auth"));
app.use("/api/properties", require("./routes/properties"));
app.use("/api/tenants", require("./routes/tenants"));
app.use("/upload", require("./routes/upload"));
app.use("/analysis", require("./routes/analysis"));

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
  if (!req.session.user) {
    return res.redirect("/auth/login");
  }

  // Redirect to static dashboard
  return res.redirect("/dashboard.html");
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
    // Setup session configuration first
    const sessionConfig = await setupSessionConfig();
    app.use(session(sessionConfig));

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
  // For serverless environments, setup sessions immediately
  setupSessionConfig().then(sessionConfig => {
    app.use(session(sessionConfig));
    console.log("📱 Serverless app initialized with session support");
  }).catch(error => {
    console.error("❌ Failed to setup sessions for serverless:", error);
    // Fallback to basic session config
    app.use(session({
      secret: process.env.APP_SECRET || "your-secret-key-here",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
      },
    }));
  });
}

module.exports = app;
