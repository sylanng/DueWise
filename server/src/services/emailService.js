const { Resend } = require('resend');

const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('Email skipped: RESEND_API_KEY is not configured.');
    return { success: false, skipped: true };
  }

  if (!to) {
    console.warn('Email skipped: recipient email is missing.');
    return { success: false, skipped: true };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Resend email error:', error);
      return { success: false, error };
    }

    console.log('Email sent successfully:', data.id);

    return { success: true, id: data.id };
  } catch (error) {
    console.error('Email sending failed:', error.message);
    return { success: false, error };
  }
};

module.exports = { sendEmail };