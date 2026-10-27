import { useEffect, useState } from 'react';
import { Lock, Users, Award } from 'lucide-react';
import { authAPI } from '../../services/api';

export default function BrandingPanel() {
  const [memberCount, setMemberCount] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    authAPI.getCommunityStats(controller.signal)
      .then(({ totalMembers }) => {
        if (!controller.signal.aborted && Number.isSafeInteger(totalMembers) && totalMembers >= 0) {
          setMemberCount(totalMembers);
        }
      })
      .catch(() => { /* Keep the general community message if unavailable. */ });
    return () => controller.abort();
  }, []);

  const communitySubtitle = memberCount === null
    ? 'Join our members in shaping our cooperative'
    : `Join ${memberCount.toLocaleString('en-PH')} ${memberCount === 1 ? 'member' : 'members'} in shaping our cooperative`;

  const features = [
    { icon: Lock, label: 'Secure', description: 'Your data is protected with enterprise-grade security.' },
    { icon: Users, label: 'Transparent', description: 'Open and accountable systems you can trust.' },
    { icon: Award, label: 'Verified', description: 'All transactions and records are verified and reliable.' },
  ];

  return (
    <aside className="selector-branding" aria-label="About Saint Vincent Parish Multi-Purpose Cooperative">
      <img className="selector-branding-photo" src="/images/backgrounds/right-panel-hero.png" alt="Cooperative members at the community registration table" />
      <div className="selector-branding-tint" aria-hidden="true" />
      <div className="selector-branding-identity">
        <span className="selector-branding-logo"><img src="/SVPMPC-LOGO(MAIN).png" alt="SVPMPC" /></span>
        <div><p>SVPMPC</p><span>Saint Vincent Parish<br />Multi-Purpose Cooperative</span></div>
      </div>
      <div className="selector-branding-caption">
        <h2>KONEKTA</h2>
        <p className="selector-branding-tagline">Connected in service.</p>
        <details className="selector-branding-about">
          <summary>About KONEKTA</summary>
          <div className="selector-branding-details">
            <p className="selector-branding-motto">Connect. Collaborate. Thrive.</p>
            <p>Empowering cooperative communities through seamless digital solutions. Connect with your members, collaborate on initiatives, and thrive together.</p>
            <ul>{features.map((feature) => (
              <li key={feature.label}><feature.icon size={16} aria-hidden="true" /><span><strong>{feature.label}</strong> — {feature.description}</span></li>
            ))}</ul>
            <p><strong>Active Community Participation</strong><br />{communitySubtitle}</p>
          </div>
        </details>
        <p className="selector-branding-copyright">© 2026 Saint Vincent Parish Multi-Purpose Cooperative. All rights reserved.</p>
      </div>
    </aside>
  );
}
