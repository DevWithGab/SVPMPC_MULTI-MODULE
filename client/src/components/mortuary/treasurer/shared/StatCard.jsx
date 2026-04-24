import React from 'react';
import { Card } from '../../../ui/card';

const StatCard = ({ title, value, icon: Icon, color = "emerald" }) => {
  const colors = {
    emerald: "text-coop-green bg-green-50 border-green-100",
    blue: "text-blue-700 bg-blue-50 border-blue-100",
    amber: "text-amber-700 bg-amber-50 border-amber-100",
    rose: "text-rose-700 bg-rose-50 border-rose-100",
    slate: "text-slate-700 bg-slate-50 border-slate-100",
  };
  const selectedColor = colors[color] || colors.emerald;

  return (
    <Card className="p-8 border-slate-200/60 bg-white shadow-lg rounded-[2.5rem] group hover:shadow-2xl hover:shadow-slate-100 transition-all transform hover:-translate-y-1 overflow-hidden relative border">
      <div className={`absolute top-0 right-0 w-32 h-32 blur-[4.5rem] -mr-12 -mt-12 opacity-30 ${selectedColor.split(' ')[1]} transition-opacity group-hover:opacity-50`} />
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">{title}</p>
          <div className="flex items-baseline gap-1">
            <p className="text-4xl font-black text-slate-950 tracking-tighter leading-none">{value}</p>
          </div>
        </div>
        <div className={`p-4 rounded-2xl border ${selectedColor} shadow-inner transition-all duration-500 group-hover:rotate-6 group-hover:scale-110`}>
          <Icon className="w-7 h-7" />
        </div>
      </div>
    </Card>
  );
};

export default StatCard;