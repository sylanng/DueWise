const { auth } = require('../config/firebaseAdmin');

const {
  getSettings,
  saveSettings,
} = require('../services/settingsService');

const validateSettings = require('../utils/settingsValidator');

const getUserSettings = async (req, res) => {
  try {
    const settings = await getSettings(req.user.uid);

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Get Settings Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve settings.',
    });
  }
};

const updateUserSettings = async (req, res) => {
  try {
    const validationError = validateSettings(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    // Update Firebase Authentication profile when fullName is provided.
    if (req.body.fullName !== undefined) {
      await auth.updateUser(req.user.uid, {
        displayName: req.body.fullName.trim(),
      });
    }

    // Save the settings in Firestore.
    const settings = await saveSettings(req.user.uid, req.body);

    return res.status(200).json({
      success: true,
      message: 'Settings saved successfully.',
      data: settings,
    });
  } catch (error) {
    console.error('Update Settings Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to save settings.',
    });
  }
};

module.exports = {
  getUserSettings,
  updateUserSettings,
};
