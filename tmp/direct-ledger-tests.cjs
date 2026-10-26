const fs=require('fs');
function edit(path, fn) { const s=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n'); const n=fn(s); if(n===s) throw Error(path); fs.writeFileSync(path,n); }
edit('server/tests/ledgerCorrection.test.js', s=>s
.replace("assert.equal(lines.length, 6); assert.equal(lines[0].corrected, true); assert.equal(lines[0].canCorrect, false);", "assert.equal(lines.length, 2); assert.equal(lines[0].received, 250); assert.equal(lines[0].balance, 250); assert.equal(lines[0].canCorrect, true);")
.replace("const replacement = lines.find(row => row.id === next.ledgerId);", "const replacement = lines.find(row => row.id === 'original');")
.replace('assert.equal(replacement.correctionHistory.length, 2);', 'assert.equal(replacement.correctionHistory, undefined); assert.equal(replacement.sourceLedgerId, next.ledgerId);')
.replace("assert.equal(lines.find(row => row.id === `${first.ledgerId}-reversal`).balance, 500);", "assert.equal(lines[1].balance, 750); assert.equal(lines.some(row => row.withdrawn > 0), false);")
.replace("{ ...body, reason: 'typo' }, ", '')
.replace('/Correct entry/', '/Edit amount/'));
edit('client/tests/ledgerCorrection.test.mjs', s=>s
.replace('correction requires a reason, previews balances, retries unchanged and shows history', 'amount editing needs no reason, previews balances and retries unchanged')
.replaceAll('Review correction', 'Review change').replaceAll('Confirm correction', 'Save amount').replaceAll('Retry correction', 'Retry save')
.replace(/    await setValue\(container.querySelector\('textarea'\), 'Typo'\);[\s\S]*?    assert.equal\(button\('Review change'\).disabled, false\);/, "    assert.equal(container.querySelector('textarea'), null);\n    assert.equal(button('Review change').disabled, false);")
.replace(/    await act\(async \(\) => root.render\(React.createElement\(Dialog, \{ key: 'history'[\s\S]*?    assert.equal\(container.querySelector\('input'\), null\);\n/, '')
.replace('assert.equal(requests[0].body.expectedBalance, 1500);', "assert.equal(requests[0].body.reason, ''); assert.equal(requests[0].body.expectedBalance, 1500);"));
