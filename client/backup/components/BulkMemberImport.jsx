import { useState } from 'react';
import { bulkImportAPI } from '../services/api';

export default function BulkMemberImport() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setMessage('');
    }
  };

  const handlePreview = async () => {
    if (!file) {
      setMessage('Please select a CSV file');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const data = await bulkImportAPI.uploadCSV(file);
      setPreview(data);
      setMessage('Preview loaded successfully');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) {
      setMessage('No preview data');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await bulkImportAPI.confirmImport(preview.operationId, ['email', 'sms']);
      setMessage('Import started! Check history for progress.');
      setFile(null);
      setPreview(null);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Bulk Member Import</h2>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Step 1: Upload CSV File</h3>
        <div className="flex gap-3">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            onClick={handlePreview}
            disabled={!file || loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition"
          >
            {loading ? 'Loading...' : 'Preview'}
          </button>
        </div>
      </div>

      {preview && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Step 2: Review Preview</h3>
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <p className="text-gray-700">Total Rows: <strong>{preview.totalRows}</strong></p>
            <p className="text-gray-700">File: <strong>{preview.fileName}</strong></p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Member ID</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Phone</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Barangay</th>
                </tr>
              </thead>
              <tbody>
                {preview.previewData.slice(0, 5).map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-700">{row.memberId}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{row.memberName}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{row.email}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{row.phoneNumber}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{row.barangay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.previewData.length > 5 && (
              <p className="text-sm text-gray-600 mt-2">... and {preview.previewData.length - 5} more rows</p>
            )}
          </div>

          <button
            onClick={handleConfirmImport}
            disabled={loading}
            className="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium transition"
          >
            {loading ? 'Importing...' : 'Confirm & Import'}
          </button>
        </div>
      )}

      {message && (
        <div className={`p-4 rounded-lg ${message.includes('Error') ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
          {message}
        </div>
      )}
    </div>
  );
}