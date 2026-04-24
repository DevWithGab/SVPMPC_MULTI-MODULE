import React from 'react';
import { 
  FileText, Download, Eye, Upload, Calendar, 
  Shield, Award, CreditCard, User, Search 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';

export default function Documents() {
  const documents = [
    {
      id: 1,
      name: 'Membership Certificate',
      type: 'Certificate',
      date: '2023-01-15',
      size: '2.4 MB',
      status: 'Available',
      icon: Award,
      color: 'text-coop-green',
      bg: 'bg-green-50'
    },
    {
      id: 2,
      name: 'Contribution Summary 2024',
      type: 'Report',
      date: '2024-01-01',
      size: '1.8 MB',
      status: 'Available',
      icon: CreditCard,
      color: 'text-coop-green',
      bg: 'bg-green-50'
    },
    {
      id: 3,
      name: 'Member Profile Document',
      type: 'Profile',
      date: '2023-01-15',
      size: '856 KB',
      status: 'Available',
      icon: User,
      color: 'text-coop-green',
      bg: 'bg-green-50'
    },
    {
      id: 4,
      name: 'Insurance Policy Details',
      type: 'Policy',
      date: '2023-02-01',
      size: '3.2 MB',
      status: 'Available',
      icon: Shield,
      color: 'text-coop-green',
      bg: 'bg-green-50'
    }
  ];

  const documentCategories = [
    { name: 'Certificates', count: 1, icon: Award, color: 'text-coop-green' },
    { name: 'Reports', count: 1, icon: FileText, color: 'text-coop-yellow' },
    { name: 'Policies', count: 1, icon: Shield, color: 'text-coop-green' },
    { name: 'Personal', count: 1, icon: User, color: 'text-slate-600' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-950 tracking-tight">My Documents</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Access and manage your important documents</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search documents..."
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-coop-green focus:border-transparent"
            />
          </div>
          <Button className="bg-coop-green hover:bg-coop-darkGreen text-white font-black px-6 py-2 rounded-xl">
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>

      {/* Document Categories */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {documentCategories.map((category) => (
          <Card key={category.name} className="p-6 border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] bg-white group hover:border-green-200 transition-all cursor-pointer">
            <div className="text-center">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:bg-green-50 transition-colors">
                <category.icon className={`w-6 h-6 ${category.color} group-hover:text-coop-green`} />
              </div>
              <h3 className="text-sm font-black text-slate-950 tracking-tight mb-1">{category.name}</h3>
              <p className="text-xs text-slate-500 font-bold">{category.count} document{category.count !== 1 ? 's' : ''}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] bg-white group hover:border-green-200 transition-all cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center group-hover:bg-green-100 transition-colors">
              <Award className="w-6 h-6 text-coop-green" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-black text-slate-950 tracking-tight">Membership Certificate</h3>
              <p className="text-xs text-slate-500 font-bold mt-1">Download your official certificate</p>
            </div>
            <Button variant="outline" size="sm" className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        <Card className="p-6 border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] bg-white group hover:border-green-200 transition-all cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center group-hover:bg-yellow-100 transition-colors">
              <FileText className="w-6 h-6 text-coop-yellow" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-black text-slate-950 tracking-tight">Annual Report</h3>
              <p className="text-xs text-slate-500 font-bold mt-1">View your yearly summary</p>
            </div>
            <Button variant="outline" size="sm" className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green">
              <Eye className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        <Card className="p-6 border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] bg-white group hover:border-green-200 transition-all cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center group-hover:bg-green-100 transition-colors">
              <Shield className="w-6 h-6 text-coop-green" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-black text-slate-950 tracking-tight">Policy Documents</h3>
              <p className="text-xs text-slate-500 font-bold mt-1">Access insurance policies</p>
            </div>
            <Button variant="outline" size="sm" className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Documents List */}
      <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="p-8 border-b border-slate-100">
          <CardTitle className="text-xl font-black text-slate-950 tracking-tight">All Documents</CardTitle>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Complete document library</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <div key={doc.id} className="p-6 hover:bg-slate-50/50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${doc.bg} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <doc.icon className={`w-6 h-6 ${doc.color}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-slate-950 tracking-tight truncate">{doc.name}</h3>
                    <div className="flex items-center gap-4 mt-1">
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-widest">
                        {doc.type}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-slate-500 font-bold">
                        <Calendar className="w-3 h-3" />
                        {new Date(doc.date).toLocaleDateString()}
                      </div>
                      <span className="text-xs text-slate-500 font-bold">{doc.size}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-50 text-coop-green border-green-200 px-3 py-1 rounded-full font-black text-xs">
                      {doc.status}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green p-2">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green p-2">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] p-8 bg-white">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-black text-slate-950 tracking-tight mb-2">Upload Documents</h3>
          <p className="text-slate-500 text-sm font-bold mb-6">Drag and drop files here or click to browse</p>
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 hover:border-coop-green hover:bg-green-50/50 transition-all cursor-pointer group">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center group-hover:bg-green-100 transition-colors">
                <Upload className="w-6 h-6 text-slate-400 group-hover:text-coop-green" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-950 mb-1">Choose files to upload</p>
                <p className="text-xs text-slate-500 font-bold">PDF, DOC, JPG up to 10MB</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}