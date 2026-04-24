import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import CooperativeLogo from './CooperativeLogo';

export default function RoleSelection({ 
  selectedSystem, 
  systems, 
  roles, 
  onRoleSelect, 
  onBack 
}) {
  const selectedSystemData = systems.find(s => s.id === selectedSystem);

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Back Button */}
      <motion.button
        onClick={onBack}
        className="flex items-center text-slate-600 hover:text-coop-green transition-colors mb-6"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Modules
      </motion.button>

      {/* Professional Logo Branding */}
      <CooperativeLogo icon={selectedSystemData?.icon} />

      {/* Role Selection Subtitle */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <h2 className="text-xl font-bold text-slate-900 mb-2">Select Your Role</h2>
        <p className="text-slate-500 text-sm">Choose how you want to access {selectedSystemData?.title}</p>
      </motion.div>

      {/* Role Cards */}
      <div className="space-y-3">
        {roles.map((role, index) => (
          <motion.button
            key={role.id}
            onClick={() => onRoleSelect(role.id)}
            className="w-full group relative flex items-center gap-6 p-1 border rounded-xl shadow-sm hover:border-coop-green hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden bg-white border-gray-100"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 + (index * 0.08) }}
            whileHover={{ 
              y: -4,
              boxShadow: "0 20px 30px rgba(45, 122, 62, 0.15)"
            }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-16 h-14 flex items-center justify-center group-hover:bg-coop-green group-hover:text-white transition-colors duration-300 rounded-lg ml-1 bg-gray-50">
              <role.icon size={22} strokeWidth={1.5} />
            </div>
            <div className="flex-grow text-left">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black uppercase tracking-tight group-hover:text-coop-green transition-colors text-gray-900">
                  {role.title}
                </span>
              </div>
              <p className="text-[10px] font-medium uppercase tracking-widest mt-0.5 group-hover:text-gray-500 transition-colors text-gray-400">
                {role.description}
              </p>
            </div>
            <div className="pr-6 flex items-center gap-4">
              <span className="text-[9px] font-mono font-bold transition-colors text-gray-200 group-hover:text-coop-green/30">
                {role.code}
              </span>
              <ChevronRight size={16} className="text-gray-200 group-hover:text-coop-green group-hover:translate-x-1 transition-all" />
            </div>
            {/* Subtle Interaction Glow */}
            <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-coop-green group-hover:w-full transition-all duration-500"></div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}