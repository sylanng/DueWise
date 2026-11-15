
const allowedFields = [
  'source',
  'amount',
  'dateReceived',
  'description',
];

const validateAllowance = (data, isUpdate = false) => {
  const errors = {};

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {
    return {
      valid: false,
      errors: { body: 'Invalid request data.' },
    };
  }

  // Reject unsupported fields
  const invalidFields = Object.keys(data).filter(
    (field) => !allowedFields.includes(field)
  );

  if (invalidFields.length > 0) {
    errors.fields = `Unsupported fields: ${invalidFields.join(', ')}`;
  }

  // Check required fields when creating
  if (!isUpdate) {
    ['source', 'amount', 'dateReceived'].forEach((field) => {
      if (
        data[field] === undefined ||
        data[field] === null ||
        data[field] === ''
      ) {
        errors[field] = `${field} is required.`;
      }
    });
  }

  // Validate source
  if (
    data.source !== undefined &&
    (
      typeof data.source !== 'string' ||
      !data.source.trim()
    )
  ) {
    errors.source = 'Source must be a non-empty text value.';
  }

  // Validate amount
  if (data.amount !== undefined) {
    if (
      typeof data.amount !== 'number' ||
      !Number.isFinite(data.amount) ||
      data.amount <= 0
    ) {
      errors.amount = 'Amount must be a number greater than zero.';
    }
  }

  // Validate date received strictly (YYYY-MM-DD)
if (data.dateReceived !== undefined) {
  const date = data.dateReceived;

  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    errors.dateReceived = 'Date received must use YYYY-MM-DD format.';
  } else {
    const [year, month, day] = date.split('-').map(Number);

    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    const isValidDate =
      parsedDate.getUTCFullYear() === year &&
      parsedDate.getUTCMonth() === month - 1 &&
      parsedDate.getUTCDate() === day;

    if (!isValidDate) {
      errors.dateReceived = 'Please provide a valid calendar date.';
    }
  }
}

  // Validate optional description
  if (
    data.description !== undefined &&
    typeof data.description !== 'string'
  ) {
    errors.description = 'Description must be text.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

module.exports = validateAllowance;
