import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserPlus, Upload, Printer, Search, Filter, Grid, List, 
  Download, XCircle, CheckCircle2, MapPin, Mail, Phone
} from 'lucide-react';
import { memberAPI } from '../../../services/api';

const BARANGAYS = ['All', 'Poblacion', 'San Roque', 'Santa Cruz', 'San Jose', 'Bagumbayan', 'Unassigned'];

const MemberManagement = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('All');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const response = await memberAPI.getAllMembers();
      if (response.members) {
        setMembers(response.members);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch = 
      member.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.memberId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBarangay = 
      selectedBarangay === 'All' || member.barangay === selectedBarangay;
    
    return matchesSearch && matchesBarangay;
  });

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'text/csv') {
      setUploadFile(file);
    } else {
      alert('Please select a valid CSV file');
    }
  };

  const handleImportCSV = async () => {
    if (!uploadFile) return;

    setUploadProgress('uploading');
    try {
      const response = await memberAPI.uploadMembers(uploadFile);
      
      if (response.members) {
        setUploadProgress('success');
        setTimeout(() => {
          setIsImportModalOpen(false);
          setUploadFile(null);
          setUploadProgress(null);
          fetchMembers();
        }, 2000);
      }
    } catch (error) {
      console.error('Error importing members:', error);
      setUploadProgress('error');
      alert('Failed to import members. Please check the CSV format.');
    }
  };

  const handleGenerateQRCodes = async (memberIds) => {
    try {
      const response = await memberAPI.generateQRCodes(memberIds);
      if (response.results) {
        alert(`Generated ${response.generatedCount} QR codes successfully`);
        fetchMembers();
      }
    } catch (error) {
      console.error('Error generating QR codes:', error);
      alert('Failed to generate QR codes');
    }
  };

  const handlePrintQRCodes = (selectedMembers) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrCards = selectedMembers.map((member) => `
      <div class="qr-card">
        <div class="qr-header">
          <h3>${member.memberName}</h3>
          <p>ID: ${member.memberId}</p>
        </div>
        <div class="qr-code">
          ${member.qrCodeUrl 
            ? `<img src="${member.qrCodeUrl}" alt="QR Code" />`
            : '<div class="no-qr">QR Code Not Generated</div>'}
        </div>
        <div class="qr-footer">
          <p>${member.barangay}</p>
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Member QR Codes</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            .qr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .qr-card { border: 2px solid #2D7A3E; border-radius: 12px; padding: 20px; text-align: center; page-break-inside: avoid; }
            .qr-header h3 { margin: 0; color: #2D7A3E; font-size: 18px; }
            .qr-header p { margin: 5px 0; color: #64748b; font-size: 14px; }
            .qr-code { margin: 20px 0; }
            .qr-code img { width: 200px; height: 200px; }
            .no-qr { width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; background: #f1f5f9; color: #94a3b8; margin: 0 auto; }
            .qr-footer p { margin: 0; color: #64748b; font-size: 12px; }
            @media print { .qr-card { page-break-inside: avoid; } }
          </style>
        </head>
        <body>
          <h1 style="text-align: center; color: #2D7A3E; margin-bottom: 30px;">Member QR Codes</h1>
          <div class="qr-grid">${qrCards}</div>
          <script>setTimeout(() => window.print(), 500);</script>
        </body>
      </html>
    `);
  };

  const exportToCSV = () => {
    const headers = ['Member ID', 'Name', 'Email', 'Phone', 'Barangay', 'Address', 'QR Generated'];
    const rows = filteredMembers.map((member) => [
      member.memberId,
      member.memberName,
      member.email,
      member.phoneNumber,
      member.barangay,
      member.address,
      member.qrCodeGenerated ? 'Yes' : 'No'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `members_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: '#2D7A3E' }}>
            Member Management
          </h2>
          <p className="text-gray-600 font-medium">
            {filteredMembers.length} of {members.length} members
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="h-12 px-6 bg-white border border-gray-200 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4 mr-2 inline" />
            Import CSV
          </button>
          <button
            onClick={exportToCSV}
            className="h-12 px-6 text-white rounded-xl font-bold text-sm shadow-lg"
            style={{ backgroundColor: '#2D7A3E' }}
          >
            <Download className="w-4 h-4 mr-2 inline" />
            Export
          </button>
        </div>
      </div>

      {/* Filters and View Toggle */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, ID, or email..."
                className="h-12 w-full pl-11 pr-4 rounded-xl border-gray-200 focus:border-green-500 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="h-12 pl-11 pr-8 rounded-xl border-gray-200 focus:border-green-500 focus:ring-green-500 appearance-none"
              >
                {BARANGAYS.map((barangay) => (
                  <option key={barangay} value={barangay}>
                    {barangay}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 ${viewMode === 'table' ? 'bg-gray-100' : 'bg-white'}`}
              >
                <List className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 border-l border-gray-200 ${viewMode === 'grid' ? 'bg-gray-100' : 'bg-white'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Members Display */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin"></div>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Barangay
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    QR Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMembers.map((member) => (
                  <tr key={member._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3" style={{ backgroundColor: '#2D7A3E' }}>
                          {member.memberName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{member.memberName}</div>
                          <div className="text-sm text-gray-500">ID: {member.memberId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.email}</div>
                      <div className="text-sm text-gray-500">{member.phoneNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                        {member.barangay}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.qrCodeGenerated ? (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-green-100 text-green-800">
                          Generated
                        </span>
                      ) : (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-gray-100 text-gray-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleGenerateQRCodes([member.memberId])}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        Generate QR
                      </button>
                      <button
                        onClick={() => handlePrintQRCodes([member])}
                        className="text-green-600 hover:text-green-900"
                      >
                        Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map((member) => (
            <motion.div
              key={member._id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:border-green-200 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: '#2D7A3E' }}>
                  {member.memberName.split(' ').map(n => n[0]).join('')}
                </div>
                {member.qrCodeGenerated ? (
                  <span className="px-2 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800">
                    QR Ready
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-800">
                    No QR
                  </span>
                )}
              </div>

              <h3 className="font-bold text-gray-900 mb-1">{member.memberName}</h3>
              <p className="text-sm text-gray-500 mb-4">ID: {member.memberId}</p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="w-4 h-4 mr-2 text-gray-400" />
                  {member.email}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="w-4 h-4 mr-2 text-gray-400" />
                  {member.phoneNumber}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                  {member.barangay}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleGenerateQRCodes([member.memberId])}
                  className="flex-1 h-10 rounded-xl border border-gray-200 text-xs font-bold hover:bg-gray-50 transition-colors"
                >
                  Generate QR
                </button>
                <button
                  onClick={() => handlePrintQRCodes([member])}
                  className="h-10 px-4 rounded-xl text-white text-xs font-bold"
                  style={{ backgroundColor: '#2D7A3E' }}
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Import CSV Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !uploadProgress && setIsImportModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative z-10 border"
              style={{ borderColor: '#2D7A3E' }}
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight uppercase">
                      Import Members
                    </h3>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mt-1">
                      Upload CSV file
                    </p>
                  </div>
                  {!uploadProgress && (
                    <button
                      onClick={() => setIsImportModalOpen(false)}
                      className="rounded-full hover:bg-gray-100 p-2"
                    >
                      <XCircle className="w-6 h-6 text-gray-300" />
                    </button>
                  )}
                </div>

                {uploadProgress === 'success' ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <p className="text-lg font-bold text-gray-900">Import Successful!</p>
                    <p className="text-sm text-gray-500 mt-2">Members have been added to the system</p>
                  </div>
                ) : uploadProgress === 'error' ? (
                  <div className="text-center py-8">
                    <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <p className="text-lg font-bold text-gray-900">Import Failed</p>
                    <p className="text-sm text-gray-500 mt-2">Please check the CSV format and try again</p>
                    <button
                      onClick={() => setUploadProgress(null)}
                      className="mt-4 px-6 py-2 bg-gray-100 rounded-xl font-bold text-sm"
                    >
                      Try Again
                    </button>
                  </div>
                ) : uploadProgress === 'uploading' ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg font-bold text-gray-900">Importing Members...</p>
                    <p className="text-sm text-gray-500 mt-2">Please wait while we process your file</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="csv-upload"
                      />
                      <label
                        htmlFor="csv-upload"
                        className="cursor-pointer text-sm font-bold text-gray-600 hover:text-gray-900"
                      >
                        {uploadFile ? uploadFile.name : 'Click to select CSV file'}
                      </label>
                    </div>

                    <div className="pt-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsImportModalOpen(false)}
                        className="flex-1 h-14 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-900 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleImportCSV}
                        disabled={!uploadFile}
                        className="flex-1 h-14 rounded-xl text-white font-bold text-xs uppercase tracking-wider shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#2D7A3E' }}
                      >
                        Import Members
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MemberManagement;
