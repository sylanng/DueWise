
const { db } = require('../config/firebaseAdmin');

// Get a user's Firestore collection
const getUserCollection = (uid, collectionName) =>
  db.collection('users').doc(uid).collection(collectionName);

// Get today's date in Philippine time
const getToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

// Convert a date into YYYY-MM-DD
const getDateKey = (value) => {
  if (!value) return '';

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  if (value.toDate) {
    return value.toDate().toISOString().slice(0, 10);
  }

  return '';
};

// READ: Get unified financial activity
const getAllTransactions = async (uid) => {
  const [
    allowancesSnapshot,
    expensesSnapshot,
    transactionsSnapshot,
    installmentsSnapshot,
  ] = await Promise.all([
    getUserCollection(uid, 'allowances').get(),
    getUserCollection(uid, 'expenses').get(),
    getUserCollection(uid, 'transactions').get(),
    getUserCollection(uid, 'installments').get(),
  ]);

  const today = getToday();

  // Allowances
  const allowances = allowancesSnapshot.docs.map((doc) => {
    const item = doc.data();
    const activityDate = getDateKey(item.dateReceived);

    return {
      id: `allowance-${doc.id}`,
      originalId: doc.id,
      recordType: 'allowance',
      activityType: 'income',
      description: item.source || 'Allowance Received',
      category: 'Allowance',
      amount: Number(item.amount || 0),
      activityDate,
      status: activityDate > today ? 'scheduled' : 'completed',
      details: item.description || '',
    };
  });

  // Expenses
  const expenses = expensesSnapshot.docs.map((doc) => {
    const item = doc.data();
    const activityDate = getDateKey(item.date);

    return {
      id: `expense-${doc.id}`,
      originalId: doc.id,
      recordType: 'expense',
      activityType: 'expense',
      description: item.title || 'Expense',
      category: item.category || 'Others',
      amount: Number(item.amount || 0),
      activityDate,
      status: activityDate > today ? 'scheduled' : 'completed',
      details: item.description || '',
    };
  });

  // Confirmed BNPL payments
  const bnplPayments = transactionsSnapshot.docs.map((doc) => {
    const item = doc.data();
    const activityDate = getDateKey(item.paidAt);

    return {
      id: `bnpl-${doc.id}`,
      originalId: doc.id,
      recordType: 'installment_payment',
      installmentId: item.installmentId || null,
      activityType: 'bnpl',
      description: item.description || 'Installment Payment',
      category: 'BNPL Payment',
      provider: item.provider || 'Unknown Provider',
      amount: Number(item.amount || 0),
      activityDate,
      status: item.status || 'paid',
      details: '',
    };
  });

  // Installment plans and their current payment status
  const installmentPlans = installmentsSnapshot.docs.map((doc) => {
    const item = doc.data();

    const dueDate = getDateKey(
      item.nextDueDate || item.dueDate
    );

    const originalStatus = item.status || 'unpaid';

    let status;

    if (originalStatus === 'paid') {
      status = 'paid';
    } else if (dueDate && dueDate < today) {
      status = 'overdue';
    } else {
      status = 'pending';
    }

    const totalAmount = Number(item.totalAmount || 0);
    const amountPerPayment = Number(item.amountPerPayment || 0);
    const paidPayments = Number(item.paidPayments || 0);

    const estimatedPaidAmount =
        originalStatus === 'paid'
            ? totalAmount
            : Math.min(
                totalAmount,
                paidPayments * amountPerPayment
            );

    return {
      id: `installment-${doc.id}`,
      originalId: doc.id,
      recordType: 'installment_plan',
      installmentId: doc.id,
      activityType: 'bnpl',
      description: item.description || item.provider || 'Installment Plan',
      category: 'Installment',
      provider: item.provider || 'Unknown Provider',
      amount: totalAmount,
      totalAmount,
      amountPerPayment,
      totalPayments: Number(item.totalPayments || 0),
      paidPayments,
      estimatedPaidAmount,
      remainingAmount: Math.max(
        0,
        totalAmount - estimatedPaidAmount
      ),
      dueDate,
      activityDate: dueDate,
      status,
      paymentFrequency: item.paymentFrequency || '',
    };
  });

  // Combine records for display only.
  // No new Firestore documents are created.
  return [
    ...allowances,
    ...expenses,
    ...bnplPayments,
    ...installmentPlans,
  ]
    .filter((item) => item.activityDate)
    .sort((a, b) =>
      b.activityDate.localeCompare(a.activityDate)
    );
};

module.exports = {
  getAllTransactions,
};
