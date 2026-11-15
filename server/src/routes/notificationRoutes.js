
const express = require('express');
const router = express.Router();

const {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require('../controllers/notificationController');

const authMiddleware = require('../middleware/authMiddleware');

// All notification routes require authentication
router.use(authMiddleware);

// Get notifications and unread count
router.get('/', getNotifications);

// Mark all notifications as read
router.patch('/read-all', markAllNotificationsAsRead);

// Mark one notification as read
router.patch('/:id/read', markNotificationAsRead);

module.exports = router;
