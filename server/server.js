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
const { User } = require('./shared/models');
const { displayActorNames } = require('./shared/utils/actorName');
const app = express();
configureProxy(app);

/* Yung real browser-facing origins na puwedeng tumawag sa API na ito, e.g.
"http://localhost:5173" o comma-separated list kung maraming environments.
Babalik sa local dev client's own origin (hindi sa '*') kapag unset yung
CORS_ORIGIN, para yung missing/blank value hindi tahimik na mag-reopen nito
sa lahat ng origin. */
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
  /* Sinadya talagang cross-origin yung pag-load ng QR code images sa /uploads,
  gaya ng <img src="http://<api-origin>/uploads/qrcodes/...">, dahil galing
  sa SPA na tumatakbo sa sarili nitong dev/prod origin - kung helmet's default
  same-origin CORP, mabe-block ng browser yung load kahit pumayag naman yung CORS. */
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
/* Walang nangailangan dito ng malapit sa 50MB: dumadaan yung file uploads
(CSV, bulk import) sa multer's own disk storage, hindi sa JSON/urlencoded
bodies. Yung isang JSON endpoint na may malaking payload (pasted CSV text
para sa treasurer's bulk payment upload) may sariling 1MB cap sa paymentCsv.js. */
/* A complete module backup (every record plus audit history) is far larger
than any normal request, so only the restore endpoints accept up to 25MB. */
const jsonDefault = express.json({ limit: '2mb' });
const jsonBackupRestore = express.json({ limit: '25mb' });
app.use((req, res, next) => (/\/backup\/restore$/.test(req.path) ? jsonBackupRestore : jsonDefault)(req, res, next));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Serve static files for uploads
/* Nire-render yung QR images gamit yung existing MongoDB IDs nila, kaya kung
mawala yung local files sa deploy/restart, hindi masisira yung mga naibigay
na member cards. */
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

/* Show staff full names (not usernames) in every "done by" field the API
returns. Backup downloads keep the raw stored values so restores are exact. */
const showActorNames = displayActorNames(User);
app.use('/api', (req, res, next) => (req.path.includes('/backup/') ? next() : showActorNames(req, res, next)));

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
    /* Mag-fail agad at maingay sa startup kaysa hayaang tahimik na mag-fail
    yung bawat login/auth-check mamaya - dapat parehas lang ang secret na
    ginagamit ng jwt.sign/jwt.verify, at dati yung missing value nagfall-back
    sa hardcoded, predictable string sa ibang call sites pero hindi sa lahat. */
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

/* Nagpapadala ng SIGTERM yung platform restart/redeploy (Docker, most PaaS
hosts); SIGINT naman galing sa terminal Ctrl+C. Kung hindi hinahandle ito,
namamatay agad yung process pagdating ng signal - kaya anumang request na
mid-flight (e.g. ledger write na nasa gitna ng atomic lock at matching
release, tingnan ang treasurerClaimController.js) maputol sa kalagitnaan
imbes na matapos o mag-rollback nang maayos. Kapag isinara muna yung HTTP
server, natitigil yung bagong connections at nakakatapos muna yung mga
in-flight requests bago mawala yung Mongo connection. */
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
