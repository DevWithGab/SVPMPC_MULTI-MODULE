export default function TerminalFooter({ compact = false }) {
  return (
    <footer className="selector-terminal-footer">
      <p>© 2026 SVPMPC</p>
      {!compact && <p>Saint Vincent Parish Multi-Purpose Cooperative</p>}
    </footer>
  );
}
