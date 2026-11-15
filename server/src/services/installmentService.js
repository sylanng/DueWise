const { db } = require('../config/firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');

// Get the authenticated user's installment collection
const getInstallmentCollection = (uid) => {
  return db
    .collection('users')
    .doc(uid)
    .collection('installments');
};

// Advance the payment date based on its frequency
const getNextDueDate = (currentDate, frequency) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(currentDate || '');

  if (!match) {
    throw new Error('Invalid installment due date.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error('Invalid installment due date.');
  }

  if (frequency === 'weekly') {
    date.setUTCDate(date.getUTCDate() + 7);
  } else if (frequency === 'biweekly') {
    date.setUTCDate(date.getUTCDate() + 14);
  } else if (frequency === 'monthly') {
    const originalDay = date.getUTCDate();

    const nextMonth = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
    );

    const lastDayOfNextMonth = new Date(
      Date.UTC(
        nextMonth.getUTCFullYear(),
        nextMonth.getUTCMonth() + 1,
        0
      )
    ).getUTCDate();

    nextMonth.setUTCDate(
      Math.min(originalDay, lastDayOfNextMonth)
    );

    return nextMonth.toISOString().slice(0, 10);
  } else {
    throw new Error('Unsupported payment frequency.');
  }

  return date.toISOString().slice(0, 10);
};

// CREATE: Add a new installment
const createInstallment = async (uid, installmentData) => {
  const collection = getInstallmentCollection(uid);

  const newInstallment = {
    ...installmentData,
    status: installmentData.status || 'unpaid',
    paidPayments: installmentData.paidPayments ?? 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const document = await collection.add(newInstallment);

  return {
    id: document.id,
    ...newInstallment,
  };
};

// READ: Get all installments
const getAllInstallments = async (uid) => {
  const snapshot = await getInstallmentCollection(uid).get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

// READ: Get one installment
const getInstallmentById = async (uid, installmentId) => {
  const document = await getInstallmentCollection(uid)
    .doc(installmentId)
    .get();

  if (!document.exists) {
    return null;
  }

  return {
    id: document.id,
    ...document.data(),
  };
};

// UPDATE: Edit an installment
const updateInstallment = async (
  uid,
  installmentId,
  updateData
) => {
  const documentRef = getInstallmentCollection(uid)
    .doc(installmentId);

  const document = await documentRef.get();

  if (!document.exists) {
    return null;
  }

  await documentRef.update({
    ...updateData,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const updatedDocument = await documentRef.get();

  return {
    id: updatedDocument.id,
    ...updatedDocument.data(),
  };
};


// RECORD PAYMENT: Atomically update installment and save transaction history
const recordInstallmentPayment = async (uid, installmentId) => {
  const documentRef = getInstallmentCollection(uid).doc(installmentId);

  const transactionsRef = db
    .collection('users')
    .doc(uid)
    .collection('transactions');

  return db.runTransaction(async (transaction) => {
    const document = await transaction.get(documentRef);

    if (!document.exists) {
      return null;
    }

    const data = document.data();

    const totalPayments = Number(data.totalPayments || 0);
    const paidPayments = Number(data.paidPayments || 0);

    if (data.status === 'paid' || paidPayments >= totalPayments) {
      const error = new Error(
        'All installment payments are already completed.'
      );
      error.code = 'PAYMENTS_COMPLETED';
      throw error;
    }

    if (
      !Number.isInteger(totalPayments) ||
      !Number.isInteger(paidPayments) ||
      totalPayments <= 0 ||
      paidPayments < 0
    ) {
      throw new Error('Invalid installment payment information.');
    }

    
const amountPerPayment = Number(data.amountPerPayment);
const totalAmount = Number(data.totalAmount);

if (
  !Number.isFinite(amountPerPayment) ||
  amountPerPayment <= 0 ||
  !Number.isFinite(totalAmount) ||
  totalAmount <= 0
) {
  throw new Error('Invalid installment payment amount.');
}

const roundMoney = (amount) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

const amountAlreadyPaid = roundMoney(
  paidPayments * amountPerPayment
);

const remainingAmount = roundMoney(
  totalAmount - amountAlreadyPaid
);

if (remainingAmount <= 0) {
  throw new Error('No remaining installment balance.');
}

const newPaidPayments = paidPayments + 1;
const isCompleted = newPaidPayments >= totalPayments;

const paymentAmount = isCompleted
  ? remainingAmount
  : Math.min(amountPerPayment, remainingAmount);


    const paymentDate = new Date();
    const paidAt = paymentDate.toISOString();

    const nextDueDate = isCompleted
      ? data.nextDueDate || data.dueDate
      : getNextDueDate(
          data.nextDueDate || data.dueDate,
          data.paymentFrequency
        );

    const updatedData = {
      paidPayments: newPaidPayments,
      status: isCompleted ? 'paid' : 'partially_paid',
      nextDueDate,
      updatedAt: FieldValue.serverTimestamp(),
    };

    const paymentRef = transactionsRef.doc();

    const paymentRecord = {
      installmentId,
      description: data.description || 'Installment Payment',
      provider: data.provider || 'Unknown Provider',
      amount: paymentAmount,
      status: 'paid',
      paidAt,
      createdAt: FieldValue.serverTimestamp(),
    };

    transaction.update(documentRef, updatedData);
    transaction.set(paymentRef, paymentRecord);

    return {
      id: document.id,
      ...data,
      ...updatedData,
    };
  });
};

// DELETE: Remove an installment
const deleteInstallment = async (uid, installmentId) => {
  const documentRef = getInstallmentCollection(uid)
    .doc(installmentId);

  const document = await documentRef.get();

  if (!document.exists) {
    return false;
  }

  await documentRef.delete();

  return true;
};

module.exports = {
  createInstallment,
  getAllInstallments,
  getInstallmentById,
  updateInstallment,
  recordInstallmentPayment,
  deleteInstallment,
};