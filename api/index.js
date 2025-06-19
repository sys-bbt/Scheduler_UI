// api/index.js
// This file acts as the primary serverless function entry point for your Express app.
const app = require('./main-api'); // Import your main Express app

// The 'handler' function for Vercel. This makes your Express app compatible.
module.exports = app;
