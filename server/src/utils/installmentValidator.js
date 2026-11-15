
const allowedFields = [
  'provider',
  'description',
  'amountPerPayment',
  'totalAmount',
  'dueDate',
  'status',
  'totalPayments',
  'paidPayments',
  'paymentFrequency',
  'nextDueDate',
];

const validStatuses = [
  'unpaid',
  'partially_paid',
  'paid',
];

const validateInstallment = (data, isUpdate = false) => {
  const errors = {};

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: { body: 'Invalid request data.' } };
  }

  // Reject fields that are not part of the installment model
  const invalidFields = Object.keys(data).filter(
    (field) => !allowedFields.includes(field)
  );

  if (invalidFields.length > 0) {
    errors.fields = `Unsupported fields: ${invalidFields.join(', ')}`;
  }

  const requiredFields = [
    'provider',
    'description',
    'amountPerPayment',
    'totalAmount',
    'dueDate',
    'totalPayments',
    'paymentFrequency',
  ];

  // Check required fields
  if (!isUpdate) {
    requiredFields.forEach((field) => {
      if (
        data[field] === undefined ||
        data[field] === null ||
        data[field] === ''
      ) {
        errors[field] = `${field} is required.`;
      }
    });
  }

  // Validate text fields
  ['provider', 'description', 'paymentFrequency'].forEach((field) => {
    if (
      data[field] !== undefined &&
      (typeof data[field] !== 'string' || !data[field].trim())
    ) {
      errors[field] = `${field} must be a non-empty text value.`;
    }
  });

  // Validate positive monetary amounts
  ['amountPerPayment', 'totalAmount'].forEach((field) => {
    if (data[field] !== undefined) {
      const amount = data[field];

      if (
        typeof amount !== 'number' ||
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        errors[field] = `${field} must be a number greater than zero.`;
      }
    }
  });

  // Validate payment counts
  ['totalPayments', 'paidPayments'].forEach((field) => {
    if (data[field] !== undefined) {
      if (
        !Number.isInteger(data[field]) ||
        data[field] < 0
      ) {
        errors[field] = `${field} must be a non-negative integer.`;
      }
    }
  });

  if (
    data.totalPayments !== undefined &&
    data.totalPayments < 1
  ) {
    errors.totalPayments = 'totalPayments must be at least 1.';
  }

  if (
    data.paidPayments !== undefined &&
    data.totalPayments !== undefined &&
    data.paidPayments > data.totalPayments
  ) {
    errors.paidPayments = 'paidPayments cannot exceed totalPayments.';
  }

  // Validate dates strictly (YYYY-MM-DD)
    ['dueDate', 'nextDueDate'].forEach((field) => {
    if (data[field] !== undefined) {
        const date = data[field];

        if (
        typeof date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
        ) {
        errors[field] = `${field} must be a valid date in YYYY-MM-DD format.`;
        } else {
        const [year, month, day] = date.split('-').map(Number);

        const parsedDate = new Date(Date.UTC(year, month - 1, day));

        const isValidDate =
            parsedDate.getUTCFullYear() === year &&
            parsedDate.getUTCMonth() === month - 1 &&
            parsedDate.getUTCDate() === day;

        if (!isValidDate) {
            errors[field] = `${field} must be a valid calendar date.`;
        }
        }
    }
    });

  
  // Validate status
  if (
    data.status !== undefined &&
    !validStatuses.includes(data.status)
  ) {
    errors.status = 'Invalid installment status.';
  }

  // New installments must always start unpaid
  if (!isUpdate) {
    if (data.status !== undefined && data.status !== 'unpaid') {
      errors.status = 'New installments must start as unpaid.';
    }

    if (
      data.paidPayments !== undefined &&
      data.paidPayments !== 0
    ) {
      errors.paidPayments = 'New installments must start with zero paid payments.';
    }

    // Ensure the payment plan covers the total amount
    const amountPerPayment = Number(data.amountPerPayment);
    const totalAmount = Number(data.totalAmount);
    const totalPayments = Number(data.totalPayments);

    if (
      Number.isFinite(amountPerPayment) &&
      amountPerPayment > 0 &&
      Number.isFinite(totalAmount) &&
      totalAmount > 0 &&
      Number.isInteger(totalPayments) &&
      totalPayments > 0
    ) {
      const minimumCovered = Math.round(
        amountPerPayment * (totalPayments - 1) * 100
      ) / 100;

      const maximumCovered = Math.round(
        amountPerPayment * totalPayments * 100
      ) / 100;

      if (
        totalAmount <= minimumCovered ||
        totalAmount > maximumCovered
      ) {
        errors.totalAmount =
          'The total amount must be greater than the first payments combined and no greater than all scheduled payments combined.';
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

module.exports = validateInstallment;
