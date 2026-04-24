const nodemailer = require('nodemailer');

// Configure email transporter
const emailTransporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Send email reminder
const sendEmailReminder = async (memberEmail, memberName, dueDate, amount, credentialData = null) => {
  try {
    let htmlContent;

    if (credentialData && credentialData.isCredentials) {
      // Credentials email
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1b5e20; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">Samahang Kooperatibo</h2>
            <p style="margin: 5px 0 0; font-size: 14px;">Account Credentials</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Dear <strong>${memberName}</strong>,</p>
            
            <p>Your account has been created. Please use the credentials below to access the system.</p>
            
            <div style="background: white; border-left: 4px solid #1b5e20; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0 0 10px;"><strong>Login Credentials:</strong></p>
              <p style="margin: 5px 0;"><strong>Username:</strong> <code style="background: #f0f0f0; padding: 2px 6px;">${credentialData.username}</code></p>
              <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #f0f0f0; padding: 2px 6px;">${credentialData.tempPassword}</code></p>
            </div>
            
            <p style="color: #d32f2f; font-weight: bold;">⚠️ Important:</p>
            <ul style="color: #666;">
              <li>This is a temporary password. Please change it on your first login.</li>
              <li>You can access both Attendance and Mortuary modules with these credentials.</li>
              <li>Keep your credentials confidential.</li>
            </ul>
            
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;
    } else {
      // Payment reminder email
      const formattedDate = new Date(dueDate).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1b5e20; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">Samahang Kooperatibo</h2>
            <p style="margin: 5px 0 0; font-size: 14px;">Mortuary Fund Payment Reminder</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Dear <strong>${memberName}</strong>,</p>
            
            <p>This is a friendly reminder that your mortuary fund contribution payment is due.</p>
            
            <div style="background: white; border-left: 4px solid #1b5e20; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0 0 10px;"><strong>Payment Details:</strong></p>
              <p style="margin: 5px 0;"><strong>Amount Due:</strong> ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
              <p style="margin: 5px 0;"><strong>Due Date:</strong> ${formattedDate}</p>
            </div>
            
            <p>Please ensure to settle your payment on or before the due date to maintain your membership benefits.</p>
            
            <p>If you have already made the payment, please disregard this reminder. If you have any questions, please contact our office.</p>
            
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: memberEmail,
      subject: credentialData && credentialData.isCredentials 
        ? 'Your Account Credentials - Samahang Kooperatibo'
        : 'Payment Reminder - Samahang Kooperatibo Mortuary Fund',
      html: htmlContent,
    };

    const result = await emailTransporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: result.messageId,
      message: 'Email sent successfully',
    };
  } catch (error) {
    console.error('Email sending error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Send SMS reminder
const sendSMSReminder = async (phoneNumber, memberName, dueDate, amount, credentialData = null) => {
  try {
    let message;

    if (credentialData && credentialData.isCredentials) {
      message = `Hi ${memberName}, your Samahang Kooperatibo account is ready! Username: ${credentialData.username} | Temp Password: ${credentialData.tempPassword} | Please change password on first login.`;
    } else {
      const formattedDate = new Date(dueDate).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      message = `Hi ${memberName}, reminder: Your mortuary fund payment of ₱${amount} is due on ${formattedDate}. Please settle your payment. Thank you!`;
    }

    console.log(`SMS would be sent to ${phoneNumber}: ${message}`);
    return {
      success: true,
      message: 'SMS reminder queued (configure SMS service)',
      phoneNumber: phoneNumber,
      content: message,
    };
  } catch (error) {
    console.error('SMS sending error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Send bulk reminders to all members with overdue payments
const sendBulkReminders = async (schedules, notificationType = 'email') => {
  try {
    const results = {
      sent: 0,
      failed: 0,
      errors: [],
    };

    for (const schedule of schedules) {
      try {
        // Get member details
        const { Member } = require('../../../shared/models');
        const member = await Member.findOne({ memberId: schedule.memberId });

        if (!member) {
          results.failed++;
          results.errors.push({
            memberId: schedule.memberId,
            error: 'Member not found',
          });
          continue;
        }

        let result;

        if (notificationType === 'email') {
          result = await sendEmailReminder(
            member.email,
            member.memberName,
            schedule.nextDueDate,
            schedule.contributionAmount
          );
        } else if (notificationType === 'sms') {
          result = await sendSMSReminder(
            member.phoneNumber,
            member.memberName,
            schedule.nextDueDate,
            schedule.contributionAmount
          );
        }

        if (result.success) {
          results.sent++;

          // Mark reminder as sent
          const PaymentSchedule = require('../models/PaymentSchedule');
          await PaymentSchedule.findOneAndUpdate(
            { scheduleId: schedule.scheduleId },
            {
              reminderSent: true,
              reminderSentDate: new Date(),
            }
          );
        } else {
          results.failed++;
          results.errors.push({
            memberId: schedule.memberId,
            error: result.error,
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          memberId: schedule.memberId,
          error: error.message,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Bulk reminder error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  sendEmailReminder,
  sendSMSReminder,
  sendBulkReminders,
};
