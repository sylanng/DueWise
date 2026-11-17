const { db } = require('../config/firebaseAdmin');

// Get a user's financial collections
const getUserCollection = (uid, collectionName) =>
  db.collection('users').doc(uid).collection(collectionName);

// Get the user's settings document
const getSettingsDocument = (uid) =>
  db
    .collection('users')
    .doc(uid)
    .collection('settings')
    .doc('preferences');

// Format a date as YYYY-MM-DD using the server's local calendar date
const getToday = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

// Convert a date into YYYY-MM-DD
const getDateKey = (value) => {
  if (!value) return null;

  if (typeof value === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
    return match ? match[1] : null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  if (typeof value.toDate === 'function') {
    return getDateKey(value.toDate());
  }

  return null;
};

// Round monetary values to two decimal places
const roundMoney = (amount) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

// Add one payment period to a date
const getNextPaymentDate = (dateString, frequency) => {
  const [year, month, day] = dateString.split('-').map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (frequency === 'weekly') {
    date.setUTCDate(date.getUTCDate() + 7);
  } else if (frequency === 'biweekly') {
    date.setUTCDate(date.getUTCDate() + 14);
  } else if (frequency === 'monthly') {
    const nextMonth = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
    );

    const lastDay = new Date(
      Date.UTC(
        nextMonth.getUTCFullYear(),
        nextMonth.getUTCMonth() + 1,
        0
      )
    ).getUTCDate();

    nextMonth.setUTCDate(Math.min(day, lastDay));

    return nextMonth.toISOString().slice(0, 10);
  } else {
    throw new Error('Unsupported installment payment frequency.');
  }

  return date.toISOString().slice(0, 10);
};

// Calculate the amount already paid for an installment.
// Older payments without transaction records are estimated
// using the recorded paidPayments count.
const getAmountAlreadyPaid = (installment, transactions) => {
  const paidPayments = Math.max(
    0,
    Number(installment.paidPayments || 0)
  );

  const amountPerPayment = Number(installment.amountPerPayment || 0);

  const relatedTransactions = transactions.filter(
    (item) =>
        item.installmentId === installment.id &&
        item.status === 'paid'
  );

  const recordedAmount = relatedTransactions.reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  );

  const missingPaymentCount = Math.max(
    0,
    paidPayments - relatedTransactions.length
  );

  const estimatedOlderPayments =
    missingPaymentCount * amountPerPayment;

  return roundMoney(recordedAmount + estimatedOlderPayments);
};

// Main financial projection calculation
const getFinancialProjection = async (uid) => {
  const [
    allowancesSnapshot,
    expensesSnapshot,
    installmentsSnapshot,
    transactionsSnapshot,
    settingsDocument,
  ] = await Promise.all([
    getUserCollection(uid, 'allowances').get(),
    getUserCollection(uid, 'expenses').get(),
    getUserCollection(uid, 'installments').get(),
    getUserCollection(uid, 'transactions').get(),
    getSettingsDocument(uid).get(),
  ]);

  const allowances = allowancesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const expenses = expensesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const installments = installmentsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const transactions = transactionsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const settings = settingsDocument.exists
    ? settingsDocument.data()
    : {};

  const today = getToday();

  const trackingStartDate =
    settings.trackingStartDate || today;

  const startingBalance = Number(settings.openingBalance || 0);
  const reserveLimit = Number(settings.reserveLimit || 0);

  if (
    !Number.isFinite(startingBalance) ||
    startingBalance < 0 ||
    !Number.isFinite(reserveLimit) ||
    reserveLimit < 0
  ) {
    throw new Error('Invalid financial settings.');
  }

  // Calculate actual allowance income
  const actualAllowances = allowances.filter((item) => {
    const date = getDateKey(item.dateReceived);

    return (
      date &&
      date >= trackingStartDate &&
      date <= today
    );
  });

  const totalReceived = roundMoney(
    actualAllowances.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    )
  );

  // Calculate actual expenses
  const actualExpenses = expenses.filter((item) => {
    const date = getDateKey(item.date);

    return (
      date &&
      date >= trackingStartDate &&
      date <= today
    );
  });

  const totalExpenses = roundMoney(
    actualExpenses.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    )
  );

  // Calculate confirmed BNPL payments
  const actualTransactions = transactions.filter((item) => {
    const date = getDateKey(item.paidAt);

    return (
      item.status === 'paid' &&
      date &&
      date >= trackingStartDate &&
      date <= today
    );
  });

  const totalBNPLPaid = roundMoney(
    actualTransactions.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    )
  );

  // Calculate actual available balance
  const actualBalance = roundMoney(
    startingBalance +
    totalReceived -
    totalExpenses -
    totalBNPLPaid
  );

  // Prepare future cash-flow events
  const futureCashFlows = [];

  // Future allowances
  allowances.forEach((item) => {
    const date = getDateKey(item.dateReceived);

    if (
      date &&
      date > today &&
      date >= trackingStartDate
    ) {
      futureCashFlows.push({
        date,
        type: 'income',
        description: item.source || 'Allowance',
        amount: roundMoney(Number(item.amount || 0)),
      });
    }
  });

  // Future expenses
  expenses.forEach((item) => {
    const date = getDateKey(item.date);

    if (
      date &&
      date > today &&
      date >= trackingStartDate
    ) {
      futureCashFlows.push({
        date,
        type: 'expense',
        description: item.title || 'Expense',
        amount: roundMoney(Number(item.amount || 0)),
      });
    }
  });

  // Calculate remaining installment obligations
  let remainingBNPLBalance = 0;

  installments.forEach((installment) => {
    if (installment.status === 'paid') return;

    const totalPayments = Number(installment.totalPayments);
    const paidPayments = Number(installment.paidPayments || 0);
    const amountPerPayment = Number(installment.amountPerPayment);
    const totalAmount = Number(installment.totalAmount);

    if (
      !Number.isInteger(totalPayments) ||
      !Number.isInteger(paidPayments) ||
      totalPayments <= 0 ||
      paidPayments < 0 ||
      paidPayments > totalPayments ||
      !Number.isFinite(amountPerPayment) ||
      amountPerPayment <= 0 ||
      !Number.isFinite(totalAmount) ||
      totalAmount <= 0
    ) {
      throw new Error(
        `Invalid payment information for installment ${installment.id}.`
      );
    }

    const amountAlreadyPaid = getAmountAlreadyPaid(
      installment,
      transactions
    );

    const remainingAmount = roundMoney(
      Math.max(0, totalAmount - amountAlreadyPaid)
    );

    if (remainingAmount <= 0) return;

    remainingBNPLBalance = roundMoney(
      remainingBNPLBalance + remainingAmount
    );

    let nextDueDate = getDateKey(
      installment.nextDueDate || installment.dueDate
    );

    if (!nextDueDate) {
      throw new Error(
        `Invalid due date for installment ${installment.id}.`
      );
    }

    const remainingPayments = totalPayments - paidPayments;

    if (remainingPayments <= 0) {
      throw new Error(
        `Invalid remaining payment count for installment ${installment.id}.`
      );
    }

    let scheduledBalance = remainingAmount;

    for (let index = 0; index < remainingPayments; index += 1) {
      if (scheduledBalance <= 0) break;

      const paymentAmount =
        index === remainingPayments - 1
          ? scheduledBalance
          : Math.min(amountPerPayment, scheduledBalance);

      const scheduledDate =
        nextDueDate < today ? today : nextDueDate;

        futureCashFlows.push({
        date: scheduledDate,
        originalDueDate: nextDueDate,
        type: 'installment',
        description: installment.description || 'BNPL Payment',
        provider: installment.provider || 'Unknown Provider',
        installmentId: installment.id,
        amount: roundMoney(paymentAmount),
        });

        scheduledBalance = roundMoney(
        scheduledBalance - paymentAmount
        );

        if (index < remainingPayments - 1) {
        nextDueDate = getNextPaymentDate(
            scheduledDate,
            installment.paymentFrequency
        );
        }
    }
  });

  // Sort upcoming cash flows by date
  futureCashFlows.sort((a, b) => {
    return a.date.localeCompare(b.date);
  });

  // Calculate projected balance after each future event
  let projectedBalance = actualBalance;

  const projectionTimeline = futureCashFlows.map((event) => {
    if (event.type === 'income') {
      projectedBalance += event.amount;
    } else {
      projectedBalance -= event.amount;
    }

    projectedBalance = roundMoney(projectedBalance);

    return {
      ...event,
      projectedBalance,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    trackingStartDate,
    summary: {
      startingBalance: roundMoney(startingBalance),
      totalReceived,
      totalExpenses,
      totalBNPLPaid,
      actualBalance,
      remainingBNPLBalance: roundMoney(remainingBNPLBalance),
      projectedBalance,
      reserveLimit: roundMoney(reserveLimit),
      isBelowReserve: actualBalance < reserveLimit,
    },
    futureCashFlows,
    projectionTimeline,
  };
};

module.exports = {
  getFinancialProjection,
};