const serverless = require('serverless-http');
const app = require('../../server.js');

const handler = serverless(app);

module.exports.handler = async (event, context) => {
  const result = await handler(event, context);
  return result;
};