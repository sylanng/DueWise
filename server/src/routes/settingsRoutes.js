
const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');

const {
  getUserSettings,
  updateUserSettings,
} = require('../controllers/settingsController');

// Require authentication for all settings routes.
router.use(verifyToken);

// Retrieve the user's settings.
router.get('/', getUserSettings);

// Save or update the user's settings.
router.put('/', updateUserSettings);

module.exports = router;
