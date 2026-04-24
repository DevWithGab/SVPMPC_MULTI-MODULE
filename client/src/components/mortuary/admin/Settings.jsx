import React from 'react';
import { Save, Settings2, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';

const Settings = ({ systemSettings, setSystemSettings, showToast }) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-950 tracking-tight">System Settings</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Configure global parameters and system behavior</p>
        </div>
        <Button 
          className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-lg shadow-emerald-200 w-full sm:w-auto px-8 h-12 rounded-2xl"
          onClick={() => showToast("Settings saved successfully!", "success")}
        >
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl">
                  <Settings2 className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <CardTitle className="text-slate-800 text-lg font-bold">Financial Configuration</CardTitle>
                  <CardDescription>Set targets and contribution benchmarks</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Annual Fund Goal (₱)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      type="number"
                      value={systemSettings.annualGoal}
                      onChange={(e) => setSystemSettings({...systemSettings, annualGoal: Number(e.target.value)})}
                      className="pl-12 h-14 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Monthly Contribution (₱)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      type="number"
                      value={systemSettings.monthlyContribution}
                      onChange={(e) => setSystemSettings({...systemSettings, monthlyContribution: Number(e.target.value)})}
                      className="pl-12 h-14 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
