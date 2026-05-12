import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatTime, formatDateTime, formatForFilename } from './date';

/**
 * Professional PDF Report Generator for Attendance System
 * Creates clean, professional PDF reports with proper formatting
 */
class PDFReportGenerator {
  constructor() {
    this.cooperativeColors = {
      primary: '#2D7A3E',    // Coop Green
      secondary: '#F2E416',  // Coop Yellow
      dark: '#163A1E',       // Coop Dark Green
      text: '#1e293b',       // Slate 800
      lightText: '#64748b',  // Slate 500
      border: '#e2e8f0',     // Slate 200
      background: '#f8fafc'  // Slate 50
    };
  }

  /**
   * Generate Attendance Report PDF
   * @param {Object} options - Report configuration
   * @param {Array} options.data - Attendance data array
   * @param {Object} options.filters - Applied filters
   * @param {Object} options.stats - Report statistics
   * @param {string} options.title - Report title
   * @param {string} options.subtitle - Report subtitle
   */
  generateAttendanceReport(options) {
    const {
      data = [],
      filters = {},
      stats = {},
      title = 'Attendance Report',
      subtitle = 'Cooperative Management System'
    } = options;

    // Create new PDF document
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let yPosition = 20;

    // Add header
    yPosition = this._addHeader(doc, pageWidth, yPosition, title, subtitle);

    // Add report metadata
    yPosition = this._addReportMetadata(doc, pageWidth, yPosition, filters);

    // Add statistics summary
    yPosition = this._addStatisticsSummary(doc, pageWidth, yPosition, stats);

    // Add attendance table
    yPosition = this._addAttendanceTable(doc, yPosition, data, pageHeight);

    // Add footer
    this._addFooter(doc, pageWidth, pageHeight);

    // Generate filename with timestamp
    const timestamp = formatForFilename(new Date());
    const filename = `attendance_report_${timestamp}.pdf`;

    // Save the PDF
    doc.save(filename);

    return {
      success: true,
      filename,
      recordCount: data.length
    };
  }

  /**
   * Generate Event Summary Report PDF
   * @param {Object} options - Report configuration
   */
  generateEventSummaryReport(options) {
    const {
      eventData = {},
      attendanceData = [],
      title = 'Event Summary Report',
      subtitle = 'Event Attendance Analysis'
    } = options;

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let yPosition = 20;

    // Add header
    yPosition = this._addHeader(doc, pageWidth, yPosition, title, subtitle);

    // Add event details
    yPosition = this._addEventDetails(doc, pageWidth, yPosition, eventData);

    // Add event statistics
    const eventStats = this._calculateEventStats(attendanceData);
    yPosition = this._addEventStatistics(doc, pageWidth, yPosition, eventStats);

    // Add attendance breakdown
    yPosition = this._addAttendanceBreakdown(doc, yPosition, attendanceData, pageHeight);

    // Add footer
    this._addFooter(doc, pageWidth, pageHeight);

    const timestamp = formatForFilename(new Date());
    const filename = `event_summary_${eventData.eventName || 'report'}_${timestamp}.pdf`;

    doc.save(filename);

    return {
      success: true,
      filename,
      eventName: eventData.eventName,
      attendeeCount: attendanceData.length
    };
  }

  /**
   * Generate Member Attendance Summary PDF
   * @param {Object} options - Report configuration
   */
  generateMemberSummaryReport(options) {
    const {
      memberData = {},
      attendanceHistory = [],
      title = 'Member Attendance Summary',
      subtitle = 'Individual Attendance Record'
    } = options;

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let yPosition = 20;

    // Add header
    yPosition = this._addHeader(doc, pageWidth, yPosition, title, subtitle);

    // Add member details
    yPosition = this._addMemberDetails(doc, pageWidth, yPosition, memberData);

    // Add member statistics
    const memberStats = this._calculateMemberStats(attendanceHistory);
    yPosition = this._addMemberStatistics(doc, pageWidth, yPosition, memberStats);

    // Add attendance history table
    yPosition = this._addMemberAttendanceTable(doc, yPosition, attendanceHistory, pageHeight);

    // Add footer
    this._addFooter(doc, pageWidth, pageHeight);

    const timestamp = formatForFilename(new Date());
    const filename = `member_summary_${memberData.memberId || 'report'}_${timestamp}.pdf`;

    doc.save(filename);

    return {
      success: true,
      filename,
      memberName: memberData.memberName,
      recordCount: attendanceHistory.length
    };
  }

  // Private helper methods

  _addHeader(doc, pageWidth, yPosition, title, subtitle) {
    // Add cooperative logo area (placeholder)
    doc.setFillColor(this.cooperativeColors.primary);
    doc.rect(20, yPosition - 5, 8, 8, 'F');
    
    // Add white text in logo area
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('SVMPC', 24, yPosition + 1);

    // Add title
    doc.setTextColor(this.cooperativeColors.primary);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 35, yPosition + 2);

    // Add subtitle
    doc.setTextColor(this.cooperativeColors.lightText);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 35, yPosition + 8);

    // Add horizontal line
    doc.setDrawColor(this.cooperativeColors.primary);
    doc.setLineWidth(0.5);
    doc.line(20, yPosition + 12, pageWidth - 20, yPosition + 12);

    return yPosition + 20;
  }

  _addReportMetadata(doc, pageWidth, yPosition, filters) {
    doc.setTextColor(this.cooperativeColors.text);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Generation date
    const now = new Date();
    doc.text(`Generated: ${formatDate(now)} at ${formatTime(now)}`, 20, yPosition);

    // Applied filters
    let filterText = 'Filters: ';
    if (filters.event && filters.event !== 'all') {
      filterText += `Event: ${filters.eventName || filters.event}, `;
    }
    if (filters.dateRange) {
      filterText += `Date Range: ${filters.dateRange}, `;
    }
    if (filters.search) {
      filterText += `Search: "${filters.search}", `;
    }
    
    if (filterText === 'Filters: ') {
      filterText = 'Filters: None (All records)';
    } else {
      filterText = filterText.slice(0, -2); // Remove trailing comma
    }

    doc.text(filterText, 20, yPosition + 5);

    return yPosition + 15;
  }

  _addStatisticsSummary(doc, pageWidth, yPosition, stats) {
    const boxWidth = (pageWidth - 60) / 4;
    const boxHeight = 20;
    const startX = 20;

    const statsData = [
      { label: 'Total Records', value: stats.totalRecords || 0 },
      { label: 'Unique Members', value: stats.uniqueMembers || 0 },
      { label: 'Events Tracked', value: stats.uniqueEvents || 0 },
      { label: 'Present Count', value: stats.presentCount || 0 }
    ];

    statsData.forEach((stat, index) => {
      const x = startX + (index * (boxWidth + 5));
      
      // Draw box border
      doc.setDrawColor(this.cooperativeColors.primary);
      doc.setLineWidth(0.3);
      doc.rect(x, yPosition, boxWidth, boxHeight);

      // Add value
      doc.setTextColor(this.cooperativeColors.primary);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(stat.value.toString(), x + boxWidth/2, yPosition + 8, { align: 'center' });

      // Add label
      doc.setTextColor(this.cooperativeColors.lightText);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(stat.label, x + boxWidth/2, yPosition + 14, { align: 'center' });
    });

    return yPosition + boxHeight + 10;
  }

  _addAttendanceTable(doc, yPosition, data, pageHeight) {
    if (!data || data.length === 0) {
      doc.setTextColor(this.cooperativeColors.lightText);
      doc.setFontSize(12);
      doc.text('No attendance records found.', 20, yPosition);
      return yPosition + 20;
    }

    // Prepare table data
    const tableData = data.map(log => {
      const date = new Date(log.scanTime || log.timestamp);
      return [
        formatDate(date),
        formatTime(date),
        log.memberId || '',
        log.memberName || '',
        log.eventName || log.event || '',
        log.barangay || '',
        log.status || 'Present'
      ];
    });

    // Configure table
    autoTable(doc, {
      startY: yPosition,
      head: [['Date', 'Time', 'Member ID', 'Member Name', 'Event', 'Barangay', 'Status']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: this.cooperativeColors.text,
        lineColor: this.cooperativeColors.border,
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: this.cooperativeColors.primary,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: this.cooperativeColors.background
      },
      columnStyles: {
        0: { cellWidth: 20 }, // Date
        1: { cellWidth: 20 }, // Time
        2: { cellWidth: 25 }, // Member ID
        3: { cellWidth: 35 }, // Member Name
        4: { cellWidth: 35 }, // Event
        5: { cellWidth: 25 }, // Barangay
        6: { cellWidth: 20 }  // Status
      },
      margin: { left: 20, right: 20 },
      didDrawPage: (data) => {
        // Add page numbers
        const pageCount = doc.internal.getNumberOfPages();
        const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
        
        doc.setFontSize(8);
        doc.setTextColor(this.cooperativeColors.lightText);
        doc.text(
          `Page ${currentPage} of ${pageCount}`,
          data.settings.margin.left,
          pageHeight - 10
        );
      }
    });

    return doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : yPosition + 10;
  }

  _addEventDetails(doc, pageWidth, yPosition, eventData) {
    doc.setTextColor(this.cooperativeColors.text);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Event Details', 20, yPosition);

    yPosition += 8;

    const details = [
      ['Event Name:', eventData.eventName || 'N/A'],
      ['Date:', eventData.eventDate ? formatDate(eventData.eventDate) : 'N/A'],
      ['Time:', eventData.eventTime || 'N/A'],
      ['Location:', eventData.location || 'N/A'],
      ['Status:', eventData.status || 'N/A'],
      ['Description:', eventData.description || 'N/A']
    ];

    doc.setFontSize(10);
    details.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 60, yPosition);
      yPosition += 5;
    });

    return yPosition + 5;
  }

  _addEventStatistics(doc, pageWidth, yPosition, stats) {
    doc.setTextColor(this.cooperativeColors.text);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Event Statistics', 20, yPosition);

    yPosition += 10;

    const boxWidth = (pageWidth - 50) / 3;
    const boxHeight = 20;

    const statsData = [
      { label: 'Total Attendees', value: stats.totalAttendees || 0 },
      { label: 'Attendance Rate', value: `${stats.attendanceRate || 0}%` },
      { label: 'On Time Arrivals', value: stats.onTimeArrivals || 0 }
    ];

    statsData.forEach((stat, index) => {
      const x = 20 + (index * (boxWidth + 5));
      
      doc.setDrawColor(this.cooperativeColors.primary);
      doc.setLineWidth(0.3);
      doc.rect(x, yPosition, boxWidth, boxHeight);

      doc.setTextColor(this.cooperativeColors.primary);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(stat.value.toString(), x + boxWidth/2, yPosition + 8, { align: 'center' });

      doc.setTextColor(this.cooperativeColors.lightText);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(stat.label, x + boxWidth/2, yPosition + 14, { align: 'center' });
    });

    return yPosition + boxHeight + 10;
  }

  _addAttendanceBreakdown(doc, yPosition, data, pageHeight) {
    if (!data || data.length === 0) return yPosition;

    doc.setTextColor(this.cooperativeColors.text);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Attendance Breakdown', 20, yPosition);

    yPosition += 10;

    const tableData = data.map(record => [
      record.memberName || '',
      record.memberId || '',
      record.barangay || '',
      record.scanTime ? formatTime(record.scanTime) : '',
      record.status || 'Present'
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Member Name', 'Member ID', 'Barangay', 'Check-in Time', 'Status']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: this.cooperativeColors.text
      },
      headStyles: {
        fillColor: this.cooperativeColors.primary,
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: this.cooperativeColors.background
      },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 28 },
        2: { cellWidth: 34 },
        3: { cellWidth: 26 },
        4: { cellWidth: 22 }
      },
      margin: { left: 20, right: 20 }
    });

    return doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : yPosition + 10;
  }

  _addMemberDetails(doc, pageWidth, yPosition, memberData) {
    doc.setTextColor(this.cooperativeColors.text);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Member Information', 20, yPosition);

    yPosition += 8;

    const details = [
      ['Member ID:', memberData.memberId || 'N/A'],
      ['Name:', memberData.memberName || 'N/A'],
      ['Barangay:', memberData.barangay || 'N/A'],
      ['Contact:', memberData.contactNumber || 'N/A'],
      ['Email:', memberData.email || 'N/A'],
      ['Status:', memberData.status || 'Active']
    ];

    doc.setFontSize(10);
    details.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 60, yPosition);
      yPosition += 5;
    });

    return yPosition + 5;
  }

  _addMemberStatistics(doc, pageWidth, yPosition, stats) {
    doc.setTextColor(this.cooperativeColors.text);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Attendance Statistics', 20, yPosition);

    yPosition += 10;

    const boxWidth = (pageWidth - 65) / 4;
    const boxHeight = 20;

    const statsData = [
      { label: 'Total Events', value: stats.totalEvents || 0 },
      { label: 'Events Attended', value: stats.eventsAttended || 0 },
      { label: 'Attendance Rate', value: `${stats.attendanceRate || 0}%` },
      { label: 'Perfect Months', value: stats.perfectMonths || 0 }
    ];

    statsData.forEach((stat, index) => {
      const x = 20 + (index * (boxWidth + 5));
      
      doc.setDrawColor(this.cooperativeColors.primary);
      doc.setLineWidth(0.3);
      doc.rect(x, yPosition, boxWidth, boxHeight);

      doc.setTextColor(this.cooperativeColors.primary);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(stat.value.toString(), x + boxWidth/2, yPosition + 8, { align: 'center' });

      doc.setTextColor(this.cooperativeColors.lightText);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(stat.label, x + boxWidth/2, yPosition + 14, { align: 'center' });
    });

    return yPosition + boxHeight + 10;
  }

  _addMemberAttendanceTable(doc, yPosition, data, pageHeight) {
    if (!data || data.length === 0) {
      doc.setTextColor(this.cooperativeColors.lightText);
      doc.setFontSize(12);
      doc.text('No attendance records found.', 20, yPosition);
      return yPosition + 20;
    }

    const tableData = data.map(record => {
      const date = new Date(record.scanTime || record.timestamp);
      return [
        formatDate(date),
        formatTime(date),
        record.eventName || record.event || '',
        record.status || 'Present'
      ];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [['Date', 'Time', 'Event', 'Status']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: this.cooperativeColors.text
      },
      headStyles: {
        fillColor: this.cooperativeColors.primary,
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: this.cooperativeColors.background
      },
      margin: { left: 20, right: 20 }
    });

    return doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : yPosition + 10;
  }

  _addFooter(doc, pageWidth, pageHeight) {
    const footerY = pageHeight - 15;
    
    // Add separator line
    doc.setDrawColor(this.cooperativeColors.border);
    doc.setLineWidth(0.3);
    doc.line(20, footerY - 5, pageWidth - 20, footerY - 5);

    // Add footer text
    doc.setTextColor(this.cooperativeColors.lightText);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Samahang Kooperatibo ng mga Magsasaka sa Palay sa Cabuyao (SVMPC)', 20, footerY);
    doc.text('Cooperative Management System - Attendance Module', 20, footerY + 4);
    
    // Add generation timestamp
    const timestamp = formatDateTime(new Date());
    doc.text(`Generated: ${timestamp}`, pageWidth - 20, footerY, { align: 'right' });
  }

  _calculateEventStats(attendanceData) {
    const totalAttendees = attendanceData.length;
    const onTimeArrivals = attendanceData.filter(record => {
      // Assuming on-time is within 15 minutes of event start
      return record.status === 'present' || record.status === 'on-time';
    }).length;

    return {
      totalAttendees,
      attendanceRate: totalAttendees > 0 ? Math.round((totalAttendees / totalAttendees) * 100) : 0,
      onTimeArrivals
    };
  }

  _calculateMemberStats(attendanceHistory) {
    const totalEvents = attendanceHistory.length;
    const eventsAttended = attendanceHistory.filter(record => 
      record.status === 'present' || record.status === 'attended'
    ).length;
    
    const attendanceRate = totalEvents > 0 ? Math.round((eventsAttended / totalEvents) * 100) : 0;
    
    // Calculate perfect months (months with 100% attendance)
    const monthlyAttendance = {};
    attendanceHistory.forEach(record => {
      const date = new Date(record.scanTime || record.timestamp);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      
      if (!monthlyAttendance[monthKey]) {
        monthlyAttendance[monthKey] = { total: 0, attended: 0 };
      }
      
      monthlyAttendance[monthKey].total++;
      if (record.status === 'present' || record.status === 'attended') {
        monthlyAttendance[monthKey].attended++;
      }
    });

    const perfectMonths = Object.values(monthlyAttendance).filter(
      month => month.attended === month.total && month.total > 0
    ).length;

    return {
      totalEvents,
      eventsAttended,
      attendanceRate,
      perfectMonths
    };
  }
}

// Export singleton instance
export const pdfReportGenerator = new PDFReportGenerator();
export default pdfReportGenerator;