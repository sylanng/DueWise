
const { db } = require('../config/firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');

// Get the authenticated user's allowance collection
const getAllowanceCollection = (uid) => {
  return db
    .collection('users')
    .doc(uid)
    .collection('allowances');
};

// CREATE: Add allowance
const createAllowance = async (uid, allowanceData) => {
  const collection = getAllowanceCollection(uid);

  const newAllowance = {
    source: allowanceData.source.trim(),
    amount: allowanceData.amount,
    dateReceived: allowanceData.dateReceived,
    description: allowanceData.description?.trim() || '',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const document = await collection.add(newAllowance);

  return {
    id: document.id,
    ...newAllowance,
  };
};

// READ: Get all allowances
const getAllAllowances = async (uid) => {
  const snapshot = await getAllowanceCollection(uid).get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

// READ: Get one allowance
const getAllowanceById = async (uid, allowanceId) => {
  const document = await getAllowanceCollection(uid)
    .doc(allowanceId)
    .get();

  if (!document.exists) return null;

  return {
    id: document.id,
    ...document.data(),
  };
};

// UPDATE: Edit allowance
const updateAllowance = async (uid, allowanceId, updateData) => {
  const documentRef = getAllowanceCollection(uid).doc(allowanceId);

  const document = await documentRef.get();

  if (!document.exists) return null;

  const updates = { ...updateData };

  if (typeof updates.source === 'string') {
    updates.source = updates.source.trim();
  }

  if (typeof updates.description === 'string') {
    updates.description = updates.description.trim();
  }

  await documentRef.update({
    ...updates,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const updatedDocument = await documentRef.get();

  return {
    id: updatedDocument.id,
    ...updatedDocument.data(),
  };
};

// DELETE: Remove allowance
const deleteAllowance = async (uid, allowanceId) => {
  const documentRef = getAllowanceCollection(uid).doc(allowanceId);

  const document = await documentRef.get();

  if (!document.exists) return false;

  await documentRef.delete();

  return true;
};

module.exports = {
  createAllowance,
  getAllAllowances,
  getAllowanceById,
  updateAllowance,
  deleteAllowance,
};
