
const financialProjectionService = require('../services/financialProjectionService');

const getFinancialProjection = async (req, res) => {
  try {
    const projection =
      await financialProjectionService.getFinancialProjection(
        req.user.uid
      );

    return res.status(200).json({
      success: true,
      data: projection,
    });
  } catch (error) {
    console.error('Get financial projection error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to calculate financial projection.',
    });
  }
};

module.exports = {
  getFinancialProjection,
};
