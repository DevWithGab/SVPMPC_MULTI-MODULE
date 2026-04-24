import { motion } from 'framer-motion';
import { Lock, Vote, Fingerprint } from 'lucide-react';
import { FeatureCard, ImageCard } from './ui';

export default function BrandingPanel() {
  const features = [
    { icon: Lock, label: 'Secure' },
    { icon: Vote, label: 'Transparent' },
    { icon: Fingerprint, label: 'Verified' },
  ];

  return (
    <div 
      className="hidden lg:flex lg:w-[55%] bg-coop-green p-12 flex-col justify-between relative overflow-hidden" 
      style={{ 
        backgroundImage: 'url(/images/backgrounds/right-panel-hero-2.png)', 
        backgroundSize: 'cover', 
        backgroundPosition: 'center' 
      }}
    >
      {/* Pattern overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-coop-green/95 via-coop-green/90 to-coop-darkGreen/95" />
      
      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-coop-yellow/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-coop-yellow/10 rounded-full blur-2xl" />
      </div>

      <motion.div 
        className="relative z-10 space-y-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="space-y-4">
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight">
            KONEKTA<br />
            <span className="text-coop-yellow">Connect. Collaborate. Thrive.</span>
          </h2>
          <p className="text-xl text-white/80 max-w-lg leading-relaxed">
            Empowering cooperative communities through seamless digital solutions. 
            Connect with your members, collaborate on initiatives, and thrive together.
          </p>
        </div>

        {/* Features using FeatureCard component */}
        <motion.div 
          className="grid grid-cols-3 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {features.map((feature) => (
            <FeatureCard
              key={feature.label}
              icon={feature.icon}
              label={feature.label}
              variant="glass"
            />
          ))}
        </motion.div>

        {/* Community image using ImageCard component */}
        <ImageCard
          src="/images/backgrounds/right-panel-hero.png"
          alt="Community members voting"
          title="Active Community Participation"
          subtitle="Join 248+ members in shaping our cooperative"
        />
      </motion.div>

      <motion.div 
        className="relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <p className="text-white/50 text-sm">
          © 2024 Saint Vincent Parish Multi-Purpose Cooperative. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
}