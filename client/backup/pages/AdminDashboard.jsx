import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BulkMemberImport from '../components/BulkMemberImport';
import ImportHistory from '../components/ImportHistory';

export default function AdminDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('import');

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b-2 border-green-900 px-8 py-5 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-green-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Member Management System</p>
          </div>
          <div className="flex items-center gap-6">
            <span className="font-semibold text-gray-800">{user?.username}</span>
            <button
              onClick={handleLogout}
              className="bg-green-900 text-white px-4 py-2 rounded hover:bg-green-800 transition font-semibold"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1 gap-5 p-5 max-w-7xl mx-auto w-full">
        {/* Navigation */}
        <nav className="w-48 flex flex-col gap-2">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-3 rounded-lg font-semibold text-left transition ${
              activeTab === 'import'
                ? 'bg-green-900 text-white'
                : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-green-900'
            }`}
          >
            📤 Bulk Import
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 rounded-lg font-semibold text-left transition ${
              activeTab === 'history'
                ? 'bg-green-900 text-white'
                : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-green-900'
            }`}
          >
            📋 Import History
          </button>
        </nav>

        {/* Main Content */}
        <div className="flex-1 bg-white rounded-lg p-6 shadow-md">
          {activeTab === 'import' && <BulkMemberImport />}
          {activeTab === 'history' && <ImportHistory />}
        </div>
      </div>
    </div>
  );
}