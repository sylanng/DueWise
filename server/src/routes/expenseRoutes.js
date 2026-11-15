
const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');

const {
  createExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
} = require('../controllers/expenseController');

// Require authentication for all expense routes
router.use(verifyToken);

// GET all expenses
router.get('/', getAllExpenses);

// CREATE an expense
router.post('/', createExpense);

// GET one expense
router.get('/:id', getExpenseById);

// UPDATE an expense
router.put('/:id', updateExpense);

// DELETE an expense
router.delete('/:id', deleteExpense);

module.exports = router;
