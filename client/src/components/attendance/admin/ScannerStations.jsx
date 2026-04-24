import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, QrCode, MapPin, Activity, XCircle, Trash2, Edit2, CheckCircle2 } from 'lucide-react';
import { scannerAPI } from '../../../services/api';

const ScannerStations = () => {
  const [scanners, setScanners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newScanner, setNewScanner] = useState({
    stationName: '',
    location: '',
    description: ''
  });

  useEffect(() => {
    fetchScanners();
  }, []);

  const fetchScanners = async () => {
    setLoading(true);
    try {
      const response = await scannerAPI.getAllScanners();
      if (response.scanners) {
        setScanners(response.scanners);
      }
    } catch (error) {
      console.error('Error fetching scanners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddScanner = async (e) => {
    e.preventDefault();
    if (!newScanner.stationName || !newScanner.location) return;

    try {
      const response = await scannerAPI.registerScanner({
        stationName: newScanner.stationName,
        location: newScanner.location,
        description: newScanner.description,
        status: 'active'
      });

      if (response.scanner) {
        setScanners([...scanners, response.scanner]);
        setNewScanner({ stationName: '', location: '', description: '' });
        setIsAddModalOpen(false);
      }
    } catch (error) {
      console.error('Error adding scanner:', error);
      alert('Failed to add scanner station');
    }
  };

  const handleDeleteScanner = async (stationId) => {
    if (!window.confirm('Are you sure you want to delete this scanner station?')) return;

    try {
      // Note: Backend doesn't have delete endpoint yet, so we'll just remove from UI
      setScanners(scanners.filter(s => s.stationId !== stationId));
    } catch (error) {
      console.error('Error deleting scanner:', error);
    }
  };

  const toggleScannerStatus = async (stationId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    try {
      const response = await scannerAPI.updateScannerStatus(stationId, newStatus);
      if (response.scanner) {
        setScanners(scanners.map(s => 
          s.stationId === stationId ? { ...s, status: newStatus } : s
        ));
      }
    } catch (error) {
      console.error('Error updating scanner status:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'offline':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: '#2D7A3E' }}>
            Scanner Stations
          </h2>
          <p className="text-gray-600 font-medium">Manage QR scanning terminals</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="h-12 px-8 text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg"
          style={{ backgroundColor: '#2D7A3E' }}
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          Add Station
        </button>
      </div>

      {/* Scanner Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin"></div>
        </div>
      ) : scanners.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {scanners.map((scanner) => (
              <motion.div
                key={scanner.stationId}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden group hover:border-green-200 transition-all"
              >
                <div className="bg-gray-50/50 p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                        scanner.status === 'active' 
                          ? 'bg-green-100 border-green-200 text-green-700'
                          : 'bg-gray-100 border-gray-200 text-gray-500'
                      }`}>
                        <QrCode className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{scanner.stationName}</h3>
                        <span className={`mt-1 px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(scanner.status)}`}>
                          {scanner.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteScanner(scanner.stationId)}
                      className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 font-medium">{scanner.location}</span>
                  </div>

                  {scanner.description && (
                    <p className="text-sm text-gray-500">{scanner.description}</p>
                  )}

                  <div className="flex items-center justify-between text-sm pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500 font-medium">
                        Last Active: {scanner.lastHeartbeat 
                          ? new Date(scanner.lastHeartbeat).toLocaleString()
                          : 'Never'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 grid grid-cols-2 gap-3">
                    <button
                      onClick={() => toggleScannerStatus(scanner.stationId, scanner.status)}
                      className={`h-10 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
                        scanner.status === 'active'
                          ? 'border-red-200 text-red-700 hover:bg-red-50'
                          : 'border-green-200 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {scanner.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className="h-10 rounded-xl border border-gray-200 text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-all"
                    >
                      <Edit2 className="w-3 h-3 mr-2 inline" />
                      Edit
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No scanner stations configured</p>
          <p className="text-sm text-gray-400 mt-2">Add your first scanner station to start tracking attendance</p>
        </div>
      )}

      {/* Add Scanner Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
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
                      New Scanner Station
                    </h3>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mt-1">
                      Configure scanning terminal
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    className="rounded-full hover:bg-gray-100 p-2"
                  >
                    <XCircle className="w-6 h-6 text-gray-300" />
                  </button>
                </div>

                <form onSubmit={handleAddScanner} className="space-y-6">
                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                      Station Name
                    </label>
                    <input
                      autoFocus
                      value={newScanner.stationName}
                      onChange={(e) => setNewScanner({ ...newScanner, stationName: e.target.value })}
                      placeholder="e.g. Main Entrance Scanner"
                      className="h-14 w-full rounded-xl border-gray-200 font-bold focus:ring-green-500 bg-gray-50 px-4"
                      required
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                      Location
                    </label>
                    <input
                      value={newScanner.location}
                      onChange={(e) => setNewScanner({ ...newScanner, location: e.target.value })}
                      placeholder="e.g. Building A, Ground Floor"
                      className="h-14 w-full rounded-xl border-gray-200 font-bold focus:ring-green-500 bg-gray-50 px-4"
                      required
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                      Description (Optional)
                    </label>
                    <textarea
                      value={newScanner.description}
                      onChange={(e) => setNewScanner({ ...newScanner, description: e.target.value })}
                      placeholder="Additional notes about this scanner..."
                      className="w-full rounded-xl border-gray-200 font-medium focus:ring-green-500 bg-gray-50 px-4 py-3"
                      rows={3}
                    />
                  </div>

                  <div className="pt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="flex-1 h-14 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-900 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newScanner.stationName || !newScanner.location}
                      className="flex-1 h-14 rounded-xl text-white font-bold text-xs uppercase tracking-wider shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#2D7A3E' }}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2 inline" />
                      Create Station
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScannerStations;
