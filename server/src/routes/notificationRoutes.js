
const express = require('express');
const router = express.Router();

const {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  restoreNotification,
  permanentlyDeleteNotification,
  deleteAllNotifications,
  restoreAllNotifications,
} = require('../controllers/notificationController');

const authMiddleware = require('../middleware/authMiddleware');

// All notification routes require authentication
router.use(authMiddleware);

// Get notifications and unread count
router.get('/', getNotifications);

// Mark all notifications as read
router.patch('/read-all', markAllNotificationsAsRead);

// Delete all notifications temporarily
router.patch('/delete-all', deleteAllNotifications);

// Restore all notifications from a specific deletion
router.patch('/restore-all/:batchId', restoreAllNotifications);

// Mark one notification as read
router.patch('/:id/read', markNotificationAsRead);

// Temporarily delete one notification
router.patch('/:id/delete', deleteNotification);

// Restore one deleted notification
router.patch('/:id/restore', restoreNotification);

// Permanently delete one notification
router.delete('/:id', permanentlyDeleteNotification);

module.exports = router;
