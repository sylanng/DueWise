
const installmentService = require('../services/installmentService');
const validateInstallment = require('../utils/installmentValidator');
const { db } = require('../config/firebaseAdmin');

const { sendEmail } = require('../services/emailService');

const {
  newInstallmentEmail,
  paymentConfirmationEmail,
  paymentRecordedEmail,
} = require('../services/emailTemplates');

// Save an in-app notification to Firestore
const createInAppNotification = async ({
  uid,
  type,
  title,
  message,
  installmentId,
  dueDate,
  paymentAmount,
  paymentDate,
  remainingAmount,
  paidPayments,
  totalPayments,
}) => {
  await db
    .collection('users')
    .doc(uid)
    .collection('notifications')
    .add({
      type,
      title,
      message,
      installmentId: installmentId || null,
      dueDate: dueDate || null,

      paymentAmount: paymentAmount ?? null,
      paymentDate: paymentDate || null,
      remainingAmount: remainingAmount ?? null,
      paidPayments: paidPayments ?? null,
      totalPayments: totalPayments ?? null,

      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
};

// CREATE: Add installment
const createInstallment = async (req, res) => {
  try {
    const validation = validateInstallment(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid installment information.',
        errors: validation.errors,
      });
    }

    const installment = await installmentService.createInstallment(
      req.user.uid,
      req.body
    );

    await createInAppNotification({
      uid: req.user.uid,
      type: 'installment_added',
      title: 'New Installment Added',
      message: `${installment.description || installment.provider} has been added to your installments.`,
      installmentId: installment.id,
      dueDate: installment.nextDueDate || installment.dueDate,
    });

    await sendEmail({
      to: req.user.email,
      subject: 'New Installment Added - DueWise',
      html: newInstallmentEmail(installment),
    });

    return res.status(201).json({
      success: true,
      message: 'Installment created successfully.',
      data: installment,
    });
  } catch (error) {
    console.error('Create installment error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create installment.',
    });
  }
};

// READ: Get all installments
const getAllInstallments = async (req, res) => {
  try {
    const installments = await installmentService.getAllInstallments(
      req.user.uid
    );

    return res.status(200).json({
      success: true,
      count: installments.length,
      data: installments,
    });
  } catch (error) {
    console.error('Get installments error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve installments.',
    });
  }
};

// READ: Get one installment
const getInstallmentById = async (req, res) => {
  try {
    const installment = await installmentService.getInstallmentById(
      req.user.uid,
      req.params.id
    );

    if (!installment) {
      return res.status(404).json({
        success: false,
        message: 'Installment not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: installment,
    });
  } catch (error) {
    console.error('Get installment error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve installment.',
    });
  }
};


// UPDATE: Edit installment details (payment status is protected)
const updateInstallment = async (req, res) => {
  try {
    // Payment status and payment count must only be changed
    // through the record-payment endpoint.
    const { status, paidPayments, ...updateData } = req.body;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No editable installment information provided.',
      });
    }

    // Validate submitted editable fields
    const validation = validateInstallment(updateData, true);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid installment information.',
        errors: validation.errors,
      });
    }

    // Retrieve the existing installment
    const existingInstallment =
      await installmentService.getInstallmentById(
        req.user.uid,
        req.params.id
      );

    if (!existingInstallment) {
  return res.status(404).json({
    success: false,
    message: 'Installment not found.',
  });
}

// Prevent changes to payment terms after payments have started.
const existingPaidPayments = Number(
  existingInstallment.paidPayments || 0
);

const protectedFields = [
  'amountPerPayment',
  'totalAmount',
  'totalPayments',
];

const protectedFieldsChanged = protectedFields.some((field) => {
  if (!Object.prototype.hasOwnProperty.call(updateData, field)) {
    return false;
  }

  return Number(updateData[field]) !== Number(existingInstallment[field]);
});

if (existingPaidPayments > 0 && protectedFieldsChanged) {
  return res.status(400).json({
    success: false,
    message:
      'Payment amount and payment count cannot be changed after payments have started.',
  });
}

    

    // Preserve payment-related information
    const existingData = {
      provider: existingInstallment.provider,
      description: existingInstallment.description,
      amountPerPayment: existingInstallment.amountPerPayment,
      totalAmount: existingInstallment.totalAmount,
      dueDate: existingInstallment.dueDate,
      status: existingInstallment.status,
      totalPayments: existingInstallment.totalPayments,
      paidPayments: existingInstallment.paidPayments ?? 0,
      paymentFrequency: existingInstallment.paymentFrequency,
      nextDueDate: existingInstallment.nextDueDate,
    };

    // Combine existing information with editable updates
    const updatedData = {
      ...existingData,
      ...updateData,
    };

    const combinedValidation = validateInstallment(
      updatedData,
      true
    );

    if (!combinedValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid installment information.',
        errors: combinedValidation.errors,
      });
    }

    const installment = await installmentService.updateInstallment(
      req.user.uid,
      req.params.id,
      updateData
    );

    return res.status(200).json({
      success: true,
      message: 'Installment updated successfully.',
      data: installment,
    });
  } catch (error) {
    console.error('Update installment error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update installment.',
    });
  }
};

// RECORD PAYMENT: Record one installment payment
const recordPayment = async (req, res) => {
  try {
    const installment = await installmentService.recordInstallmentPayment(
      req.user.uid,
      req.params.id
    );

    if (!installment) {
      return res.status(404).json({
        success: false,
        message: 'Installment not found.',
      });
    }

    await createInAppNotification({
  uid: req.user.uid,

  type: installment.status === 'paid'
    ? 'payment_completed'
    : 'payment_recorded',

  title: installment.status === 'paid'
    ? 'Installment Fully Paid'
    : 'Payment Recorded',

  message: installment.status === 'paid'
    ? `${installment.description || installment.provider} has been fully paid.`
    : `Your payment for ${installment.description || installment.provider} has been recorded successfully.`,

  installmentId: installment.id,
  dueDate: installment.nextDueDate || installment.dueDate,

  paymentAmount: installment.paymentAmount,
  paymentDate: installment.paymentDate,
  remainingAmount: installment.remainingAmount,
  paidPayments: installment.paidPayments,
  totalPayments: installment.totalPayments,
});

    // Send an email for every recorded payment
    const emailPromise = installment.status === 'paid'
      ? sendEmail({
          to: req.user.email,
          subject: 'Payment Completed - DueWise',
          html: paymentConfirmationEmail(installment),
        })
      : sendEmail({
          to: req.user.email,
          subject: 'Payment Recorded - DueWise',
          html: paymentRecordedEmail(installment),
        });

    // Do not make the payment response wait for Gmail
    emailPromise.catch((error) => {
      console.error('Payment notification email failed:', error);
    });

    return res.status(200).json({
      success: true,
      message: 'Payment recorded successfully.',
      data: installment,
    });
  } catch (error) {
    if (error.code === 'PAYMENTS_COMPLETED') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Record payment error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to record installment payment.',
    });
  }
};

// DELETE: Remove installment
const deleteInstallment = async (req, res) => {
  try {
    const deleted = await installmentService.deleteInstallment(
      req.user.uid,
      req.params.id
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Installment not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Installment deleted successfully.',
    });
  } catch (error) {
    console.error('Delete installment error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete installment.',
    });
  }
};

module.exports = {
  createInstallment,
  getAllInstallments,
  getInstallmentById,
  updateInstallment,
  recordPayment,
  deleteInstallment,
};
