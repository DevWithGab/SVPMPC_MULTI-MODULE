import { motion as Motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

export default function ModuleSelection({ systems, onSystemSelect }) {
  return (
    <>
    <nav className="selector-topbar" aria-label="KONEKTA information">
      <span className="selector-wordmark">
        <span className="selector-wordmark-name">KONEKTA<span className="selector-wordmark-dot" aria-hidden="true" /></span>
        <span className="selector-wordmark-caption">Cooperative services</span>
      </span>
      <details className="selector-about">
        <summary>About</summary>
        <div className="selector-about-content">
          <h2>About KONEKTA</h2>
          <p>Connect, Collaborate, Thrive</p>
          <p>One connected workspace for Saint Vincent Parish Multi-Purpose Cooperative. Access member records, contributions, benefits, event registration, and attendance through your chosen module.</p>
        </div>
      </details>
    </nav>
    <Motion.div className="module-selection w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <header className="module-selection-heading">
        <h1>Choose a module</h1>
        <p>Select a service to sign in.</p>
      </header>
      <div className="module-selection-options">
        {systems.map((system) => (
          <Motion.button key={system.id} type="button" onClick={() => onSystemSelect(system.id)} className="module-option" whileTap={{ scale: 0.99 }}>
            <span className="module-option-icon"><system.icon aria-hidden="true" /></span>
            <span className="module-option-copy">
              <span className="module-option-title">{system.title}</span>
              <span className="module-option-description">{system.description}</span>
            </span>
            <span className="module-option-arrow"><ChevronRight aria-hidden="true" /></span>
          </Motion.button>
        ))}
      </div>
      <p className="module-selection-help">SVPMPC · KONEKTA</p>
    </Motion.div>
    </>
  );
}
