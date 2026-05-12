import { pdfReportGenerator } from './pdfReportGenerator';
import { formatDate } from './date';

/**
 * Helper functions for generating various types of reports
 */

/**
 * Generate a member attendance summary report
 * @param {Object} memberData - Member information
 * @param {Array} attendanceHistory - Member's attendance records
 */
export const generateMemberReport = (memberData, attendanceHistory) => {
  try {
    const reportOptions = {
      memberData,
      attendanceHistory,
      title: 'Member Attendance Summary',
      subtitle: `Individual Report - ${memberData.memberName || 'Member'}`
    };

    return pdfReportGenerator.generateMemberSummaryReport(reportOptions);
  } catch (error) {
    console.error('Error generating member report:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generate a comprehensive attendance report with custom date range
 * @param {Array} attendanceData - Attendance records
 * @param {Object} options - Report options
 */
export const generateCustomAttendanceReport = (attendanceData, options = {}) => {
  try {
    const {
      title = 'Custom Attendance Report',
      subtitle = 'Filtered Attendance Data',
      dateRange = null,
      eventFilter = null,
      memberFilter = null
    } = options;

    // Apply filters
    let filteredData = [...attendanceData];

    if (dateRange && dateRange.start && dateRange.end) {
      filteredData = filteredData.filter(record => {
        const recordDate = new Date(record.scanTime || record.timestamp);
        return recordDate >= new Date(dateRange.start) && recordDate <= new Date(dateRange.end);
      });
    }

    if (eventFilter) {
      filteredData = filteredData.filter(record => 
        record.eventId === eventFilter || record.eventName === eventFilter
      );
    }

    if (memberFilter) {
      filteredData = filteredData.filter(record => 
        record.memberId === memberFilter || record.memberName?.toLowerCase().includes(memberFilter.toLowerCase())
      );
    }

    // Calculate statistics
    const stats = {
      totalRecords: filteredData.length,
      uniqueMembers: new Set(filteredData.map(r => r.memberId)).size,
      uniqueEvents: new Set(filteredData.map(r => r.eventId || r.eventName)).size,
      presentCount: filteredData.filter(r => r.status === 'present' || r.status === 'attended').length
    };

    const reportOptions = {
      data: filteredData,
      filters: {
        dateRange: dateRange ? `${dateRange.start} to ${dateRange.end}` : 'All time',
        event: eventFilter || 'All events',
        member: memberFilter || 'All members'
      },
      stats,
      title,
      subtitle
    };

    return pdfReportGenerator.generateAttendanceReport(reportOptions);
  } catch (error) {
    console.error('Error generating custom attendance report:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generate a monthly attendance summary report
 * @param {Array} attendanceData - Attendance records
 * @param {number} year - Year for the report
 * @param {number} month - Month for the report (1-12)
 */
export const generateMonthlyReport = (attendanceData, year, month) => {
  try {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Filter data for the specific month
    const monthlyData = attendanceData.filter(record => {
      const recordDate = new Date(record.scanTime || record.timestamp);
      return recordDate.getFullYear() === year && recordDate.getMonth() === (month - 1);
    });

    const title = `Monthly Attendance Report`;
    const subtitle = `${monthNames[month - 1]} ${year} - Attendance Summary`;

    return generateCustomAttendanceReport(monthlyData, {
      title,
      subtitle,
      dateRange: {
        start: new Date(year, month - 1, 1).toISOString(),
        end: new Date(year, month, 0).toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating monthly report:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generate an event comparison report
 * @param {Array} events - Events to compare
 * @param {Array} attendanceData - All attendance records
 */
export const generateEventComparisonReport = (events, attendanceData) => {
  try {
    // Group attendance by event
    const eventStats = events.map(event => {
      const eventAttendance = attendanceData.filter(record => 
        record.eventId === event.id || record.eventName === event.eventName || record.eventName === event.name
      );

      return {
        eventName: event.eventName || event.name,
        eventDate: event.eventDate || event.date,
        totalAttendees: eventAttendance.length,
        uniqueMembers: new Set(eventAttendance.map(r => r.memberId)).size,
        attendanceRate: eventAttendance.length > 0 ? 100 : 0 // This would need total member count for accurate rate
      };
    });

    // Create a summary table data for the PDF
    const comparisonData = eventStats.map(stat => ({
      eventName: stat.eventName,
      eventDate: stat.eventDate ? formatDate(stat.eventDate) : 'N/A',
      totalAttendees: stat.totalAttendees,
      attendanceRate: `${stat.attendanceRate}%`,
      scanTime: new Date().toISOString(), // Dummy field for table compatibility
      memberId: 'N/A',
      memberName: 'Event Summary',
      barangay: 'N/A',
      status: 'Summary'
    }));

    const reportOptions = {
      data: comparisonData,
      filters: {
        dateRange: 'Multiple events',
        event: 'Event comparison',
        member: 'All members'
      },
      stats: {
        totalRecords: events.length,
        uniqueMembers: new Set(attendanceData.map(r => r.memberId)).size,
        uniqueEvents: events.length,
        presentCount: attendanceData.length
      },
      title: 'Event Comparison Report',
      subtitle: 'Attendance Analysis Across Multiple Events'
    };

    return pdfReportGenerator.generateAttendanceReport(reportOptions);
  } catch (error) {
    console.error('Error generating event comparison report:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generate a member directory report with attendance statistics
 * @param {Array} members - Member list
 * @param {Array} attendanceData - All attendance records
 */
export const generateMemberDirectoryReport = (members, attendanceData) => {
  try {
    // Calculate attendance stats for each member
    const memberStats = members.map(member => {
      const memberAttendance = attendanceData.filter(record => 
        record.memberId === member.memberId || record.memberId === member.id
      );

      const eventsAttended = memberAttendance.length;
      const totalEvents = new Set(attendanceData.map(r => r.eventId || r.eventName)).size;
      const attendanceRate = totalEvents > 0 ? Math.round((eventsAttended / totalEvents) * 100) : 0;

      return {
        memberName: member.memberName || member.name || `${member.firstName} ${member.lastName}`,
        memberId: member.memberId || member.id,
        barangay: member.barangay || 'N/A',
        eventsAttended,
        attendanceRate: `${attendanceRate}%`,
        scanTime: new Date().toISOString(), // Dummy field for table compatibility
        eventName: 'Member Summary',
        status: member.status || 'Active'
      };
    });

    const reportOptions = {
      data: memberStats,
      filters: {
        dateRange: 'All time',
        event: 'All events',
        member: 'All members'
      },
      stats: {
        totalRecords: members.length,
        uniqueMembers: members.length,
        uniqueEvents: new Set(attendanceData.map(r => r.eventId || r.eventName)).size,
        presentCount: attendanceData.length
      },
      title: 'Member Directory Report',
      subtitle: 'Complete Member List with Attendance Statistics'
    };

    return pdfReportGenerator.generateAttendanceReport(reportOptions);
  } catch (error) {
    console.error('Error generating member directory report:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Utility function to format date ranges for reports
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 */
export const formatDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start.toDateString() === end.toDateString()) {
    return formatDate(start);
  }

  return `${formatDate(start)} - ${formatDate(end)}`;
};

/**
 * Utility function to validate report data
 * @param {Array} data - Data to validate
 * @param {string} type - Type of report
 */
export const validateReportData = (data, type = 'attendance') => {
  if (!Array.isArray(data)) {
    return { valid: false, error: 'Data must be an array' };
  }

  if (data.length === 0) {
    return { valid: false, error: 'No data available for report generation' };
  }

  switch (type) {
    case 'attendance':
      const requiredFields = ['memberId', 'memberName'];
      const hasRequiredFields = data.every(record => 
        requiredFields.some(field => record[field])
      );
      
      if (!hasRequiredFields) {
        return { valid: false, error: 'Missing required fields in attendance data' };
      }
      break;

    case 'member':
      if (!data[0].memberId && !data[0].id) {
        return { valid: false, error: 'Member data must have memberId or id field' };
      }
      break;

    case 'event':
      if (!data[0].eventName && !data[0].name) {
        return { valid: false, error: 'Event data must have eventName or name field' };
      }
      break;
  }

  return { valid: true };
};

export default {
  generateMemberReport,
  generateCustomAttendanceReport,
  generateMonthlyReport,
  generateEventComparisonReport,
  generateMemberDirectoryReport,
  formatDateRange,
  validateReportData
};