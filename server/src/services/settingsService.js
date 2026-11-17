
const { db } = require('../config/firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');

const getSettingsDocument = (uid) => {
  return db
    .collection('users')
    .doc(uid)
    .collection('settings')
    .doc('preferences');
};

const getSettings = async (uid) => {
  const document = await getSettingsDocument(uid).get();

  if (!document.exists) {
    return null;
  }

  return {
    ...document.data(),
  };
};

const saveSettings = async (uid, settingsData) => {
  const documentRef = getSettingsDocument(uid);

  const settings = {
    ...settingsData,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await documentRef.set(settings, { merge: true });

  const updatedDocument = await documentRef.get();

  return updatedDocument.data();
};

module.exports = {
  getSettings,
  saveSettings,
};
