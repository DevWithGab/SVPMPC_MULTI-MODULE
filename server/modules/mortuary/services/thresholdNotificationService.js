// Read-only access to historical balance alerts. SMS delivery has been retired.
const SMSNotification = require('../models/SMSNotification');

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

module.exports = { getNotificationHistory, getPendingNotifications };
