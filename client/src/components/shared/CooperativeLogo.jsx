import { motion } from 'framer-motion';

export default function CooperativeLogo({ icon: IconComponent, showLogo = false }) {
  return (
    <motion.div 
      className="mb-12 flex flex-col items-center"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
    >
      <motion.div 
        className="w-24 h-24 bg-white rounded-2xl border border-gray-100 shadow-2xl flex items-center justify-center mb-6 relative group transition-all hover:scale-105"
        whileHover={{ scale: 1.05 }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-coop-darkGreen/5 to-transparent rounded-2xl"></div>
        {showLogo ? (
          <img src="/SVPMPC-LOGO(MAIN).png" alt="Saint Vincent Cooperative" className="w-20 h-20 object-contain" />
        ) : IconComponent ? (
          <IconComponent className="w-12 h-12 text-coop-green" />
        ) : null}
      </motion.div>
      <div className="text-center">
        <motion.h1 
          className="text-2xl font-black tracking-tight uppercase leading-none text-gray-900"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Saint Vincent Cooperative
        </motion.h1>
        <motion.p 
          className="text-[10px] font-mono font-bold text-gray-400 mt-2 uppercase tracking-[0.3em]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          Registry Authority • Central Portal
        </motion.p>
      </div>
    </motion.div>
  );
}