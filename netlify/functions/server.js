const serverless = require('serverless-http');

// Set environment variables for serverless
process.env.NETLIFY = true;

let app;
try {
  // Load environment variables
  require('dotenv').config();
  
  app = require('../../server.js');
  console.log("✅ Server app loaded successfully");
} catch (error) {
  console.error("❌ Failed to load server app:", error);
  console.error("Stack trace:", error.stack);
  throw error;
}

const handler = serverless(app, {
  binary: ['image/*', 'application/pdf'],
  request: (request, event, context) => {
    // Add additional context for debugging
    request.netlifyEvent = event;
    request.netlifyContext = context;
  }
});

module.exports.handler = async (event, context) => {
  // Netlify function context
  context.callbackWaitsForEmptyEventLoop = false;
  
  try {
    console.log("📥 Incoming request:", {
      method: event.httpMethod,
      path: event.path,
      headers: Object.keys(event.headers || {}),
      hasBody: !!event.body
    });
    
    const result = await handler(event, context);
    
    console.log("📤 Response:", {
      statusCode: result.statusCode,
      hasBody: !!result.body,
      headers: Object.keys(result.headers || {})
    });
    
    return result;
  } catch (error) {
    console.error("❌ Serverless handler error:", error);
    console.error("Error stack:", error.stack);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: JSON.stringify({ 
        success: false,
        error: "Internal server error in serverless handler",
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};