
const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');

const {
  getFinancialProjection,
} = require('../controllers/projectionController');

router.use(verifyToken);

router.get('/', getFinancialProjection);

module.exports = router;
