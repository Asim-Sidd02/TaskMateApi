// index.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// connect to MongoDB
connectDB();

// routes
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const noteRoutes = require('./routes/notes');

const authMiddleware = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

// Mount routes
app.use('/auth', authRoutes);
app.use('/tasks', authMiddleware, taskRoutes);
app.use('/notes', authMiddleware, noteRoutes);

// health
app.get('/', (req, res) => res.status(200).json({ message: 'TaskMate API running' }));

// error handler (last)
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
