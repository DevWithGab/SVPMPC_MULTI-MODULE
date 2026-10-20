const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const path = require('path');
const connectDB = require('./configs/db');
const configureProxy = require('./configs/proxy');
const { globalErrorHandler } = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./shared/routes/authRoutes');
const adminRoutes = require('./shared/routes/adminRoutes');
const attendanceRoutes = require('./modules/attendance/routes/attendanceRoutes');
const mortuaryRoutes = require('./modules/mortuary/routes/mortuaryRoutes');
const auditLogRoutes = require('./shared/routes/auditLogRoutes');
const qrImageRoutes = require('./modules/attendance/routes/qrImageRoutes');

const { authenticateToken, authorizeModule, authorizeAdminOnly, requirePasswordChange } = require('./middleware/auth');
const app = express();
configureProxy(app);

// Real browser-facing origins allowed to call this API, e.g.
// "http://localhost:5173" or a comma-separated list for multiple
// environments. Falls back to the local dev client's own origin (never to
// '*') if CORS_ORIGIN is unset, so a missing/blank value can't silently
// reopen this to every origin.
const DEFAULT_DEV_ORIGIN = 'http://localhost:5173';
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map(origin => origin.trim()).filter(Boolean);
if (!corsOrigins.length) {
  console.warn(`CORS_ORIGIN is not set — defaulting to ${DEFAULT_DEV_ORIGIN}. Set it in .env for any other environment.`);
  corsOrigins.push(DEFAULT_DEV_ORIGIN);
}

// CORS - Must be FIRST, before any other middleware
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false
}));
app.use(helmet({
  // QR code images under /uploads are deliberately loaded cross-origin, as
  // <img src="http://<api-origin>/uploads/qrcodes/...">, by the SPA running
  // on its own dev/prod origin — helmet's default same-origin CORP would
  // have the browser block that load even though CORS itself allows it.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
// Nothing here needs anywhere near 50MB: file uploads (CSV, bulk import) go
// through multer's own disk storage, not JSON/urlencoded bodies. The one
// JSON endpoint that carries a sizeable payload (pasted CSV text for the
// treasurer's bulk payment upload) is itself capped at 1MB by paymentCsv.js.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Serve static files for uploads
// QR images are rendered from their existing MongoDB IDs so local files
// disappearing during a deploy/restart cannot break issued member cards.
app.use('/uploads/qrcodes', qrImageRoutes);
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
app.use('/api/admin', authenticateToken, requirePasswordChange, authorizeAdminOnly, adminRoutes);
app.use('/api/attendance', authenticateToken, requirePasswordChange, authorizeModule('attendance'), attendanceRoutes);
app.use('/api/mortuary', authenticateToken, requirePasswordChange, authorizeModule('mortuary'), mortuaryRoutes);
app.use('/api/audit', authenticateToken, requirePasswordChange, auditLogRoutes);

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

let httpServer;

const startServer = async () => {
  try {
    // Fail loudly at startup instead of letting every login/auth-check fail
    // silently later — jwt.sign/jwt.verify must agree on the same secret,
    // and a missing one previously fell back to a hardcoded, predictable
    // string in some call sites but not others.
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not set. Copy .env.example to .env and set a real random JWT_SECRET before starting the server.');
    }

    // Connect to MongoDB
    await connectDB();
    console.log('✓ Database connection established successfully.');

    // Start HTTP server
    httpServer = app.listen(PORT, () => {
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

// A platform restart/redeploy sends SIGTERM (Docker, most PaaS hosts); a
// terminal Ctrl+C sends SIGINT. Left unhandled, the process dies the instant
// the signal arrives — whatever request is mid-flight (e.g. a ledger write
// sitting between its atomic lock and the matching release, see
// treasurerClaimController.js) gets cut off part-way instead of finishing or
// cleanly rolling back. Closing the HTTP server first stops new connections
// and lets in-flight requests finish before the Mongo connection goes away.
const shutdown = (signal) => {
  console.log(`\n${signal} received: closing server gracefully...`);
  if (!httpServer) {
    process.exit(0);
    return;
  }

  httpServer.close(async (err) => {
    if (err) console.error('Error while closing HTTP server:', err);
    try {
      await mongoose.connection.close();
      console.log('✓ MongoDB connection closed.');
    } catch (closeError) {
      console.error('Error closing MongoDB connection:', closeError);
    }
    process.exit(err ? 1 : 0);
  });

  // Don't hang forever on a stuck keep-alive connection that never closes.
  setTimeout(() => {
    console.error('✗ Forcing shutdown — some connections did not close in time.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();

module.exports = app;
