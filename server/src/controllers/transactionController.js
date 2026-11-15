
const transactionService = require('../services/transactionService');

// READ: Get all transactions for the authenticated user
const getAllTransactions = async (req, res) => {
  try {
    const transactions = await transactionService.getAllTransactions(
      req.user.uid
    );

    return res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    console.error('Get transactions error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve transactions.',
    });
  }
};

module.exports = {
  getAllTransactions,
};
