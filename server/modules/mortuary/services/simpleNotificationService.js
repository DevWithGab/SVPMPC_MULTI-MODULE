/**
 * Simple Notification Service
 * Handles sending custom messages/reminders to members
 * NOT related to PaymentSchedule - just simple SMS/Email sending
 */

// Send SMS to member
const sendSMS = async (phoneNumber, memberName, message) => {
  try {
    // TODO: Integrate with actual SMS service (e.g., Twilio, Semaphore)
    console.log(`📱 Sending SMS to ${phoneNumber}`);
    console.log(`   Member: ${memberName}`);
    console.log(`   Message: ${message}`);
    
    // Simulate SMS sending
    // In production, replace with actual SMS service
    /*
    const smsContent = {
      to: phoneNumber,
      message: message
    };
    
    await smsService.send(smsContent);
    */
    
    return {
      success: true,
      method: 'sms',
      recipient: phoneNumber,
      message: 'SMS sent successfully (simulated)'
    };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return {
      success: false,
      method: 'sms',
      recipient: phoneNumber,
      error: error.message
    };
  }
};

// Send email to member
const sendEmail = async (email, memberName, subject, message) => {
  try {
    // TODO: Integrate with actual email service
    console.log(`📧 Sending email to ${email}`);
    console.log(`   Member: ${memberName}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Message: ${message}`);
    
    // Simulate email sending
    // In production, replace with actual email service
    /*
    const emailContent = {
      to: email,
      subject: subject,
      html: `
        <h2>Hello ${memberName},</h2>
        <p>${message}</p>
        <p>Best regards,<br/>SVMPC Cooperative</p>
      `
    };
    
    await emailService.send(emailContent);
    */
    
    return {
      success: true,
      method: 'email',
      recipient: email,
      message: 'Email sent successfully (simulated)'
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      method: 'email',
      recipient: email,
      error: error.message
    };
  }
};

// Send balance reminder to member
const sendBalanceReminder = async (member, customMessage = null) => {
  const defaultMessage = customMessage || 
    `Dear ${member.memberName}, your current mortuary fund balance is ₱${member.balance}. Please ensure your balance is maintained above ₱1,000. Thank you!`;
  
  const results = {
    sms: null,
    email: null,
    success: false
  };

  // Send SMS
  if (member.phoneNumber) {
    results.sms = await sendSMS(member.phoneNumber, member.memberName, defaultMessage);
  }

  // Send Email
  if (member.email) {
    results.email = await sendEmail(
      member.email, 
      member.memberName, 
      'SVMPC Mortuary Fund Balance Reminder',
      defaultMessage
    );
  }

  results.success = (results.sms?.success || results.email?.success);

  return results;
};

module.exports = {
  sendSMS,
  sendEmail,
  sendBalanceReminder
};
