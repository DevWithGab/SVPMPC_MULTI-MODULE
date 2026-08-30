import { motion } from 'framer-motion';
import { Lock, Users, Award } from 'lucide-react';
import { FeatureCard, ImageCard } from './ui';

export default function BrandingPanel() {
  const features = [
    { icon: Lock, label: 'Secure', description: 'Your data is protected with enterprise-grade security.' },
    { icon: Users, label: 'Transparent', description: 'Open and accountable systems you can trust.' },
    { icon: Award, label: 'Verified', description: 'All transactions and records are verified and reliable.' },
  ];

  return (
    <div className="hidden lg:flex lg:w-[55%] bg-coop-darkGreen pt-6 px-12 pb-12 flex-col justify-between relative overflow-hidden">
      {/* Background photo texture */}
      <div
        className="absolute inset-0 opacity-35 bg-cover bg-center"
        style={{ backgroundImage: 'url(/images/backgrounds/right-panel-hero-2.png)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-coop-darkGreen/90 via-coop-darkGreen/85 to-black/60" />

      {/* Decorative dot-grid patterns */}
      <div
        className="absolute top-10 right-10 w-40 h-40 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      />
      <div
        className="absolute bottom-10 right-16 w-32 h-32 opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(242,228,22,0.8) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      />

      {/* Decorative glow elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-20 w-72 h-72 bg-coop-yellow/10 rounded-full blur-3xl" />
        <div className="absolute bottom-24 right-20 w-96 h-96 bg-coop-green/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        className="relative z-10 space-y-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="space-y-4">
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight">
            KONEKTA<span className="text-coop-yellow">.</span><br />
            CONNECT. COLLABORATE.<br />
            <span className="text-coop-yellow">THRIVE.</span>
          </h2>
          <div className="w-16 h-1 bg-coop-yellow rounded-full" />
          <p className="text-lg text-white/70 max-w-lg leading-relaxed">
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
              description={feature.description}
              variant="glass"
            />
          ))}
        </motion.div>

        {/* Community image using ImageCard component */}
        <ImageCard
          src="/images/backgrounds/right-panel-hero.png"
          alt="Community members voting"
          title="Active Community Participation"
          subtitle="Join 7,000+ members in shaping our cooperative"
        />
      </motion.div>

      <motion.div
        className="relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <p className="text-white/40 text-sm">
          © 2024 Saint Vincent Parish Multi-Purpose Cooperative. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
}
