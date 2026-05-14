const SMSNotification = require('../models/SMSNotification');
const { getNotificationHistory, getPendingNotifications, retryFailedNotifications } = require('../services/thresholdNotificationService');

// Get notification history for a member
const getMemberNotificationHistory = async (req, res) => {
  try {
    const { memberId } = req.params;
    
    const notifications = await getNotificationHistory(memberId);
    
    res.status(200).json({
      success: true,
      data: {
        memberId,
        notifications,
        count: notifications.length
      }
    });
  } catch (error) {
    console.error('Error getting notification history:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting notification history',
      error: error.message
    });
  }
};

// Get all notifications (with filters)
const getAllNotifications = async (req, res) => {
  try {
    const { status, thresholdType, limit = 100 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (thresholdType) query.thresholdType = thresholdType;
    
    const notifications = await SMSNotification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    const stats = {
      total: notifications.length,
      sent: notifications.filter(n => n.status === 'sent').length,
      pending: notifications.filter(n => n.status === 'pending').length,
      failed: notifications.filter(n => n.status === 'failed').length,
    };
    
    res.status(200).json({
      success: true,
      data: {
        notifications,
        stats
      }
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting notifications',
      error: error.message
    });
  }
};

// Get pending notifications
const getPending = async (req, res) => {
  try {
    const notifications = await getPendingNotifications();
    
    res.status(200).json({
      success: true,
      data: {
        notifications,
        count: notifications.length
      }
    });
  } catch (error) {
    console.error('Error getting pending notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting pending notifications',
      error: error.message
    });
  }
};

// Retry failed notifications
const retryFailed = async (req, res) => {
  try {
    const result = await retryFailedNotifications();
    
    res.status(200).json({
      success: true,
      message: `Retried ${result.retried} notifications, ${result.succeeded} succeeded`,
      data: result
    });
  } catch (error) {
    console.error('Error retrying failed notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrying failed notifications',
      error: error.message
    });
  }
};

// Get notification statistics
const getNotificationStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const notifications = await SMSNotification.find({
      createdAt: { $gte: startDate }
    });
    
    const stats = {
      total: notifications.length,
      sent: notifications.filter(n => n.status === 'sent').length,
      pending: notifications.filter(n => n.status === 'pending').length,
      failed: notifications.filter(n => n.status === 'failed').length,
      byThreshold: {
        threshold_300: notifications.filter(n => n.thresholdType === 'threshold_300').length,
        threshold_100: notifications.filter(n => n.thresholdType === 'threshold_100').length,
        negative_balance: notifications.filter(n => n.thresholdType === 'negative_balance').length,
      },
      byTrigger: {
        contribution: notifications.filter(n => n.triggeredBy === 'contribution').length,
        deduction: notifications.filter(n => n.triggeredBy === 'deduction').length,
        manual: notifications.filter(n => n.triggeredBy === 'manual').length,
      }
    };
    
    res.status(200).json({
      success: true,
      data: {
        period: `Last ${days} days`,
        stats
      }
    });
  } catch (error) {
    console.error('Error getting notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting notification stats',
      error: error.message
    });
  }
};

module.exports = {
  getMemberNotificationHistory,
  getAllNotifications,
  getPending,
  retryFailed,
  getNotificationStats
};
