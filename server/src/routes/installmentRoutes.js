
const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');

const {
  createInstallment,
  getAllInstallments,
  getInstallmentById,
  updateInstallment,
  recordPayment,
  deleteInstallment,
} = require('../controllers/installmentController');

// Protect every installment route
router.use(verifyToken);

// GET: Retrieve all installments
router.get('/', getAllInstallments);

// POST: Create a new installment
router.post('/', createInstallment);

// GET: Retrieve one installment
router.get('/:id', getInstallmentById);

// PUT: Update an installment
router.put('/:id', updateInstallment);

// POST: Record one installment payment
router.post('/:id/record-payment', recordPayment);

// DELETE: Delete an installment
router.delete('/:id', deleteInstallment);

module.exports = router;
