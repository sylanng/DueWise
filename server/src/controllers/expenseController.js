
const expenseService = require('../services/expenseService');
const { validateExpense } = require('../utils/expenseValidator');


const { sendEmail } = require('../services/emailService');
const { newExpenseEmail } = require('../services/emailTemplates');

// CREATE EXPENSE
const createExpense = async (req, res) => {
  try {
    const validation = validateExpense(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: validation.errors,
      });
    }

    const expense = await expenseService.createExpense(
      req.user.uid,
      req.body
    );

    await sendEmail({
      to: req.user.email,
      subject: 'New Expense Recorded - DueWise',
      html: newExpenseEmail(expense),
    });

    return res.status(201).json({
      success: true,
      message: 'Expense created successfully.',
      data: expense,
    });
  } catch (error) {
    console.error('Create Expense Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create expense.',
    });
  }
};

// GET ALL EXPENSES
const getAllExpenses = async (req, res) => {
  try {
    const expenses = await expenseService.getAllExpenses(
      req.user.uid
    );

    return res.status(200).json({
      success: true,
      count: expenses.length,
      data: expenses,
    });
  } catch (error) {
    console.error('Get Expenses Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve expenses.',
    });
  }
};

// GET ONE EXPENSE
const getExpenseById = async (req, res) => {
  try {
    const expense = await expenseService.getExpenseById(
      req.user.uid,
      req.params.id
    );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    console.error('Get Expense Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve expense.',
    });
  }
};

// UPDATE EXPENSE
const updateExpense = async (req, res) => {
  try {
    const validation = validateExpense(req.body, true);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: validation.errors,
      });
    }

    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one field to update.',
      });
    }

    const expense = await expenseService.updateExpense(
      req.user.uid,
      req.params.id,
      req.body
    );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Expense updated successfully.',
      data: expense,
    });
  } catch (error) {
    console.error('Update Expense Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update expense.',
    });
  }
};

// DELETE EXPENSE
const deleteExpense = async (req, res) => {
  try {
    const deleted = await expenseService.deleteExpense(
      req.user.uid,
      req.params.id
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Expense deleted successfully.',
    });
  } catch (error) {
    console.error('Delete Expense Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete expense.',
    });
  }
};

module.exports = {
  createExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
};
