import { useState, useEffect, useRef } from 'react';
import { scannerAPI, eventAPI } from '../services/api';

export default function ScannerStation({ onLogout }) {
  const [stationId, setStationId] = useState(null);
  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState([]);
  const [scanInput, setScanInput] = useState('');
  const [lastScan, setLastScan] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [stats, setStats] = useState({
    totalScans: 0,
    successScans: 0,
    duplicateScans: 0,
    errorScans: 0,
  });
  const [status, setStatus] = useState('disconnected');
  const [message, setMessage] = useState('');
  const scanInputRef = useRef(null);

  // Register scanner on mount
  useEffect(() => {
    registerScanner();
    const interval = setInterval(sendHeartbeat, 30000); // Heartbeat every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Fetch events
  useEffect(() => {
    fetchEvents();
  }, []);

  // Focus on scan input
  useEffect(() => {
    if (scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, []);

  const registerScanner = async () => {
    try {
      const scannerData = {
        stationName: `Scanner Station ${Date.now()}`,
        location: 'Event Venue',
        deviceId: `DEVICE-${navigator.userAgent.substring(0, 20)}`,
        ipAddress: 'local',
        userAgent: navigator.userAgent,
      };

      const data = await scannerAPI.registerScanner(scannerData);
      setStationId(data.station.stationId);
      setStatus('connected');
      setMessage('Scanner registered successfully');
    } catch (error) {
      setStatus('error');
      setMessage('Failed to register scanner: ' + error.message);
    }
  };

  const sendHeartbeat = async () => {
    if (!stationId) return;

    try {
      await scannerAPI.sendHeartbeat(stationId);
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const data = await eventAPI.getAllEvents();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const handleScan = async (e) => {
    e.preventDefault();

    if (!eventId) {
      setMessage('Please select an event');
      return;
    }

    if (!scanInput.trim()) {
      setMessage('Please scan a QR code');
      return;
    }

    try {
      const data = await scannerAPI.processScan(stationId, scanInput, eventId);

      if (data.status === 'success') {
        setLastScan({
          memberName: data.data.memberName,
          barangay: data.data.barangay,
          status: 'success',
          time: new Date().toLocaleTimeString(),
        });

        setScanHistory([
          {
            memberName: data.data.memberName,
            barangay: data.data.barangay,
            status: 'success',
            time: new Date().toLocaleTimeString(),
          },
          ...scanHistory.slice(0, 9),
        ]);

        setStats({
          ...stats,
          totalScans: stats.totalScans + 1,
          successScans: stats.successScans + 1,
        });

        setMessage('✓ Attendance recorded');
      } else {
        setLastScan({
          memberName: data.data?.memberName || data.memberName || 'Unknown',
          status: data.status,
          time: new Date().toLocaleTimeString(),
        });

        if (data.status === 'duplicate') {
          setStats({ 
            ...stats, 
            totalScans: stats.totalScans + 1, 
            duplicateScans: stats.duplicateScans + 1 
          });
          setMessage('⚠ Duplicate scan - already marked present');
        } else {
          setStats({ 
            ...stats, 
            totalScans: stats.totalScans + 1, 
            errorScans: stats.errorScans + 1 
          });
          setMessage('✗ ' + data.message);
        }
      }

      setScanInput('');
      scanInputRef.current?.focus();
    } catch (error) {
      setMessage('Error: ' + error.message);
      setStats({ 
        ...stats, 
        totalScans: stats.totalScans + 1, 
        errorScans: stats.errorScans + 1 
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🔍 Scanner Station</h1>
            <p className="text-sm text-gray-600">Station ID: {stationId || 'Registering...'}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              status === 'connected' ? 'bg-green-100 text-green-800' :
              status === 'error' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                status === 'connected' ? 'bg-green-600' :
                status === 'error' ? 'bg-red-600' :
                'bg-gray-600'
              }`}></span>
              {status.toUpperCase()}
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition"
            >
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Scanner Input */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Select Event:</label>
                <select
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose Event --</option>
                  {events.map((event) => (
                    <option key={event.eventId} value={event.eventId}>
                      {event.eventName}
                    </option>
                  ))}
                </select>
              </div>

              <form onSubmit={handleScan} className="space-y-4">
                <div>
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Scan QR code here..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                    autoComplete="off"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
                >
                  Manual Submit
                </button>
              </form>

              {lastScan && (
                <div className={`p-4 rounded-lg border-l-4 ${
                  lastScan.status === 'success'
                    ? 'bg-green-50 border-green-500'
                    : 'bg-yellow-50 border-yellow-500'
                }`}>
                  <h3 className="font-semibold text-gray-900 mb-2">Last Scan</h3>
                  <p className="text-lg font-medium text-gray-900">{lastScan.memberName}</p>
                  {lastScan.barangay && <p className="text-sm text-gray-700">{lastScan.barangay}</p>}
                  <p className="text-xs text-gray-600 mt-2">{lastScan.time}</p>
                  <p className={`text-sm font-medium mt-2 ${
                    lastScan.status === 'success' ? 'text-green-700' : 'text-yellow-700'
                  }`}>
                    {lastScan.status === 'success' ? '✓ Present' : '⚠ ' + lastScan.status}
                  </p>
                </div>
              )}

              {message && (
                <div className={`p-4 rounded-lg ${
                  message.includes('✓')
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : message.includes('✗')
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                }`}>
                  {message}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Stats & History */}
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-3xl font-bold text-gray-900">{stats.totalScans}</div>
                <div className="text-xs text-gray-600 mt-1">Total Scans</div>
              </div>
              <div className="bg-green-50 rounded-lg shadow p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{stats.successScans}</div>
                <div className="text-xs text-gray-600 mt-1">Success</div>
              </div>
              <div className="bg-yellow-50 rounded-lg shadow p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600">{stats.duplicateScans}</div>
                <div className="text-xs text-gray-600 mt-1">Duplicate</div>
              </div>
              <div className="bg-red-50 rounded-lg shadow p-4 text-center">
                <div className="text-3xl font-bold text-red-600">{stats.errorScans}</div>
                <div className="text-xs text-gray-600 mt-1">Error</div>
              </div>
            </div>

            {/* History Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Scan History</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {scanHistory.length === 0 ? (
                  <p className="text-center text-gray-600 py-8">No scans yet</p>
                ) : (
                  scanHistory.map((scan, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border-l-4 ${
                        scan.status === 'success'
                          ? 'bg-green-50 border-green-500'
                          : 'bg-yellow-50 border-yellow-500'
                      }`}
                    >
                      <p className="font-medium text-gray-900 text-sm">{scan.memberName}</p>
                      {scan.barangay && <p className="text-xs text-gray-700">{scan.barangay}</p>}
                      <p className="text-xs text-gray-600 mt-1">{scan.time}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}