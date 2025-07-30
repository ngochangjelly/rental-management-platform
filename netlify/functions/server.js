const serverless = require('serverless-http');

let app;
try {
  app = require('../../server.js');
  console.log("✅ Server app loaded successfully");
} catch (error) {
  console.error("❌ Failed to load server app:", error);
  throw error;
}

const handler = serverless(app);

module.exports.handler = async (event, context) => {
  try {
    console.log("📥 Incoming request:", event.httpMethod, event.path);
    const result = await handler(event, context);
    console.log("📤 Response status:", result.statusCode);
    return result;
  } catch (error) {
    console.error("❌ Serverless handler error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Internal server error in serverless handler",
        message: error.message 
      })
    };
  }
};