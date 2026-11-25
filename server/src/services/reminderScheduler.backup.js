const cron = require('node-cron');
const { db } = require('../config/firebaseAdmin');
const { sendEmail } = require('./emailService');
const { paymentReminderEmail } = require('./emailTemplates');

// Philippine time zone
const TIME_ZONE = 'Asia/Manila';

// Reminder intervals in days
const REMINDER_DAYS = [5, 1, 0];

// Get today's date in Philippine time
const getToday = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

// Calculate the number of days between two dates
const getDaysDifference = (today, dueDate) => {
  const todayDate = new Date(`${today}T00:00:00Z`);
  const dueDateValue = new Date(`${dueDate}T00:00:00Z`);

  if (
    Number.isNaN(todayDate.getTime()) ||
    Number.isNaN(dueDateValue.getTime()) ||
    dueDateValue.toISOString().slice(0, 10) !== dueDate
  ) {
    return null;
  }

  return Math.round(
    (dueDateValue - todayDate) / (1000 * 60 * 60 * 24)
  );
};

// Check all users and their installment reminders
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

        const userRecord = await require('firebase-admin/auth')
        .getAuth()
        .getUser(uid);

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

          const dueDate = installment.nextDueDate || installment.dueDate;
          const daysUntilDue = getDaysDifference(today, dueDate);

          if (!REMINDER_DAYS.includes(daysUntilDue)) {
            continue;
          }

          const reminderId = `${installment.id}_${dueDate}_${daysUntilDue}`;
          const notificationRef = db
            .collection('users')
            .doc(uid)
            .collection('notifications')
            .doc(`reminder_${reminderId}`);

          // Reserve the reminder before sending to prevent duplicates
          const reserved = await db.runTransaction(async (transaction) => {
            const existingNotification = await transaction.get(notificationRef);

            if (existingNotification.exists) {
              return false;
            }

            const installmentName =
              installment.description || installment.provider || 'Your installment';

            const reminderTitle =
              daysUntilDue === 0
                ? 'Payment Due Today'
                : daysUntilDue === 1
                  ? 'Payment Due Tomorrow'
                  : 'Payment Due in 5 Days';

            const reminderMessage =
              daysUntilDue === 0
                ? `Your payment for ${installmentName} is due today.`
                : daysUntilDue === 1
                  ? `Your payment for ${installmentName} is due tomorrow.`
                  : `Your payment for ${installmentName} is due in 5 days.`;

            transaction.create(notificationRef, {
              type: 'due_date_reminder',
              title: reminderTitle,
              message: reminderMessage,
              installmentId: installment.id,
              dueDate,
              daysUntilDue,
              read: false,
              status: 'sending',
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            return true;
          });

          if (!reserved) {
            continue;
          }

          const result = await sendEmail({
            to: email,
            subject:
              daysUntilDue === 0
                ? 'Payment Due Today - DueWise'
                : daysUntilDue === 1
                  ? 'Payment Due Tomorrow - DueWise'
                  : 'Payment Due in 5 Days - DueWise',
            html: paymentReminderEmail(installment, daysUntilDue),
          });

          await notificationRef.update({
            status: result.success ? 'sent' : 'failed',
            emailId: result.id || null,
            updatedAt: new Date(),
          });

          console.log(
            `Reminder ${result.success ? 'sent' : 'failed'}: ${installment.id}`
          );
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

  console.log('DueWise reminder scheduler started (8:00 AM Philippine time).');
};

module.exports = {
  startReminderScheduler,
  checkInstallmentReminders,
};