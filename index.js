// index.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');

const app = express();

// basic middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// health (quick check)
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// connect to DB
connectDB().then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection failed:', err);
});

// Helper to require and log route modules
function safeRequireRoute(path) {
  try {
    const r = require(path);
    console.log(`Loaded route module: ${path}`);
    return r;
  } catch (err) {
    console.error(`Failed to load route module ${path}:`, err);
    // rethrow so Render shows deploy failure if module truly missing
    throw err;
  }
}

// Require route modules (this will surface require/filename errors)
const authRoutes = safeRequireRoute('./routes/auth');
const taskRoutes = safeRequireRoute('./routes/tasks');
const authMiddleware = safeRequireRoute('./middleware/auth');
const { errorHandler } = safeRequireRoute('./middleware/errorHandler');

// Mount routes under /api
app.use('/api/auth', authRoutes);
console.log('Mounted /api/auth -> ./routes/auth');

app.use('/api/tasks', authMiddleware, taskRoutes);
console.log('Mounted /api/tasks -> ./routes/tasks (protected)');

// Optional: your previous non-/api endpoints (if you still need them) - comment out if not used
// app.use('/auth', authRoutes); // do NOT duplicate unless you need both

// error handler middleware (your custom one)
app.use(errorHandler);

// JSON 404 fallback
app.use((req, res) => {
  res.status(404).json({ message: 'Not found', path: req.originalUrl });
});

// Print list of mounted routes (useful debugging)
// Note: this is best-effort; Express internals vary by version
function listRoutes() {
  const routes = [];
  app._router.stack.forEach(m => {
    if (m.route && m.route.path) {
      const methods = Object.keys(m.route.methods).join(',');
      routes.push({ path: m.route.path, methods });
    } else if (m.name === 'router' && m.handle && m.handle.stack) {
      m.handle.stack.forEach(r => {
        if (r.route && r.route.path) {
          const methods = Object.keys(r.route.methods).join(',');
          routes.push({ path: r.route.path, methods });
        }
      });
    }
  });
  console.log('=== Mounted routes ===');
  routes.forEach(r => console.log(`${r.methods.padEnd(8)} ${r.path}`));
  console.log('======================');
}

setTimeout(listRoutes, 1200); // allow time to mount routers

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
