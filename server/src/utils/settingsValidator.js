
const allowedFields = [
  'fullName',
  'email',
  'openingBalance',
  'reserveLimit',
  'currency',
  'emailNotifications',
  'dueDateReminders',
  'lowBalanceAlerts',
  'trackingStartDate',
];

const validateSettings = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'Invalid settings data.';
  }

  const unsupportedFields = Object.keys(data).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unsupportedFields.length > 0) {
    return `Unsupported fields: ${unsupportedFields.join(', ')}`;
  }

  if (Object.keys(data).length === 0) {
    return 'Please provide at least one setting to update.';
  }

  if (
    data.fullName !== undefined &&
    (typeof data.fullName !== 'string' || !data.fullName.trim())
  ) {
    return 'Full name must not be empty.';
  }

  if (
    data.email !== undefined &&
    typeof data.email !== 'string'
  ) {
    return 'Email must be valid text.';
  }

  if (
    data.email !== undefined &&
    data.email.trim() !== '' &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())
  ) {
    return 'Please provide a valid email address.';
  }

  for (const field of ['openingBalance', 'reserveLimit']) {
    if (data[field] !== undefined) {
      const amount = data[field];

      if (
        typeof amount !== 'number' ||
        !Number.isFinite(amount) ||
        amount < 0
      ) {
        return `${field} must be a valid non-negative number.`;
      }
    }
  }

  if (
    data.currency !== undefined &&
    data.currency !== 'PHP'
  ) {
    return 'Only PHP currency is supported.';
  }

  if (data.trackingStartDate !== undefined) {
    const date = data.trackingStartDate;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');

    if (!match) {
      return 'Tracking start date must use YYYY-MM-DD format.';
    }

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);

    const parsedDate = new Date(Date.UTC(year, month, day));

    if (
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== month ||
      parsedDate.getUTCDate() !== day
    ) {
      return 'Please provide a valid tracking start date.';
    }
  }

  const booleanFields = [
    'emailNotifications',
    'dueDateReminders',
    'lowBalanceAlerts',
  ];

  for (const field of booleanFields) {
    if (
      data[field] !== undefined &&
      typeof data[field] !== 'boolean'
    ) {
      return `${field} must be true or false.`;
    }
  }

  return null;
};

module.exports = validateSettings;
