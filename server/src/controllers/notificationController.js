
const { randomUUID } = require('crypto');
const { db } = require('../config/firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');

const getUserNotificationsRef = (uid) =>
  db.collection('users').doc(uid).collection('notifications');

// GET: Retrieve active notifications
const getNotifications = async (req, res) => {
  try {
    const notificationsRef = getUserNotificationsRef(req.user.uid);

    const snapshot = await notificationsRef
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const notifications = snapshot.docs
      .filter((document) => document.data().isDeleted !== true)
      .slice(0, 50)
      .map((document) => {
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
          paymentAmount: data.paymentAmount ?? null,
          paymentDate: data.paymentDate || null,
          remainingAmount: data.remainingAmount ?? null,
          paidPayments: data.paidPayments ?? null,
          totalPayments: data.totalPayments ?? null,
          daysUntilDue: data.daysUntilDue ?? null,
        };
      });

    const unreadSnapshot = await notificationsRef
      .where('read', '==', false)
      .get();

    const unreadCount = unreadSnapshot.docs.filter(
      (document) => document.data().isDeleted !== true
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
    const notificationRef = getUserNotificationsRef(req.user.uid)
      .doc(req.params.id);

    const notification = await notificationRef.get();

    if (
      !notification.exists ||
      notification.data().isDeleted === true
    ) {
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

// UPDATE: Mark all active notifications as read
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const notificationsRef = getUserNotificationsRef(req.user.uid);

    const snapshot = await notificationsRef
      .where('read', '==', false)
      .get();

    const docs = snapshot.docs.filter(
      (document) => document.data().isDeleted !== true
    );

    for (let i = 0; i < docs.length; i += 500) {
      const batch = db.batch();

      docs.slice(i, i + 500).forEach((document) => {
        batch.update(document.ref, {
          read: true,
          readAt: new Date(),
          updatedAt: new Date(),
        });
      });

      await batch.commit();
    }

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      updatedCount: docs.length,
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update notifications.',
    });
  }
};

// DELETE: Temporarily delete one notification
const deleteNotification = async (req, res) => {
  try {
    const notificationRef = getUserNotificationsRef(req.user.uid)
      .doc(req.params.id);

    const notification = await notificationRef.get();

    if (!notification.exists) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.',
      });
    }

    if (notification.data().isDeleted === true) {
      return res.status(409).json({
        success: false,
        message: 'Notification is already deleted.',
      });
    }

    await notificationRef.update({
      isDeleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'Notification temporarily deleted.',
    });
  } catch (error) {
    console.error('Delete notification error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete notification.',
    });
  }
};

// RESTORE: Restore one temporarily deleted notification
const restoreNotification = async (req, res) => {
  try {
    const notificationRef = getUserNotificationsRef(req.user.uid)
      .doc(req.params.id);

    const notification = await notificationRef.get();

    if (
      !notification.exists ||
      notification.data().isDeleted !== true
    ) {
      return res.status(404).json({
        success: false,
        message: 'Deleted notification not found.',
      });
    }

    await notificationRef.update({
      isDeleted: FieldValue.delete(),
      deletedAt: FieldValue.delete(),
      deleteBatchId: FieldValue.delete(),
      updatedAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'Notification restored.',
    });
  } catch (error) {
    console.error('Restore notification error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to restore notification.',
    });
  }
};

// PERMANENT DELETE: One notification
const permanentlyDeleteNotification = async (req, res) => {
  try {
    const notificationRef = getUserNotificationsRef(req.user.uid)
      .doc(req.params.id);

    const notification = await notificationRef.get();

    if (!notification.exists) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.',
      });
    }

    if (notification.data().isDeleted !== true) {
      return res.status(409).json({
        success: false,
        message: 'Only deleted notifications can be permanently removed.',
      });
    }

    await notificationRef.delete();

    return res.status(200).json({
      success: true,
      message: 'Notification permanently deleted.',
    });
  } catch (error) {
    console.error('Permanent notification deletion error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to permanently delete notification.',
    });
  }
};

// DELETE ALL: Temporarily delete all active notifications
const deleteAllNotifications = async (req, res) => {
  try {
    const notificationsRef = getUserNotificationsRef(req.user.uid);
    const snapshot = await notificationsRef.get();

    const docs = snapshot.docs.filter(
      (document) => document.data().isDeleted !== true
    );

    if (docs.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'There are no notifications to delete.',
        batchId: null,
        deletedCount: 0,
      });
    }

    const batchId = randomUUID();

    for (let i = 0; i < docs.length; i += 500) {
      const batch = db.batch();

      docs.slice(i, i + 500).forEach((document) => {
        batch.update(document.ref, {
          isDeleted: true,
          deletedAt: new Date(),
          deleteBatchId: batchId,
          updatedAt: new Date(),
        });
      });

      await batch.commit();
    }

    return res.status(200).json({
      success: true,
      message: 'All notifications temporarily deleted.',
      batchId,
      deletedCount: docs.length,
    });
  } catch (error) {
    console.error('Delete all notifications error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete notifications.',
    });
  }
};

// RESTORE ALL: Restore one specific deletion batch
const restoreAllNotifications = async (req, res) => {
  try {
    const notificationsRef = getUserNotificationsRef(req.user.uid);

    const snapshot = await notificationsRef
      .where('deleteBatchId', '==', req.params.batchId)
      .get();

    const docs = snapshot.docs.filter(
      (document) => document.data().isDeleted === true
    );

    for (let i = 0; i < docs.length; i += 500) {
      const batch = db.batch();

      docs.slice(i, i + 500).forEach((document) => {
        batch.update(document.ref, {
          isDeleted: FieldValue.delete(),
          deletedAt: FieldValue.delete(),
          deleteBatchId: FieldValue.delete(),
          updatedAt: new Date(),
        });
      });

      await batch.commit();
    }

    return res.status(200).json({
      success: true,
      message: 'Notifications restored.',
      restoredCount: docs.length,
    });
  } catch (error) {
    console.error('Restore all notifications error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to restore notifications.',
    });
  }
};

// PERMANENT DELETE ALL: Remove one expired deletion batch
const permanentlyDeleteAllNotifications = async (req, res) => {
  try {
    const notificationsRef = getUserNotificationsRef(req.user.uid);

    const snapshot = await notificationsRef
      .where('deleteBatchId', '==', req.params.batchId)
      .get();

    const docs = snapshot.docs.filter(
      (document) => document.data().isDeleted === true
    );

    for (let i = 0; i < docs.length; i += 500) {
      const batch = db.batch();

      docs.slice(i, i + 500).forEach((document) => {
        batch.delete(document.ref);
      });

      await batch.commit();
    }

    return res.status(200).json({
      success: true,
      message: 'Deleted notifications permanently removed.',
      deletedCount: docs.length,
    });
  } catch (error) {
    console.error('Permanent bulk deletion error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to permanently delete notifications.',
    });
  }
};

module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  restoreNotification,
  permanentlyDeleteNotification,
  deleteAllNotifications,
  restoreAllNotifications,
  permanentlyDeleteAllNotifications,
};
