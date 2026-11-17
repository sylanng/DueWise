
const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');

const {
  getAllTransactions,
} = require('../controllers/transactionController');

// Protect all transaction routes
router.use(verifyToken);

// GET: Retrieve authenticated user's transactions
router.get('/', getAllTransactions);

module.exports = router;
