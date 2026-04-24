const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./configs/db');
const { globalErrorHandler } = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./shared/routes/authRoutes');
const adminRoutes = require('./shared/routes/adminRoutes');
const attendanceRoutes = require('./modules/attendance/routes/attendanceRoutes');
const mortuaryRoutes = require('./modules/mortuary/routes/mortuaryRoutes');

const app = express();

// CORS - Must be FIRST, before any other middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/mortuary', mortuaryRoutes);

// Global error handling middleware
app.use(globalErrorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Database connection and server start
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('✓ Database connection established successfully.');

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║   Samahang Kooperatibo - Multi-Module System               ║
║   Server running on http://localhost:${PORT}                    ║
║   Environment: ${process.env.NODE_ENV || 'development'}                      ║
║   Organized Backend Architecture v2.0                      ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('✗ Unable to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
