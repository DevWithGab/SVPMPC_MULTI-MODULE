import { useState, useEffect } from 'react';
import { memberPortalAPI } from '../services/api';

export default function MemberPortal({ onBack }) {
  const [memberId, setMemberId] = useState('');
  const [memberData, setMemberData] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!memberId.trim()) {
      setError('Please enter a Member ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Fetch member profile
      const profileData = await memberPortalAPI.getMemberProfile(memberId);
      setMemberData(profileData.member);

      // Fetch attendance history
      const historyData = await memberPortalAPI.getAttendanceHistory(memberId);
      setAttendanceHistory(historyData.attendance || []);
    } catch (error) {
      setError(error.response?.data?.message || 'Member not found');
      setMemberData(null);
      setAttendanceHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMemberId('');
    setMemberData(null);
    setAttendanceHistory([]);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">👤 Member Portal</h1>
            <p className="text-sm text-gray-600">Check your attendance records</p>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition"
          >
            Back
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Search Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                placeholder="Enter your Member ID (e.g., MEM001)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
            {memberData && (
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition"
              >
                Reset
              </button>
            )}
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Member Profile */}
        {memberData && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Member Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Member ID</label>
                <p className="text-lg font-semibold text-gray-900">{memberData.memberId}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <p className="text-lg font-semibold text-gray-900">{memberData.memberName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="text-gray-900">{memberData.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <p className="text-gray-900">{memberData.phoneNumber}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barangay</label>
                <p className="text-gray-900">{memberData.barangay}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <p className="text-gray-900">{memberData.address}</p>
              </div>
            </div>
          </div>
        )}

        {/* Attendance History */}
        {memberData && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Attendance History</h2>
            
            {attendanceHistory.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No attendance records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Event</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Time</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceHistory.map((record, index) => (
                      <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{record.eventName}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {new Date(record.scanTime).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {new Date(record.scanTime).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            record.status === 'present' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {record.status === 'present' ? 'Present' : 'Absent'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}