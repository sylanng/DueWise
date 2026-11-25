const cron = require('node-cron');
const { getAuth } = require('firebase-admin/auth');
const { db } = require('../config/firebaseAdmin');
const { sendEmail } = require('./emailService');
const { paymentReminderEmail } = require('./emailTemplates');
const MAX_RETRY_ATTEMPTS = 3;

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
  const attempts = Number(notification.attempts || 1);

  if (attempts >= MAX_RETRY_ATTEMPTS) {
    return false;
  }

  if (notification.status === 'failed') {
    const lastAttempt = notification.updatedAt?.toDate
      ? notification.updatedAt.toDate()
      : notification.updatedAt instanceof Date
        ? notification.updatedAt
        : null;

    if (!lastAttempt) return true;

    const elapsedMinutes =
      (Date.now() - lastAttempt.getTime()) / 60000;

    return elapsedMinutes >= RETRY_AFTER_MINUTES;
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

  if (!lastAttempt) return false;

  return (
    (Date.now() - lastAttempt.getTime()) / 60000 >=
    RETRY_AFTER_MINUTES
  );
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

  try {
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
    error: result.error?.message || (
      result.skipped ? 'Email sending was skipped.' : null
    ),
    updatedAt: new Date(),
  });

  console.log(
    `Reminder ${result.success ? 'sent' : 'failed'}: ${installment.id}`
  );
} catch (error) {
  await notificationRef.update({
    status: 'failed',
    error: error.message,
    updatedAt: new Date(),
  });

  console.error(
    `Reminder email error for ${installment.id}:`,
    error.message
  );
}

  console.log(
    `Reminder ${result.success ? 'sent' : 'failed'}: ${installment.id}`
  );
};

// Check all users and upcoming installments

const checkInstallmentReminders = async () => {
  console.log('Checking DueWise installment reminders...');

  try {
    const today = getToday();
    const auth = getAuth();

    let pageToken;
    let totalUsersProcessed = 0;

    do {
      const result = await auth.listUsers(1000, pageToken);

      console.log('Firebase Auth users found:', result.users.length);

      for (const userRecord of result.users) {
        const uid = userRecord.uid;
        const email = userRecord.email;

        totalUsersProcessed++;

        try {
          if (!email) {
            console.warn(`Skipping user ${uid}: email missing.`);
            continue;
          }

          const userRef = db.collection('users').doc(uid);

          const settingsDocument = await userRef
            .collection('settings')
            .doc('preferences')
            .get();

          const settings = settingsDocument.exists
            ? settingsDocument.data()
            : {};

          console.log('User reminder settings:', {
            uid,
            emailNotifications: settings.emailNotifications,
            dueDateReminders: settings.dueDateReminders,
          });

          if (
            settings.emailNotifications !== true ||
            settings.dueDateReminders !== true
          ) {
            console.log(`Skipping user ${uid}: reminder settings disabled.`);
            continue;
          }

          const installmentsSnapshot = await userRef
            .collection('installments')
            .get();

          console.log(
            `Found ${installmentsSnapshot.size} installments for user ${uid}.`
          );

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

            console.log('Reminder check:', {
              installment: installment.description,
              provider: installment.provider,
              dueDate,
              today,
              daysUntilDue,
              status: installment.status,
            });

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

      pageToken = result.pageToken;
    } while (pageToken);

    console.log(`Total Firebase Auth users processed: ${totalUsersProcessed}`);
    console.log('DueWise reminder check completed.');
  } catch (error) {
    console.error('Reminder scheduler error:', error);
  }
};

// Run every day at 8:00 AM Philippine time
const startReminderScheduler = () => {
  cron.schedule(
    '*/15 * * * *',
    checkInstallmentReminders,
    { timezone: TIME_ZONE }
  );

  console.log(
    'DueWise reminder scheduler started (8:00 AM Philippine time).'
  );
};

const testSingleInstallmentReminder = async (uid, installmentId) => {
  const userRef = db.collection('users').doc(uid);

  const settingsDoc = await userRef
    .collection('settings')
    .doc('preferences')
    .get();

  const settings = settingsDoc.exists ? settingsDoc.data() : {};

  if (
    settings.emailNotifications !== true ||
    settings.dueDateReminders !== true
  ) {
    throw new Error('Email or due-date reminders are disabled.');
  }

  const userRecord = await getAuth().getUser(uid);

  if (!userRecord.email) {
    throw new Error('User email is missing.');
  }

  const installmentDoc = await userRef
    .collection('installments')
    .doc(installmentId)
    .get();

  if (!installmentDoc.exists) {
    throw new Error('Installment not found.');
  }

  const installment = {
    id: installmentDoc.id,
    ...installmentDoc.data(),
  };

  const dueDate = installment.nextDueDate || installment.dueDate;
  const daysUntilDue = getDaysDifference(getToday(), dueDate);

  if (
    installment.status === 'paid' ||
    Number(installment.totalPayments || 0) <= 0 ||
    Number(installment.paidPayments || 0) >=
      Number(installment.totalPayments || 0)
  ) {
    throw new Error('Installment is already paid or invalid.');
  }

  if (!REMINDER_DAYS.includes(daysUntilDue)) {
    throw new Error(`Not an eligible reminder date: ${daysUntilDue} days.`);
  }

  await processReminder({
    uid,
    email: userRecord.email,
    installment,
    dueDate,
    daysUntilDue,
  });

  console.log('Targeted reminder test completed.');
};

module.exports = {
  startReminderScheduler,
  checkInstallmentReminders,
  testSingleInstallmentReminder,
};

