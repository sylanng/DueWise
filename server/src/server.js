
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

const { db } = require('./config/firebaseAdmin');
const verifyToken = require('./middleware/authMiddleware');
const installmentRoutes = require('./routes/installmentRoutes');
const allowanceRoutes = require('./routes/allowanceRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const projectionRoutes = require('./routes/projectionRoutes');
const { startReminderScheduler } = require('./services/reminderScheduler');
const profileRoutes = require('./routes/profileRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
}));

app.use(express.json());

// Installment API routes
app.use('/api/installments', installmentRoutes);

// Transaction API routes
app.use('/api/transactions', transactionRoutes);

// Allowance API routes
app.use('/api/allowances', allowanceRoutes);

// Expense API routes
app.use('/api/expenses', expenseRoutes);

// Projection API routes
app.use('/api/projection', projectionRoutes);

// Setting API routes
app.use('/api/settings', settingsRoutes);

// Profile API routes
app.use('/api/profile', profileRoutes);

// Notification API routes
app.use('/api/notifications', notificationRoutes);

// Main API route
app.get('/', (req, res) => {
  res.json({
    message: 'BNPL Payment Projection System API is running!',
  });
});

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Backend server is healthy.',
    timestamp: new Date().toISOString(),
  });
});

// Test Firebase Firestore connection
app.get('/api/firebase-test', async (req, res) => {
  try {
    await db.collection('_connection_test').limit(1).get();

    res.status(200).json({
      success: true,
      message: 'Firebase Admin SDK connected to Firestore successfully!',
    });
  } catch (error) {
    console.error('Firebase connection error:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to connect to Firestore.',
    });
  }
});

// Test protected API route
app.get('/api/protected-test', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authentication successful!',
    user: req.user,
  });
});

// Handle requests to unknown API routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found.',
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);

  const statusCode = err.status || 500;

  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 400
        ? 'Invalid request data.'
        : 'Internal server error. Please try again later.',
  });
});

// Start server and reminder scheduler
app.listen(PORT, () => {
  console.log(`BNPL Backend running at http://localhost:${PORT}`);

  startReminderScheduler();
});