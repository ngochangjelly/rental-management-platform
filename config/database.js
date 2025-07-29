const mongoose = require('mongoose');

// Global connection variable for reuse in serverless
let cachedConnection = null;

const connectDB = async () => {
  // Reuse existing connection in serverless environment
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('Using cached MongoDB connection');
    return cachedConnection;
  }

  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    // Optimized connection options for serverless
    const connectionOptions = {
      serverSelectionTimeoutMS: 10000, // Reduced from 30s to 10s
      socketTimeoutMS: 20000, // 20 second socket timeout
      maxPoolSize: 5, // Smaller pool for serverless
      minPoolSize: 1,
      maxIdleTimeMS: 30000, // Close connections after 30s idle
      bufferCommands: false, // Disable mongoose buffering
      connectTimeoutMS: 10000, // 10 second connection timeout
      family: 4, // Use IPv4, skip IPv6
    };

    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(mongoUri, connectionOptions);

    // Cache the connection
    cachedConnection = conn;

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      cachedConnection = null;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      cachedConnection = null;
    });

    return conn;
  } catch (error) {
    console.error('Database connection error:', error);
    cachedConnection = null;
    
    // Don't exit process in serverless - just throw error
    if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      throw error;
    } else {
      process.exit(1);
    }
  }
};

// Graceful shutdown
const closeDB = async () => {
  if (cachedConnection) {
    await mongoose.connection.close();
    cachedConnection = null;
    console.log('MongoDB connection closed');
  }
};

module.exports = { connectDB, closeDB };