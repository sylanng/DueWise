
const allowedCategories = [
  'Food',
  'Transportation',
  'Education',
  'Shopping',
  'Bills',
  'Others',
];

const allowedFields = [
  'title',
  'category',
  'amount',
  'date',
  'description',
];

const validateExpense = (data, isUpdate = false) => {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      valid: false,
      errors: ['Invalid expense data.'],
    };
  }

  // Reject fields that are not allowed
  const unsupportedFields = Object.keys(data).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unsupportedFields.length > 0) {
    errors.push(
      `Unsupported fields: ${unsupportedFields.join(', ')}`
    );
  }

  // Required fields when creating an expense
  if (!isUpdate) {
    ['title', 'category', 'amount', 'date'].forEach((field) => {
      if (
        data[field] === undefined ||
        data[field] === null ||
        data[field] === ''
      ) {
        errors.push(`${field} is required.`);
      }
    });
  }

  // Validate title
  if (
    data.title !== undefined &&
    (typeof data.title !== 'string' || !data.title.trim())
  ) {
    errors.push('Expense title must be a non-empty text.');
  }

  // Validate category
  if (
    data.category !== undefined &&
    !allowedCategories.includes(data.category)
  ) {
    errors.push('Invalid expense category.');
  }

  // Validate amount
  if (data.amount !== undefined) {
    if (
      typeof data.amount !== 'number' ||
      !Number.isFinite(data.amount) ||
      data.amount <= 0
    ) {
      errors.push('Amount must be a number greater than zero.');
    }
  }

  // Validate date
  if (data.date !== undefined) {
    if (
      typeof data.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.date)
    ) {
      errors.push('Date must use YYYY-MM-DD format.');
    } else {
      const parsedDate = new Date(`${data.date}T00:00:00.000Z`);

      if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== data.date
      ) {
        errors.push('Please provide a valid expense date.');
      }
    }
  }

  // Validate description
  if (
    data.description !== undefined &&
    typeof data.description !== 'string'
  ) {
    errors.push('Description must be text.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

module.exports = {
  validateExpense,
};
