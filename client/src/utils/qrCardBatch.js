// Load a bounded number of cards per request rather than one PNG request per
// member. The server checks current issuance and eligibility for every batch.
export async function prepareQrCards(members, loadCards) {
  const entries = [];
  for (let offset = 0; offset < members.length; offset += 100) {
    const batch = members.slice(offset, offset + 100);
    const { cards } = await loadCards(batch.map(member => member.memberId));
    const byId = new Map(cards.map(card => [card.memberId, card]));
    for (const member of batch) {
      const card = byId.get(member.memberId);
      if (!card) throw new Error('QR card unavailable');
      const size = card.rows?.length;
      if (!Number.isInteger(size) || size < 21 || size > 177 || (size - 21) % 4 ||
          !card.rows.every(row => typeof row === 'string' && row.length === size && /^[01]+$/.test(row))) {
        throw new Error('Invalid QR matrix');
      }
      const path = [];
      card.rows.forEach((row, y) => {
        for (let x = 0; x < size; x++) {
          if (row[x] !== '1') continue;
          let end = x + 1;
          while (end < size && row[end] === '1') end++;
          path.push(`M${x + 1} ${y + 1}h${end - x}v1H${x + 1}z`);
          x = end - 1;
        }
      });
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 ${size + 2} ${size + 2}" shape-rendering="crispEdges"><path fill="white" d="M0 0h${size + 2}v${size + 2}H0z"/><path d="${path.join('')}"/></svg>`;
      entries.push({
        member: { ...member, name: card.memberName, barangay: card.barangay, status: card.status, joinDate: card.joinDate },
        qrUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        qr: { rows: card.rows.map(row => Array.from(row, cell => cell === '1')), imageWidth: size + 2, offsetPx: 1, modulePx: 1 },
      });
    }
  }
  return entries;
}
