const express = require('express');
const app = express();
const port = 5000;

// Simple test route
app.get('/test', (req, res) => {
  console.log('🧪 Test endpoint hit! Express is working!');
  res.json({ message: 'Express is working!', timestamp: new Date().toISOString() });
});

// Ping route
app.get('/ping', (req, res) => {
  console.log('🏓 Ping endpoint hit!');
  res.json({ message: 'pong', timestamp: new Date().toISOString() });
});

// Root route
app.get('/', (req, res) => {
  console.log('🏠 Root endpoint hit!');
  res.send('🚀 Welcome to the Green Uni Mind API!');
});

app.listen(port, () => {
  console.log(`🎉 Server is running on http://localhost:${port}`);
  console.log(`✅ Green Uni Mind API is ready to accept requests!`);
});
