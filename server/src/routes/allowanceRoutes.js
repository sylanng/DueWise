
const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');

const {
  createAllowance,
  getAllAllowances,
  getAllowanceById,
  updateAllowance,
  deleteAllowance,
} = require('../controllers/allowanceController');

// Protect all allowance routes
router.use(verifyToken);

// GET: Retrieve all allowances
router.get('/', getAllAllowances);

// POST: Create a new allowance
router.post('/', createAllowance);

// GET: Retrieve one allowance
router.get('/:id', getAllowanceById);

// PUT: Update an allowance
router.put('/:id', updateAllowance);

// DELETE: Delete an allowance
router.delete('/:id', deleteAllowance);

module.exports = router;
