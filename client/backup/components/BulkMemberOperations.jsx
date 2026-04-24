import { useState, useEffect } from 'react';
import { memberAPI } from '../services/api';

export default function BulkMemberOperations() {
  const [members, setMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await memberAPI.getAllMembers();
      setMembers(data.members || []);
    } catch (error) {
      setMessage('Error fetching members: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedMembers(members.map(m => m.memberId));
    } else {
      setSelectedMembers([]);
    }
  };

  const handleSelectMember = (memberId) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleGenerateQRCodes = async () => {
    if (selectedMembers.length === 0) {
      setMessage('Please select at least one member');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const data = await memberAPI.generateQRCodes(selectedMembers);
      setMessage(`✓ Generated QR codes for ${data.generatedCount} members`);
      fetchMembers(); // Refresh the list
    } catch (error) {
      setMessage('Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAllQRCodes = async () => {
    setLoading(true);
    setMessage('');

    try {
      const data = await memberAPI.generateAllQRCodes();
      setMessage(`✓ Generated QR codes for ${data.generatedCount} members`);
      fetchMembers(); // Refresh the list
    } catch (error) {
      setMessage('Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Member Operations</h2>

      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex gap-4 mb-4">
          <button
            onClick={handleGenerateQRCodes}
            disabled={loading || selectedMembers.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition"
          >
            {loading ? 'Generating...' : `Generate QR for Selected (${selectedMembers.length})`}
          </button>
          <button
            onClick={handleGenerateAllQRCodes}
            disabled={loading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium transition"
          >
            {loading ? 'Generating...' : 'Generate QR for All'}
          </button>
          <button
            onClick={fetchMembers}
            disabled={loading}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 font-medium transition"
          >
            Refresh
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-lg ${
            message.includes('Error') 
              ? 'bg-red-50 text-red-800 border border-red-200' 
              : 'bg-green-50 text-green-800 border border-green-200'
          }`}>
            {message}
          </div>
        )}
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Members ({members.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="text-gray-600">Loading members...</div>
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-600">No members found</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedMembers.length === members.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Member ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Barangay</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">QR Code</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.memberId} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.memberId)}
                        onChange={() => handleSelectMember(member.memberId)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{member.memberId}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{member.memberName}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{member.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{member.barangay}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        member.qrCodeGenerated 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {member.qrCodeGenerated ? 'Generated' : 'Not Generated'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}