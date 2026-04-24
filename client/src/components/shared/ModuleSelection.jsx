import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import CooperativeLogo from './CooperativeLogo';

export default function ModuleSelection({ systems, onSystemSelect }) {
  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <CooperativeLogo showLogo={true} />

      <motion.div
        className="text-center space-y-4 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Select Module</h2>
        <p className="text-slate-500 mb-8">Choose a system to access your cooperative services.</p>
      </motion.div>

      {/* System Cards */}
      <div className="space-y-4">
        {systems.map((system, index) => (
          <motion.button
            key={system.id}
            onClick={() => onSystemSelect(system.id)}
            className="w-full bg-white border border-slate-200 p-5 rounded-xl hover:border-coop-green hover:ring-1 hover:ring-coop-green transition-all text-left flex items-center group shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-12 h-12 bg-coop-green/10 rounded-lg flex items-center justify-center mr-4 text-coop-green group-hover:bg-coop-green group-hover:text-white transition-all">
              <system.icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-slate-900">{system.title}</h3>
              <p className="text-sm text-slate-500">{system.description}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-coop-green transition-colors" />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}