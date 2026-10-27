import { motion as Motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function ModuleSelection({ systems, onSystemSelect }) {
  return (
    <Motion.div className="module-selection w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <header className="module-selection-heading">
        <p className="module-selection-eyebrow">Welcome to KONEKTA</p>
        <h1>Where would you like to work?</h1>
        <p>Choose a module to continue.</p>
      </header>
      <div className="module-selection-options">
        {systems.map((system) => (
          <Motion.button key={system.id} type="button" onClick={() => onSystemSelect(system.id)} className="module-option" whileTap={{ scale: 0.99 }}>
            <span className="module-option-icon"><system.icon aria-hidden="true" /></span>
            <span className="module-option-copy">
              <span className="module-option-title">{system.title}</span>
              <span className="module-option-description">{system.description}</span>
            </span>
            <span className="module-option-arrow"><ArrowRight aria-hidden="true" /></span>
          </Motion.button>
        ))}
      </div>
      <p className="module-selection-help">Continue to your module’s sign-in options.</p>
    </Motion.div>
  );
}
