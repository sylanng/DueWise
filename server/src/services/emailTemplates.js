const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[character];
  });

const emailLayout = (title, content) => `
  <div style="font-family: Arial, sans-serif; background: #F1F5F9; padding: 30px;">
    <div style="max-width: 560px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden;">
      <div style="background: #142746; padding: 24px; color: white;">
        <h1 style="margin: 0;">DueWise</h1>
        <p style="margin: 8px 0 0;">Stay ahead. Pay with confidence.</p>
      </div>
      <div style="padding: 28px; color: #142746;">
        <h2>${title}</h2>
        ${content}
      </div>
      <div style="padding: 18px; text-align: center; color: #64748B; font-size: 12px;">
        DueWise · BNPL Payment Projection System
      </div>
    </div>
  </div>
`;

const newInstallmentEmail = (installment) =>
  emailLayout(
    'New Installment Added',
    `
      <p>Your new installment has been added to DueWise.</p>
      <p><strong>Provider:</strong> ${escapeHtml(installment.provider)}</p>
      <p><strong>Description:</strong> ${escapeHtml(installment.description || 'Not provided')}</p>
      <p><strong>Payment Amount:</strong> ₱${Number(installment.amountPerPayment).toLocaleString('en-PH')}</p>
      <p><strong>Due Date:</strong> ${escapeHtml(installment.dueDate || 'Not set')}</p>
    `
  );

const paymentConfirmationEmail = (installment) =>
  emailLayout(
    'Payment Completed!',
    `
      <p>Your installment has been marked as paid.</p>
      <p><strong>Provider:</strong> ${escapeHtml(installment.provider)}</p>
      <p><strong>Description:</strong> ${escapeHtml(installment.description || 'Not provided')}</p>
      <p>Keep up the good work managing your payments!</p>
    `
  );

const newAllowanceEmail = (allowance) =>
  emailLayout('New Allowance Added', `
    <p>A new allowance has been added to your DueWise account.</p>
    <p><strong>Source:</strong> ${escapeHtml(allowance.source || 'Not provided')}</p>
    <p><strong>Description:</strong> ${escapeHtml(allowance.description || 'Not provided')}</p>
    <p><strong>Amount:</strong> ₱${Number(allowance.amount).toLocaleString('en-PH')}</p>
    <p><strong>Date Received:</strong> ${escapeHtml(allowance.dateReceived || 'Not set')}</p>
  `);

  const newExpenseEmail = (expense) =>
  emailLayout('New Expense Recorded', `
    <p>A new expense has been recorded in your DueWise account.</p>
    <p><strong>Expense:</strong> ${escapeHtml(expense.title || 'Not provided')}</p>
    <p><strong>Category:</strong> ${escapeHtml(expense.category || 'Not specified')}</p>
    <p><strong>Description:</strong> ${escapeHtml(expense.description || 'Not provided')}</p>
    <p><strong>Amount:</strong> ₱${Number(expense.amount).toLocaleString('en-PH')}</p>
    <p><strong>Date:</strong> ${escapeHtml(expense.date || 'Not set')}</p>
  `);

  // Payment reminder email templates
  const paymentReminderEmail = (installment, daysUntilDue) => {
    const reminderMessages = {
      5: 'Your installment payment is due in 5 days. Prepare your budget ahead of time.',
      1: 'Your installment payment is due tomorrow. Make sure you have enough funds ready.',
      0: 'Your installment payment is due today. Remember to settle your payment.',
    };

    const titles = {
      5: 'Payment Due in 5 Days',
      1: 'Payment Due Tomorrow',
      0: 'Payment Due Today',
    };

    const title = titles[daysUntilDue];

    if (!title) {
      throw new Error('Unsupported payment reminder schedule.');
    }

    return emailLayout(title, `
      <p>${reminderMessages[daysUntilDue]}</p>
      <p><strong>Provider:</strong> ${escapeHtml(installment.provider)}</p>
      <p><strong>Description:</strong> ${escapeHtml(installment.description || 'Not provided')}</p>
      <p><strong>Payment Amount:</strong> ₱${Number(installment.amountPerPayment).toLocaleString('en-PH')}</p>
      <p><strong>Due Date:</strong> ${escapeHtml(installment.nextDueDate || installment.dueDate || 'Not set')}</p>
      <p>Please plan your payment accordingly.</p>
    `);
  };

  module.exports = {
  newInstallmentEmail,
  paymentConfirmationEmail,
  newAllowanceEmail,
  newExpenseEmail,
  paymentReminderEmail,
};