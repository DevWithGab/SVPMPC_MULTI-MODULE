import React, { useState } from 'react';
import { DollarSign, Plus, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import Button from '../../shared/ui/Button';
import Input from '../../shared/ui/Input';

export default function ContributionManagement({ user }) {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">Contribution Management</h1>
          <p className="text-slate-500 text-sm font-bold mt-1">Record and manage member contributions</p>
        </div>
        <Button className="bg-coop-green hover:bg-coop-darkGreen text-white font-black px-6 py-3 rounded-2xl">
          <Plus className="w-4 h-4 mr-2" />
          Record Contribution
        </Button>
      </div>

      {/* Search */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardContent className="p-6">
          <Input
            placeholder="Search contributions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={Search}
            className="rounded-xl"
          />
        </CardContent>
      </Card>

      {/* Contributions List */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-50 p-6">
          <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-coop-green" /> 
            Recent Contributions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-12 text-slate-400">
            <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="font-bold text-lg">No contributions found</p>
            <p className="text-sm">Contribution records will appear here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}