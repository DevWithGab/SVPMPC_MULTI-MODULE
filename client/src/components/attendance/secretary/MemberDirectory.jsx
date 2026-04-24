import React, { useState } from 'react';
import { 
  Users, Search, QrCode, Eye, Download, 
  Filter, Grid, List, Printer
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Modal } from '../../ui/modal';
import { QRCodeSVG } from 'qrcode.react';

export default function MemberDirectory({ user }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // Mock member data - in real app, this would come from API
  const mockMembers = [
    { 
      id: 1, 
      name: 'John Doe', 
      memberId: 'SVMPC-001', 
      email: 'john.doe@example.com',
      phone: '+1-234-567-8901',
      status: 'active',
      joinDate: '2023-01-15',
      lastAttendance: '2024-04-15'
    },
    { 
      id: 2, 
      name: 'Jane Smith', 
      memberId: 'SVMPC-002', 
      email: 'jane.smith@example.com',
      phone: '+1-234-567-8902',
      status: 'active',
      joinDate: '2023-02-20',
      lastAttendance: '2024-04-14'
    },
    { 
      id: 3, 
      name: 'Bob Johnson', 
      memberId: 'SVMPC-003', 
      email: 'bob.johnson@example.com',
      phone: '+1-234-567-8903',
      status: 'active',
      joinDate: '2023-03-10',
      lastAttendance: '2024-04-13'
    },
    { 
      id: 4, 
      name: 'Alice Brown', 
      memberId: 'SVMPC-004', 
      email: 'alice.brown@example.com',
      phone: '+1-234-567-8904',
      status: 'inactive',
      joinDate: '2023-04-05',
      lastAttendance: '2024-03-20'
    },
    { 
      id: 5, 
      name: 'Charlie Wilson', 
      memberId: 'SVMPC-005', 
      email: 'charlie.wilson@example.com',
      phone: '+1-234-567-8905',
      status: 'active',
      joinDate: '2023-05-12',
      lastAttendance: '2024-04-16'
    },
  ];

  // Filter members based on search term and status
  const filteredMembers = mockMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.memberId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || member.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleViewQR = (member) => {
    setSelectedMember(member);
    setShowQRModal(true);
  };

  const handlePrintQR = (member) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${member.name} - QR Code</title>
            <style>
              body { 
                font-family: sans-serif; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                height: 100vh; 
                margin: 0; 
              }
              .card { 
                border: 2px solid #2D7A3E; 
                padding: 40px; 
                border-radius: 20px; 
                text-align: center; 
                max-width: 400px;
              }
              h1 { 
                margin: 0 0 10px 0; 
                color: #2D7A3E; 
                font-size: 24px;
              }
              .member-id { 
                margin: 0 0 20px 0; 
                color: #64748b; 
                font-size: 16px;
              }
              .contact-info {
                margin: 20px 0;
                color: #64748b;
                font-size: 14px;
              }
              .qr-container {
                margin: 20px 0;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>${member.name}</h1>
              <p class="member-id">Member ID: ${member.memberId}</p>
              <div class="qr-container">
                <div id="qr-code"></div>
              </div>
              <div class="contact-info">
                <p>Email: ${member.email}</p>
                <p>Phone: ${member.phone}</p>
                <p>Status: ${member.status.charAt(0).toUpperCase() + member.status.slice(1)}</p>
              </div>
            </div>
            <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
            <script>
              QRCode.toCanvas(document.getElementById('qr-code'), '${member.memberId}', {
                width: 200,
                height: 200,
                color: {
                  dark: '#2D7A3E',
                  light: '#FFFFFF'
                }
              }, function (error) {
                if (error) console.error(error);
                setTimeout(() => window.print(), 1000);
              });
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleExportDirectory = () => {
    const csvContent = [
      ['Name', 'Member ID', 'Email', 'Phone', 'Status', 'Join Date', 'Last Attendance'],
      ...filteredMembers.map(member => [
        member.name,
        member.memberId,
        member.email,
        member.phone,
        member.status,
        member.joinDate,
        member.lastAttendance
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `member-directory-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getStatusColor = (status) => {
    return status === 'active' 
      ? 'text-coop-green bg-green-50 border-green-200'
      : 'text-slate-500 bg-slate-50 border-slate-200';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">Member Directory</h1>
          <p className="text-slate-500 text-sm font-bold mt-1">View member information and QR codes</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleExportDirectory}
            variant="outline"
            className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-bold rounded-xl"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters and View Controls */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-slate-200 rounded-xl"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('all')}
                className="rounded-xl font-bold"
              >
                All
              </Button>
              <Button
                variant={filterStatus === 'active' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('active')}
                className="rounded-xl font-bold"
              >
                Active
              </Button>
              <Button
                variant={filterStatus === 'inactive' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('inactive')}
                className="rounded-xl font-bold"
              >
                Inactive
              </Button>
            </div>
            <div className="flex gap-1 border border-slate-200 rounded-xl p-1">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="rounded-lg"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-lg"
              >
                <Grid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Member Directory */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-50 p-6">
          <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-coop-green" /> 
            Members ({filteredMembers.length})
          </CardTitle>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Member directory and QR codes</p>
        </CardHeader>
        <CardContent className="p-0">
          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Member Details</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Contact Info</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Status</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Last Attendance</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-coop-green rounded-full flex items-center justify-center">
                            <span className="text-sm font-black text-white">{member.name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{member.name}</p>
                            <p className="text-xs text-slate-500 font-bold font-mono">{member.memberId}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{member.email}</p>
                          <p className="text-xs text-slate-500 font-bold">{member.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(member.status)}`}>
                          <div className={`w-2 h-2 rounded-full ${member.status === 'active' ? 'bg-coop-green' : 'bg-slate-400'}`}></div>
                          <span className="capitalize">{member.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <p className="text-sm font-bold text-slate-900">{new Date(member.lastAttendance).toLocaleDateString()}</p>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewQR(member)}
                            className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-xl"
                          >
                            <QrCode className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintQR(member)}
                            className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-xl"
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredMembers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center gap-4">
                          <Users className="w-12 h-12 text-slate-300" />
                          <div>
                            <p className="font-bold text-lg">No members found</p>
                            <p className="text-sm">Try adjusting your search or filter criteria</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMembers.map((member) => (
                <Card key={member.id} className="border-slate-200/60 shadow-sm rounded-2xl overflow-hidden bg-white hover:shadow-lg transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-coop-green rounded-full flex items-center justify-center">
                        <span className="text-lg font-black text-white">{member.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-slate-900">{member.name}</p>
                        <p className="text-xs text-slate-500 font-bold font-mono">{member.memberId}</p>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(member.status)}`}>
                        {member.status}
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <p className="text-xs text-slate-500 font-bold">Email: {member.email}</p>
                      <p className="text-xs text-slate-500 font-bold">Phone: {member.phone}</p>
                      <p className="text-xs text-slate-500 font-bold">Last Attendance: {new Date(member.lastAttendance).toLocaleDateString()}</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewQR(member)}
                        className="flex-1 border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-xl"
                      >
                        <QrCode className="w-4 h-4 mr-1" />
                        View QR
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintQR(member)}
                        className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-xl"
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredMembers.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-400">
                  <div className="flex flex-col items-center gap-4">
                    <Users className="w-12 h-12 text-slate-300" />
                    <div>
                      <p className="font-bold text-lg">No members found</p>
                      <p className="text-sm">Try adjusting your search or filter criteria</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      <Modal isOpen={showQRModal} onClose={() => setShowQRModal(false)}>
        {selectedMember && (
          <div className="p-6 text-center">
            <h2 className="text-2xl font-black text-slate-950 mb-6">Member QR Code</h2>
            
            <div className="mb-6">
              <div className="flex items-center gap-3 justify-center mb-4">
                <div className="w-16 h-16 bg-coop-green rounded-full flex items-center justify-center">
                  <span className="text-2xl font-black text-white">{selectedMember.name.charAt(0)}</span>
                </div>
                <div className="text-left">
                  <p className="text-xl font-black text-slate-900">{selectedMember.name}</p>
                  <p className="text-sm text-slate-500 font-bold font-mono">{selectedMember.memberId}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-inner border border-slate-100 mb-6 inline-block">
              <QRCodeSVG 
                value={selectedMember.memberId} 
                size={200} 
                level="H" 
                fgColor="#2D7A3E" 
              />
            </div>

            <div className="space-y-2 mb-6 text-sm text-slate-600">
              <p><span className="font-bold">Email:</span> {selectedMember.email}</p>
              <p><span className="font-bold">Phone:</span> {selectedMember.phone}</p>
              <p><span className="font-bold">Status:</span> <span className="capitalize">{selectedMember.status}</span></p>
              <p><span className="font-bold">Join Date:</span> {new Date(selectedMember.joinDate).toLocaleDateString()}</p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowQRModal(false)}
                className="flex-1 border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl font-bold"
              >
                Close
              </Button>
              <Button
                onClick={() => handlePrintQR(selectedMember)}
                className="flex-1 bg-coop-green hover:bg-coop-darkGreen text-white rounded-xl font-bold"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print QR Card
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}