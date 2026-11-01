// Extend controller fakes with Mongoose's sorted-query shape and the ledger
// indexes used by the shared posting service. Existing failure hooks still run.
function postingLedger(Ledger, rows, initialBalance = () => 0) {
  const getRows = typeof rows === 'function' ? rows : () => rows;
  const findOne = Ledger.findOne?.bind(Ledger);
  Ledger.findOne = query => {
    if (Object.keys(query).length === 1 && query.memberId) {
      const found = getRows().filter(row => row.memberId === query.memberId);
      if (!found.length && initialBalance(query.memberId)) found.push({
        ledgerId: `fixture-opening:${query.memberId}`, memberId: query.memberId,
        balance: initialBalance(query.memberId), createdAt: new Date(0),
      });
      return {
        then: (resolve, reject) => Promise.resolve(found[0] || null).then(resolve, reject),
        sort: async order => [...found].sort((a, b) => order.createdAt *
          ((new Date(a.createdAt || 0) - new Date(b.createdAt || 0)) || getRows().indexOf(a) - getRows().indexOf(b)))[0] || null,
      };
    }
    return findOne ? findOne(query) : Promise.resolve(getRows().find(row => row.ledgerId === query.ledgerId) || null);
  };
  const save = Ledger.prototype.save;
  Ledger.prototype.save = async function () {
    const duplicateId = getRows().some(row => row.ledgerId === this.ledgerId);
    const duplicateParent = this.postingParent && getRows().some(row => row.memberId === this.memberId && row.postingParent === this.postingParent);
    if (duplicateId || duplicateParent) throw Object.assign(new Error('Duplicate posting'), {
      code: 11000, keyPattern: duplicateId ? { ledgerId: 1 } : { memberId: 1, postingParent: 1 },
    });
    return save.call(this);
  };
  return Ledger;
}
module.exports = { postingLedger };
