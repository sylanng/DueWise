
const { db } = require('../config/firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');

// Get the logged-in user's expense collection
const getExpenseCollection = (uid) =>
  db.collection('users').doc(uid).collection('expenses');

// CREATE EXPENSE
const createExpense = async (uid, expenseData) => {
  const collection = getExpenseCollection(uid);

  const newExpense = {
    title: expenseData.title.trim(),
    category: expenseData.category,
    amount: expenseData.amount,
    date: expenseData.date,
    description: expenseData.description?.trim() || '',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const document = await collection.add(newExpense);

  return {
    id: document.id,
    ...newExpense,
  };
};

// GET ALL EXPENSES
const getAllExpenses = async (uid) => {
  const snapshot = await getExpenseCollection(uid).get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

// GET ONE EXPENSE
const getExpenseById = async (uid, id) => {
  const document = await getExpenseCollection(uid).doc(id).get();

  if (!document.exists) {
    return null;
  }

  return {
    id: document.id,
    ...document.data(),
  };
};

// UPDATE EXPENSE
const updateExpense = async (uid, id, updateData) => {
  const documentRef = getExpenseCollection(uid).doc(id);
  const document = await documentRef.get();

  if (!document.exists) {
    return null;
  }

  const updates = {
    ...updateData,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (typeof updates.title === 'string') {
    updates.title = updates.title.trim();
  }

  if (typeof updates.description === 'string') {
    updates.description = updates.description.trim();
  }

  await documentRef.update(updates);

  const updatedDocument = await documentRef.get();

  return {
    id: updatedDocument.id,
    ...updatedDocument.data(),
  };
};

// DELETE EXPENSE
const deleteExpense = async (uid, id) => {
  const documentRef = getExpenseCollection(uid).doc(id);
  const document = await documentRef.get();

  if (!document.exists) {
    return false;
  }

  await documentRef.delete();

  return true;
};

module.exports = {
  createExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
};
