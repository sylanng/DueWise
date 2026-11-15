const cron = require('node-cron');
const { getAuth } = require('firebase-admin/auth');
const { db } = require('../config/firebaseAdmin');
const { sendEmail } = require('./emailService');
const { paymentReminderEmail } = require('./emailTemplates');

const TIME_ZONE = 'Asia/Manila';
const REMINDER_DAYS = [5, 1, 0];
const RETRY_AFTER_MINUTES = 15;

// Philippine date in YYYY-MM-DD format
const getToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

// Validate and calculate date difference
const getDaysDifference = (today, dueDate) => {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (
    !datePattern.test(today) ||
    !datePattern.test(dueDate || '')
  ) {
    return null;
  }

  const todayDate = new Date(`${today}T00:00:00Z`);
  const dueDateValue = new Date(`${dueDate}T00:00:00Z`);

  if (
    Number.isNaN(todayDate.getTime()) ||
    Number.isNaN(dueDateValue.getTime()) ||
    todayDate.toISOString().slice(0, 10) !== today ||
    dueDateValue.toISOString().slice(0, 10) !== dueDate
  ) {
    return null;
  }

  return Math.round(
    (dueDateValue - todayDate) / 86400000
  );
};

// Determine whether a previous reminder can be retried
const canRetryReminder = (notification) => {
  if (notification.status === 'failed') {
    return true;
  }

  if (notification.status !== 'sending') {
    return false;
  }

  const lastAttempt = notification.updatedAt?.toDate
    ? notification.updatedAt.toDate()
    : notification.updatedAt instanceof Date
      ? notification.updatedAt
      : notification.createdAt?.toDate
        ? notification.createdAt.toDate()
        : notification.createdAt instanceof Date
          ? notification.createdAt
          : null;

  if (!lastAttempt) {
    return false;
  }

  const elapsedMinutes =
    (Date.now() - lastAttempt.getTime()) / 60000;

  return elapsedMinutes >= RETRY_AFTER_MINUTES;
};

// Process one reminder
const processReminder = async ({
  uid,
  email,
  installment,
  dueDate,
  daysUntilDue,
}) => {
  const notificationId =
    `reminder_${installment.id}_${dueDate}_${daysUntilDue}`;

  const notificationRef = db
    .collection('users')
    .doc(uid)
    .collection('notifications')
    .doc(notificationId);

  // Reserve or retry atomically
  const reservation = await db.runTransaction(async (transaction) => {
    const notification = await transaction.get(notificationRef);

    if (notification.exists) {
      const previous = notification.data();

      if (!canRetryReminder(previous)) {
        return false;
      }

      transaction.update(notificationRef, {
        status: 'sending',
        attempts: Number(previous.attempts || 1) + 1,
        updatedAt: new Date(),
      });

      return true;
    }

    const title =
      daysUntilDue === 0
        ? 'Payment Due Today'
        : daysUntilDue === 1
          ? 'Payment Due Tomorrow'
          : 'Upcoming Payment';

    const message =
      daysUntilDue === 0
        ? `${installment.provider || installment.description || 'Your installment'} is due today.`
        : daysUntilDue === 1
          ? `${installment.provider || installment.description || 'Your installment'} is due tomorrow.`
          : `${installment.provider || installment.description || 'Your installment'} is due in 5 days.`;

    transaction.create(notificationRef, {
      type: 'due_date_reminder',
      title,
      message,
      installmentId: installment.id,
      dueDate,
      daysUntilDue,
      read: false,
      status: 'sending',
      attempts: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return true;
  });

  if (!reservation) {
    return;
  }

  // Recheck the installment before sending
  const latestInstallment = await db
    .collection('users')
    .doc(uid)
    .collection('installments')
    .doc(installment.id)
    .get();

  if (!latestInstallment.exists) {
    await notificationRef.update({
      status: 'cancelled',
      updatedAt: new Date(),
    });
    return;
  }

  const latestData = latestInstallment.data();

  const totalPayments = Number(latestData.totalPayments || 0);
  const paidPayments = Number(latestData.paidPayments || 0);
  const latestDueDate =
    latestData.nextDueDate || latestData.dueDate;

  if (
    latestData.status === 'paid' ||
    totalPayments <= 0 ||
    paidPayments >= totalPayments ||
    latestDueDate !== dueDate
  ) {
    await notificationRef.update({
      status: 'cancelled',
      updatedAt: new Date(),
    });
    return;
  }

  const result = await sendEmail({
    to: email,
    subject:
      daysUntilDue === 0
        ? 'Payment Due Today - DueWise'
        : daysUntilDue === 1
          ? 'Payment Due Tomorrow - DueWise'
          : 'Payment Due in 5 Days - DueWise',
    html: paymentReminderEmail(latestData, daysUntilDue),
  });

  await notificationRef.update({
    status: result.success ? 'sent' : 'failed',
    emailId: result.id || null,
    error: result.error?.message || null,
    updatedAt: new Date(),
  });

  console.log(
    `Reminder ${result.success ? 'sent' : 'failed'}: ${installment.id}`
  );
};

// Check all users and upcoming installments
const checkInstallmentReminders = async () => {
  console.log('Checking DueWise installment reminders...');

  try {
    const today = getToday();
    const usersSnapshot = await db.collection('users').get();

    for (const userDocument of usersSnapshot.docs) {
      const uid = userDocument.id;

      try {
        const settingsDocument = await db
          .collection('users')
          .doc(uid)
          .collection('settings')
          .doc('preferences')
          .get();

        const settings = settingsDocument.exists
          ? settingsDocument.data()
          : {};

        if (
          settings.emailNotifications !== true ||
          settings.dueDateReminders !== true
        ) {
          continue;
        }

        const userRecord = await getAuth().getUser(uid);
        const email = userRecord.email;

        if (!email) {
          console.warn(`Reminder skipped for user ${uid}: email missing.`);
          continue;
        }

        const installmentsSnapshot = await db
          .collection('users')
          .doc(uid)
          .collection('installments')
          .get();

        for (const installmentDocument of installmentsSnapshot.docs) {
          const installment = {
            id: installmentDocument.id,
            ...installmentDocument.data(),
          };

          const totalPayments = Number(installment.totalPayments || 0);
          const paidPayments = Number(installment.paidPayments || 0);

          if (
            installment.status === 'paid' ||
            totalPayments <= 0 ||
            paidPayments >= totalPayments
          ) {
            continue;
          }

          const dueDate =
            installment.nextDueDate || installment.dueDate;

          const daysUntilDue = getDaysDifference(today, dueDate);

          if (!REMINDER_DAYS.includes(daysUntilDue)) {
            continue;
          }

          await processReminder({
            uid,
            email,
            installment,
            dueDate,
            daysUntilDue,
          });
        }
      } catch (userError) {
        console.error(
          `Reminder processing failed for user ${uid}:`,
          userError.message
        );
      }
    }

    console.log('DueWise reminder check completed.');
  } catch (error) {
    console.error('Reminder scheduler error:', error);
  }
};

// Run every day at 8:00 AM Philippine time
const startReminderScheduler = () => {
  cron.schedule(
    '0 8 * * *',
    checkInstallmentReminders,
    { timezone: TIME_ZONE }
  );

  console.log(
    'DueWise reminder scheduler started (8:00 AM Philippine time).'
  );
};

module.exports = {
  startReminderScheduler,
  checkInstallmentReminders,
};