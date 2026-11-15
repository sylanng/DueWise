
const { db } = require('../config/firebaseAdmin');

// GET: Retrieve notifications
const getNotifications = async (req, res) => {
  try {
    const snapshot = await db
      .collection('users')
      .doc(req.user.uid)
      .collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const notifications = snapshot.docs.map((document) => {
      const data = document.data();

      return {
        id: document.id,
        type: data.type || 'general',
        title: data.title || 'DueWise Notification',
        message: data.message || '',
        read: data.read === true,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : null,
        installmentId: data.installmentId || null,
        dueDate: data.dueDate || null,
      };
    });

    const unreadCount = notifications.filter(
      (notification) => !notification.read
    ).length;

    return res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Get notifications error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications.',
    });
  }
};

// UPDATE: Mark one notification as read
const markNotificationAsRead = async (req, res) => {
  try {
    const notificationRef = db
      .collection('users')
      .doc(req.user.uid)
      .collection('notifications')
      .doc(req.params.id);

    const notification = await notificationRef.get();

    if (!notification.exists) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.',
      });
    }

    await notificationRef.update({
      read: true,
      readAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update notification.',
    });
  }
};

// UPDATE: Mark all notifications as read
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const snapshot = await db
      .collection('users')
      .doc(req.user.uid)
      .collection('notifications')
      .where('read', '==', false)
      .get();

    const batch = db.batch();

    snapshot.docs.forEach((document) => {
      batch.update(document.ref, {
        read: true,
        readAt: new Date(),
        updatedAt: new Date(),
      });
    });

    await batch.commit();

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      updatedCount: snapshot.size,
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update notifications.',
    });
  }
};

module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
