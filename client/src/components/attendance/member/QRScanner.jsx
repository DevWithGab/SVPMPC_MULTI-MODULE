import React, { useState, useRef, useEffect } from 'react';
import { 
  QrCode, Camera, CheckCircle2, AlertCircle, 
  Scan, Zap, Clock, RefreshCw 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';

export default function QRScanner({ user, onScanSuccess }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState('');
  const [lastScan, setLastScan] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startScanning = async () => {
    try {
      setError('');
      setIsScanning(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions.');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const simulateScan = () => {
    // Simulate a successful scan for demo purposes
    const mockScanData = {
      eventId: 'EVENT-001',
      eventName: 'Weekly Meeting',
      timestamp: new Date().toISOString(),
      location: 'Main Hall'
    };
    
    setScanResult(mockScanData);
    setLastScan(mockScanData);
    
    if (onScanSuccess) {
      onScanSuccess(mockScanData);
    }
    
    stopScanning();
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const recentScans = [
    { id: 1, event: 'Weekly Meeting', time: '2 hours ago', status: 'success' },
    { id: 2, event: 'Community Service', time: '1 day ago', status: 'success' },
    { id: 3, event: 'Training Session', time: '3 days ago', status: 'success' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-950 tracking-tight">QR Scanner</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Scan QR codes to record your attendance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Scanner Interface */}
        <Card className="lg:col-span-2 border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="p-8 border-b border-slate-100">
            <CardTitle className="text-xl font-black text-slate-950 tracking-tight flex items-center gap-3">
              <QrCode className="w-6 h-6 text-coop-green" />
              Scanner Interface
            </CardTitle>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Point your camera at the QR code</p>
          </CardHeader>
          <CardContent className="p-8">
            <div className="relative">
              {/* Scanner Area */}
              <div className="aspect-square max-w-md mx-auto bg-slate-900 rounded-3xl overflow-hidden relative">
                {isScanning ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-white">
                      <QrCode className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-bold mb-2">Camera Ready</p>
                      <p className="text-sm opacity-75">Tap start to begin scanning</p>
                    </div>
                  </div>
                )}
                
                {/* Scanning Overlay */}
                {isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-4 border-coop-green rounded-2xl relative">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-coop-yellow rounded-tl-lg"></div>
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-coop-yellow rounded-tr-lg"></div>
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-coop-yellow rounded-bl-lg"></div>
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-coop-yellow rounded-br-lg"></div>
                      
                      {/* Scanning Line Animation */}
                      <div className="absolute inset-x-4 top-1/2 h-0.5 bg-coop-yellow animate-pulse"></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="mt-6 flex justify-center gap-4">
                {!isScanning ? (
                  <Button 
                    onClick={startScanning}
                    className="bg-coop-green hover:bg-coop-darkGreen text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-green-200 hover:shadow-green-300 transition-all duration-300 hover:scale-105"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Start Scanning
                  </Button>
                ) : (
                  <div className="flex gap-4">
                    <Button 
                      onClick={stopScanning}
                      variant="outline"
                      className="border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-600 hover:text-red-600 font-bold px-6 py-4 rounded-2xl"
                    >
                      Stop
                    </Button>
                    <Button 
                      onClick={simulateScan}
                      className="bg-coop-yellow hover:bg-yellow-400 text-slate-900 font-black px-6 py-4 rounded-2xl shadow-lg hover:shadow-yellow-300 transition-all duration-300"
                    >
                      <Zap className="w-5 h-5 mr-2" />
                      Demo Scan
                    </Button>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-red-700 font-bold text-sm">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {scanResult && (
                <div className="mt-4 p-6 bg-green-50 border border-green-200 rounded-2xl">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle2 className="w-6 h-6 text-coop-green" />
                    <h3 className="text-lg font-black text-coop-darkGreen">Attendance Recorded!</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-bold text-slate-700">Event:</span> {scanResult.eventName}</p>
                    <p><span className="font-bold text-slate-700">Time:</span> {new Date(scanResult.timestamp).toLocaleString()}</p>
                    <p><span className="font-bold text-slate-700">Location:</span> {scanResult.location}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Scanner Info & Recent Scans */}
        <div className="space-y-6">
          {/* Scanner Status */}
          <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] p-6 bg-white">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                isScanning ? 'bg-green-50' : 'bg-slate-50'
              }`}>
                <Scan className={`w-8 h-8 ${isScanning ? 'text-coop-green' : 'text-slate-400'}`} />
              </div>
              <h3 className="text-lg font-black text-slate-950 tracking-tight mb-2">Scanner Status</h3>
              <Badge className={`px-4 py-2 rounded-full font-black text-xs ${
                isScanning 
                  ? 'bg-green-50 text-coop-green border-green-200' 
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}>
                {isScanning ? 'Active' : 'Standby'}
              </Badge>
              
              {lastScan && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Last Scan</p>
                  <p className="text-sm font-bold text-slate-950">{lastScan.eventName}</p>
                  <p className="text-xs text-slate-500">{new Date(lastScan.timestamp).toLocaleString()}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Recent Scans */}
          <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="p-6 border-b border-slate-100">
              <CardTitle className="text-lg font-black text-slate-950 tracking-tight flex items-center gap-2">
                <Clock className="w-5 h-5 text-coop-green" />
                Recent Scans
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {recentScans.map((scan) => (
                  <div key={scan.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-coop-green" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-950 truncate">{scan.event}</p>
                        <p className="text-xs text-slate-500 font-bold">{scan.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] p-6 bg-white">
            <h3 className="text-lg font-black text-slate-950 tracking-tight mb-4">How to Scan</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-black text-coop-green">1</span>
                </div>
                <p className="text-slate-600 font-bold">Tap "Start Scanning" to activate camera</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-black text-coop-green">2</span>
                </div>
                <p className="text-slate-600 font-bold">Point camera at the event QR code</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-black text-coop-green">3</span>
                </div>
                <p className="text-slate-600 font-bold">Wait for automatic detection and confirmation</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}