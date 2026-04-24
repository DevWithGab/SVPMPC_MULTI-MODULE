const nodemailer = require('nodemailer');

/**
 * Notification Service
 * Handles sending credentials via Email and SMS
 */

// Email configuration (using Gmail as example)
// In production, use environment variables for credentials
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com',
      pass: process.env.EMAIL_PASSWORD || 'your-app-password',
    },
  });
};

/**
 * Send credentials via Email
 */
const sendCredentialsEmail = async (memberData) => {
  try {
    const transporter = createEmailTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER || 'SVPMPC <noreply@svpmpc.com>',
      to: memberData.email,
      subject: 'Your SVPMPC Account Credentials',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2D7A3E 0%, #163A1E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2D7A3E; }
            .credential-item { margin: 10px 0; }
            .credential-label { font-weight: bold; color: #2D7A3E; }
            .credential-value { font-family: monospace; background: #f0f0f0; padding: 5px 10px; border-radius: 4px; display: inline-block; margin-left: 10px; }
            .warning { background: #fff3cd; border-left: 4px solid #F2E416; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            .button { display: inline-block; background: #2D7A3E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to SVPMPC!</h1>
              <p>Your account has been created successfully</p>
            </div>
            <div class="content">
              <p>Dear <strong>${memberData.memberName}</strong>,</p>
              
              <p>Your member account has been created in the San Vicente Producers Multi-Purpose Cooperative system. Below are your login credentials:</p>
              
              <div class="credentials">
                <div class="credential-item">
                  <span class="credential-label">Member ID:</span>
                  <span class="credential-value">${memberData.memberId}</span>
                </div>
                <div class="credential-item">
                  <span class="credential-label">Username:</span>
                  <span class="credential-value">${memberData.username}</span>
                </div>
                <div class="credential-item">
                  <span class="credential-label">Temporary Password:</span>
                  <span class="credential-value">${memberData.temporaryPassword}</span>
                </div>
              </div>

              <div class="warning">
                <strong>⚠️ Important Security Notice:</strong>
                <ul>
                  <li>This is a temporary password that must be changed on your first login</li>
                  <li>Do not share your credentials with anyone</li>
                  <li>Keep this email secure or delete it after changing your password</li>
                </ul>
              </div>

              <p><strong>Access your account:</strong></p>
              <ol>
                <li>Visit the SVPMPC portal</li>
                <li>Select your module (Attendance System or Mortuary Fund)</li>
                <li>Choose "Member" login</li>
                <li>Enter your username and temporary password</li>
                <li>You will be prompted to create a new password</li>
              </ol>

              <div style="text-align: center;">
                <a href="${process.env.APP_URL || 'http://localhost:5173'}" class="button">Login to SVPMPC</a>
              </div>

              <p>If you have any questions or need assistance, please contact your cooperative administrator.</p>

              <div class="footer">
                <p>San Vicente Producers Multi-Purpose Cooperative</p>
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Welcome to SVPMPC!

Dear ${memberData.memberName},

Your member account has been created successfully.

Login Credentials:
- Member ID: ${memberData.memberId}
- Username: ${memberData.username}
- Temporary Password: ${memberData.temporaryPassword}

IMPORTANT: This is a temporary password that must be changed on your first login.

Visit ${process.env.APP_URL || 'http://localhost:5173'} to access your account.

If you have any questions, please contact your cooperative administrator.

San Vicente Producers Multi-Purpose Cooperative
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${memberData.email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Error sending email to ${memberData.email}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send credentials via SMS
 * Using Semaphore SMS API (Philippine SMS provider)
 * You can replace this with your preferred SMS provider
 */
const sendCredentialsSMS = async (memberData) => {
  try {
    // Check if SMS is configured
    if (!process.env.SEMAPHORE_API_KEY) {
      console.log('⚠️  SMS not configured. Skipping SMS notification.');
      return { success: false, error: 'SMS not configured' };
    }

    const message = `SVPMPC Account Created!\n\nHi ${memberData.memberName},\n\nYour login credentials:\nUsername: ${memberData.username}\nPassword: ${memberData.temporaryPassword}\n\nChange password on first login.\n\nSVPMPC`;

    // Semaphore SMS API call
    const response = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apikey: process.env.SEMAPHORE_API_KEY,
        number: memberData.phoneNumber,
        message: message,
        sendername: process.env.SMS_SENDER_NAME || 'SVPMPC',
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ SMS sent to ${memberData.phoneNumber}`);
      return { success: true, data };
    } else {
      console.error(`❌ Error sending SMS to ${memberData.phoneNumber}:`, data);
      return { success: false, error: data };
    }
  } catch (error) {
    console.error(`❌ Error sending SMS to ${memberData.phoneNumber}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send credentials via both Email and SMS
 */
const sendCredentials = async (memberData, options = { email: true, sms: true }) => {
  const results = {
    email: null,
    sms: null,
  };

  // Send email if enabled
  if (options.email) {
    results.email = await sendCredentialsEmail(memberData);
  }

  // Send SMS if enabled
  if (options.sms) {
    results.sms = await sendCredentialsSMS(memberData);
  }

  return results;
};

/**
 * Send bulk credentials (for CSV uploads)
 */
const sendBulkCredentials = async (membersData, options = { email: true, sms: false }) => {
  const results = [];

  for (const memberData of membersData) {
    const result = await sendCredentials(memberData, options);
    results.push({
      memberId: memberData.memberId,
      email: memberData.email,
      phoneNumber: memberData.phoneNumber,
      notifications: result,
    });

    // Add delay to avoid rate limiting (500ms between sends)
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
};

/**
 * Send password reset notification
 */
const sendPasswordResetNotification = async (memberData) => {
  try {
    const transporter = createEmailTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER || 'SVPMPC <noreply@svpmpc.com>',
      to: memberData.email,
      subject: 'SVPMPC Password Reset',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2D7A3E 0%, #163A1E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2D7A3E; }
            .credential-value { font-family: monospace; background: #f0f0f0; padding: 5px 10px; border-radius: 4px; display: inline-block; }
            .warning { background: #fff3cd; border-left: 4px solid #F2E416; padding: 15px; margin: 20px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset</h1>
            </div>
            <div class="content">
              <p>Dear <strong>${memberData.memberName}</strong>,</p>
              
              <p>Your password has been reset by an administrator. Here are your new login credentials:</p>
              
              <div class="credentials">
                <p><strong>Username:</strong> <span class="credential-value">${memberData.username}</span></p>
                <p><strong>New Temporary Password:</strong> <span class="credential-value">${memberData.temporaryPassword}</span></p>
              </div>

              <div class="warning">
                <strong>⚠️ Security Notice:</strong> Please change this temporary password immediately after logging in.
              </div>

              <p>If you did not request this password reset, please contact your cooperative administrator immediately.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${memberData.email}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Error sending password reset email:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendCredentials,
  sendCredentialsEmail,
  sendCredentialsSMS,
  sendBulkCredentials,
  sendPasswordResetNotification,
};
