export default function BrandingPanel() {
  return (
    <aside className="selector-branding" aria-label="About Saint Vincent Parish Multi-Purpose Cooperative">
      <img className="selector-branding-photo" src="/images/backgrounds/building-coop.png" alt="Saint Vincent Parish Multi-Purpose Cooperative building" />
      <div className="selector-branding-tint" aria-hidden="true" />
      <div className="selector-branding-identity">
        <span className="selector-branding-logo"><img src="/SVPMPC-LOGO(MAIN).png" alt="SVPMPC" /></span>
        <div><p>SVPMPC</p><span>Saint Vincent Parish<br />Multi-Purpose Cooperative</span></div>
      </div>
      <div className="selector-branding-caption">
        <h2><span>Connect,</span> <span>Collaborate,</span> <span className="selector-branding-thrive">Thrive</span></h2>
        <hr className="selector-branding-divider" aria-hidden="true" />
        <p className="selector-branding-tagline">One community. One connected workspace.</p>
        <p className="selector-branding-copyright">© 2026 Saint Vincent Parish Multi-Purpose Cooperative. All rights reserved.</p>
      </div>
    </aside>
  );
}
