import { Database } from 'lucide-react';

export default function TerminalFooter() {
  return (
    <div className="mt-auto pt-12 w-full flex flex-col items-center">
      <div className="flex items-center gap-4 text-gray-300">
        <Database size={14} />
        <span className="text-[10px] font-mono font-bold tracking-widest uppercase">
          Saint Vincent Registry Authority Database
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 opacity-30">
        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
        <span className="text-[8px] font-mono text-gray-400">
          Dupax del Sur, Nueva Vizcaya
        </span>
      </div>
    </div>
  );
}