const ExcelJS = require('exceljs');
(async () => {
  const res = await fetch('http://localhost:3000/api/export/excel?bulan=2026-09&slug=apar');
  console.log('status', res.status, res.headers.get('content-type'));
  const buf = Buffer.from(await res.arrayBuffer());
  require('fs').writeFileSync(__dirname + '/apar_export.xlsx', buf);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  wb.eachSheet(ws => {
    console.log('SHEET', ws.name, 'rows', ws.rowCount);
    const hdr = ws.getRow(2);
    let cPatuh = 0, cTdk = 0, cPct = 0;
    hdr.eachCell((c, i) => {
      const t = String(c.value && c.value.richText ? c.value.richText.map(r => r.text).join('') : c.value);
      if (/Patuh/.test(t) && !/Tdk/.test(t)) cPatuh = i;
      if (/Tdk Patuh/.test(t)) cTdk = i;
      if (/Total %/.test(t)) cPct = i;
    });
    console.log('cols', cPatuh, cTdk, cPct);
    for (let r = 3; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const a = String(row.getCell(1).value ?? '');
      if (/TOTAL KEPATUHAN/.test(a)) {
        const v = c => { const x = row.getCell(c).value; return x && x.richText ? x.richText.map(t => t.text).join('') : x; };
        console.log('FOOTER row', r, { patuh: v(cPatuh), tdk: v(cTdk), pct: v(cPct), totalApar: v(12), q1: v(13), q2: v(14), q3: v(15) });
      }
    }
    // sum per-row patuh/tdk
    let sp = 0, st = 0;
    for (let r = 3; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const p = row.getCell(cPatuh).value, t = row.getCell(cTdk).value;
      if (typeof p === 'number' && typeof t === 'number') { sp += p; st += t; }
    }
    console.log('SUM per-row patuh', sp, 'tdk', st);
  });
})();
