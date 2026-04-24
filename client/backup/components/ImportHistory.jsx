import { useState, useEffect } from 'react';
import { bulkImportAPI } from '../services/api';

export default function ImportHistory() {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOperation, setSelectedOperation] = useState(null);
  const [operationDetails, setOperationDetails] = useState(null);

  useEffect(() => {
    fetchOperations();
  }, []);

  const fetchOperations = async () => {
    try {
      const data = await bulkImportAPI.getAllOperations();
      setOperations(data.operations || []);
    } catch (error) {
      console.error('Error fetching operations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (operationId) => {
    try {
      const data = await bulkImportAPI.getImportDetails(operationId);
      setOperationDetails(data);
      setSelectedOperation(operationId);
    } catch (error) {
      console.error('Error fetching operation details:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading import history...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Import History</h2>

      {operations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">No import operations found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Operation ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">File Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Total Rows</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Created</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((operation) => (
                  <tr key={operation.operationId} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">
                      {operation.operationId.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{operation.fileName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(operation.status)}`}>
                        {operation.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{operation.totalRows}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {new Date(operation.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleViewDetails(operation.operationId)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Operation Details Modal */}
      {selectedOperation && operationDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Import Operation Details</h3>
                <button
                  onClick={() => {
                    setSelectedOperation(null);
                    setOperationDetails(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Operation ID</label>
                  <p className="text-sm font-mono text-gray-900">{operationDetails.operationId}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(operationDetails.status)}`}>
                    {operationDetails.status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">File Name</label>
                  <p className="text-sm text-gray-900">{operationDetails.fileName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Rows</label>
                  <p className="text-sm text-gray-900">{operationDetails.totalRows}</p>
                </div>
              </div>

              {operationDetails.results && (
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Import Results</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{operationDetails.results.successful}</div>
                      <div className="text-sm text-gray-600">Successful</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{operationDetails.results.failed}</div>
                      <div className="text-sm text-gray-600">Failed</div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{operationDetails.results.total}</div>
                      <div className="text-sm text-gray-600">Total</div>
                    </div>
                  </div>
                </div>
              )}

              {operationDetails.errors && operationDetails.errors.length > 0 && (
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Errors</h4>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                    {operationDetails.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-700 mb-2">
                        <strong>Row {error.row}:</strong> {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}