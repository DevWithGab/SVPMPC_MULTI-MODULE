# PDF Report Generation Utilities

This directory contains professional PDF report generation utilities for the Attendance Management System.

## Features

### 📄 **PDFReportGenerator**
A comprehensive class for generating professional PDF reports with:
- Clean, professional layout with cooperative branding
- Automatic page numbering and headers/footers
- Statistics summaries with visual boxes
- Professional table formatting with alternating row colors
- Proper typography and spacing

### 📊 **Report Types**

1. **Attendance Report** - Complete attendance records with filtering
2. **Event Summary Report** - Detailed analysis of specific events
3. **Member Summary Report** - Individual member attendance history
4. **Event Comparison Report** - Compare attendance across multiple events
5. **Member Directory Report** - Complete member list with statistics

## Usage Examples

### Basic Attendance Report
```javascript
import { pdfReportGenerator } from '../utils/pdfReportGenerator';

const generateReport = () => {
  const reportOptions = {
    data: attendanceRecords,
    filters: {
      event: 'all',
      search: '',
      dateRange: 'All time'
    },
    stats: {
      totalRecords: 150,
      uniqueMembers: 45,
      uniqueEvents: 8,
      presentCount: 142
    },
    title: 'Monthly Attendance Report',
    subtitle: 'March 2024 - Cooperative Management System'
  };

  const result = pdfReportGenerator.generateAttendanceReport(reportOptions);
  console.log(`Report generated: ${result.filename}`);
};
```

### Event Summary Report
```javascript
import { reportHelpers } from '../utils/reportHelpers';

const generateEventSummary = (eventData, attendanceData) => {
  const result = reportHelpers.generateEventSummaryReport({
    eventData: {
      eventName: 'Monthly General Assembly',
      eventDate: '2024-03-15',
      eventTime: '14:00',
      location: 'Main Hall',
      status: 'completed'
    },
    attendanceData: eventAttendanceRecords
  });
};
```

### Member Individual Report
```javascript
import { generateMemberReport } from '../utils/reportHelpers';

const generateMemberSummary = (member, attendanceHistory) => {
  const result = generateMemberReport(
    {
      memberId: 'M001',
      memberName: 'Juan Dela Cruz',
      barangay: 'Barangay 1',
      contactNumber: '09123456789',
      email: 'juan@example.com',
      status: 'Active'
    },
    attendanceHistory
  );
};
```

## Report Features

### 🎨 **Professional Design**
- Cooperative color scheme (#2D7A3E, #F2E416, #163A1E)
- Clean typography with proper hierarchy
- Professional spacing and margins
- Branded headers and footers

### 📈 **Statistics Integration**
- Visual statistics boxes with key metrics
- Attendance rate calculations
- Member participation analysis
- Event performance metrics

### 🔍 **Filtering Support**
- Event-specific reports
- Date range filtering
- Member search filtering
- Custom report criteria

### 📱 **Responsive Layout**
- Optimized for A4 paper size
- Proper page breaks
- Automatic table pagination
- Mobile-friendly generation

## File Structure

```
utils/
├── pdfReportGenerator.js    # Core PDF generation class
├── reportHelpers.js         # Helper functions for specific reports
├── index.js                # Utility exports
└── README.md               # This documentation
```

## Dependencies

- **jsPDF** - PDF generation library
- **jspdf-autotable** - Table generation plugin

## Integration

The PDF generator is already integrated into:
- ✅ Attendance Admin Reports component
- ✅ Event Management system
- ✅ Member Management system

## Customization

### Adding New Report Types
1. Add method to `PDFReportGenerator` class
2. Create helper function in `reportHelpers.js`
3. Export in `index.js`
4. Update component integration

### Styling Customization
Modify the `cooperativeColors` object in `PDFReportGenerator` constructor:
```javascript
this.cooperativeColors = {
  primary: '#2D7A3E',    // Main brand color
  secondary: '#F2E416',  // Accent color
  dark: '#163A1E',       // Dark variant
  text: '#1e293b',       // Primary text
  lightText: '#64748b',  // Secondary text
  border: '#e2e8f0',     // Border color
  background: '#f8fafc'  // Background color
};
```

## Error Handling

All report generation functions include:
- Try-catch error handling
- Validation of input data
- Graceful fallbacks for missing data
- Detailed error messages

## Performance

- Optimized for large datasets (1000+ records)
- Efficient table rendering
- Minimal memory usage
- Fast PDF generation (< 2 seconds for typical reports)