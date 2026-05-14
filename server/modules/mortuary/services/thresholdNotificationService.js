/**
 * Threshold Notification Service
 * Automatically sends SMS notifications when member balance crosses thresholds
 * Thresholds: ₱300, ₱100, and Negative Balance
 */

const SMSNotification = require('../models/SMSNotification');
const { v4: uuidv4 } = require('uuid');

// Configurable thresholds (can be moved to database/config later)
const THRESHOLDS = {
  HIGH_WARNING: 300,    // First warning at ₱300
  LOW_WARNING: 100,     // Second warning at ₱100
  NEGATIVE: 0           // Critical warning when negative
};

// Check if member has already been notified for this threshold
const hasBeenNotified = async (memberId, thresholdType) => {
  const recentNotification = await SMSNotification.findOne({
    memberId,
    thresholdType,
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Within last 30 days
  });
  
  return !!recentNotification;
};

// Determine which threshold was crossed
const determineThresholdCrossed = (oldBalance, newBalance) => {
  const thresholds = [];
  
  // Check negative balance threshold
  if (oldBalance >= THRESHOLDS.NEGATIVE && newBalance < THRESHOLDS.NEGATIVE) {
    thresholds.push('negative_balance');
  }
  
  // Check ₱100 threshold
  if (oldBalance >= THRESHOLDS.LOW_WARNING && newBalance < THRESHOLDS.LOW_WARNING) {
    thresholds.push('threshold_100');
  }
  
  // Check ₱300 threshold
  if (oldBalance >= THRESHOLDS.HIGH_WARNING && newBalance < THRESHOLDS.HIGH_WARNING) {
    thresholds.push('threshold_300');
  }
  
  return thresholds;
};

// Generate message based on threshold type
const generateMessage = (memberName, balance, thresholdType) => {
  const messages = {
    threshold_300: `Dear ${memberName}, your mortuary fund balance is now ₱${balance.toFixed(2)}. Please consider making a contribution to maintain your account. Thank you! - SVMPC Cooperative`,
    
    threshold_100: `URGENT: ${memberName}, your mortuary fund balance is critically low at ₱${balance.toFixed(2)}. Please make a contribution immediately to avoid account issues. - SVMPC Cooperative`,
    
    negative_balance: `CRITICAL: ${memberName}, your mortuary fund balance is NEGATIVE at ₱${balance.toFixed(2)}. Please settle your account immediately. Contact us for assistance. - SVMPC Cooperative`
  };
  
  return messages[thresholdType] || `Your balance is ₱${balance.toFixed(2)}`;
};

// Send SMS (integrate with actual SMS provider)
const sendSMS = async (phoneNumber, message) => {
  try {
    // TODO: Integrate with actual SMS service (Semaphore, Twilio, etc.)
    console.log(`📱 [THRESHOLD SMS] Sending to ${phoneNumber}`);
    console.log(`   Message: ${message}`);
    
    // Simulate SMS sending
    // In production, replace with actual SMS service
    /*
    const axios = require('axios');
    const response = await axios.post('https://api.semaphore.co/api/v4/messages', {
      apikey: process.env.SEMAPHORE_API_KEY,
      number: phoneNumber,
      message: message,
      sendername: 'SVMPC'
    });
    
    return { success: response.data.status === 'success' };
    */
    
    return { success: true, sentAt: new Date() };
  } catch (error) {
    console.error('Error sending threshold SMS:', error);
    return { success: false, error: error.message };
  }
};

// Main function: Check thresholds and send notifications
const checkAndNotify = async (memberId, memberName, phoneNumber, oldBalance, newBalance, triggeredBy, transactionId) => {
  try {
    // Determine which thresholds were crossed
    const crossedThresholds = determineThresholdCrossed(oldBalance, newBalance);
    
    if (crossedThresholds.length === 0) {
      return { notificationsSent: 0, notifications: [] };
    }
    
    const notifications = [];
    
    for (const thresholdType of crossedThresholds) {
      // Check if already notified for this threshold recently
      const alreadyNotified = await hasBeenNotified(memberId, thresholdType);
      
      if (alreadyNotified) {
        console.log(`⏭️  Skipping ${thresholdType} notification for ${memberId} - already notified recently`);
        continue;
      }
      
      // Generate message
      const message = generateMessage(memberName, newBalance, thresholdType);
      
      // Create notification record
      const notification = new SMSNotification({
        notificationId: uuidv4(),
        memberId,
        memberName,
        phoneNumber,
        thresholdType,
        balance: newBalance,
        message,
        status: 'pending',
        triggeredBy,
        transactionId
      });
      
      // Send SMS
      const smsResult = await sendSMS(phoneNumber, message);
      
      if (smsResult.success) {
        notification.status = 'sent';
        notification.sentAt = smsResult.sentAt || new Date();
      } else {
        notification.status = 'failed';
        notification.failureReason = smsResult.error || 'Unknown error';
      }
      
      await notification.save();
      notifications.push(notification);
      
      console.log(`✅ ${thresholdType} notification created for ${memberName} (${memberId})`);
    }
    
    return {
      notificationsSent: notifications.filter(n => n.status === 'sent').length,
      notificationsFailed: notifications.filter(n => n.status === 'failed').length,
      notifications
    };
  } catch (error) {
    console.error('Error in checkAndNotify:', error);
    throw error;
  }
};

// Get notification history for a member
const getNotificationHistory = async (memberId) => {
  try {
    const notifications = await SMSNotification.find({ memberId })
      .sort({ createdAt: -1 })
      .limit(50);
    
    return notifications;
  } catch (error) {
    console.error('Error getting notification history:', error);
    throw error;
  }
};

// Get all pending notifications
const getPendingNotifications = async () => {
  try {
    const notifications = await SMSNotification.find({ status: 'pending' })
      .sort({ createdAt: 1 });
    
    return notifications;
  } catch (error) {
    console.error('Error getting pending notifications:', error);
    throw error;
  }
};

// Retry failed notifications
const retryFailedNotifications = async () => {
  try {
    const failedNotifications = await SMSNotification.find({ 
      status: 'failed',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours only
    });
    
    let retried = 0;
    let succeeded = 0;
    
    for (const notification of failedNotifications) {
      const smsResult = await sendSMS(notification.phoneNumber, notification.message);
      
      if (smsResult.success) {
        notification.status = 'sent';
        notification.sentAt = smsResult.sentAt || new Date();
        succeeded++;
      }
      
      await notification.save();
      retried++;
    }
    
    return { retried, succeeded };
  } catch (error) {
    console.error('Error retrying failed notifications:', error);
    throw error;
  }
};

module.exports = {
  THRESHOLDS,
  checkAndNotify,
  getNotificationHistory,
  getPendingNotifications,
  retryFailedNotifications,
  determineThresholdCrossed,
  generateMessage
};
