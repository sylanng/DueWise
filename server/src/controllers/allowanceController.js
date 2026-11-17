
const allowanceService = require('../services/allowanceService');
const validateAllowance = require('../utils/allowanceValidator');

const { sendEmail } = require('../services/emailService');
const { newAllowanceEmail } = require('../services/emailTemplates');

// CREATE: Add allowance
const createAllowance = async (req, res) => {
  try {
    const validation = validateAllowance(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid allowance information.',
        errors: validation.errors,
      });
    }

    const allowance = await allowanceService.createAllowance(
      req.user.uid,
      req.body
    );

    await sendEmail({
      to: req.user.email,
      subject: 'New Allowance Added - DueWise',
      html: newAllowanceEmail(allowance),
    });

    return res.status(201).json({
      success: true,
      message: 'Allowance created successfully.',
      data: allowance,
    });
  } catch (error) {
    console.error('Create allowance error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create allowance.',
    });
  }
};

// READ: Get all allowances
const getAllAllowances = async (req, res) => {
  try {
    const allowances = await allowanceService.getAllAllowances(
      req.user.uid
    );

    return res.status(200).json({
      success: true,
      count: allowances.length,
      data: allowances,
    });
  } catch (error) {
    console.error('Get allowances error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve allowances.',
    });
  }
};

// READ: Get one allowance
const getAllowanceById = async (req, res) => {
  try {
    const allowance = await allowanceService.getAllowanceById(
      req.user.uid,
      req.params.id
    );

    if (!allowance) {
      return res.status(404).json({
        success: false,
        message: 'Allowance not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: allowance,
    });
  } catch (error) {
    console.error('Get allowance error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve allowance.',
    });
  }
};

// UPDATE: Edit allowance
const updateAllowance = async (req, res) => {
  try {
    const validation = validateAllowance(req.body, true);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid allowance information.',
        errors: validation.errors,
      });
    }

    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No update information provided.',
      });
    }

    const allowance = await allowanceService.updateAllowance(
      req.user.uid,
      req.params.id,
      req.body
    );

    if (!allowance) {
      return res.status(404).json({
        success: false,
        message: 'Allowance not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Allowance updated successfully.',
      data: allowance,
    });
  } catch (error) {
    console.error('Update allowance error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update allowance.',
    });
  }
};

// DELETE: Remove allowance
const deleteAllowance = async (req, res) => {
  try {
    const deleted = await allowanceService.deleteAllowance(
      req.user.uid,
      req.params.id
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Allowance not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Allowance deleted successfully.',
    });
  } catch (error) {
    console.error('Delete allowance error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete allowance.',
    });
  }
};

module.exports = {
  createAllowance,
  getAllAllowances,
  getAllowanceById,
  updateAllowance,
  deleteAllowance,
};
