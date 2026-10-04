const ExcelJS = require('exceljs');

(async () => {
  const res = await fetch('http://localhost:3004/api/export/excel?slug=apar&bulan=2026-09', { cache: 'no-store' });
  const buf = Buffer.from(await res.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet(1);
  const rows = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    rows.push(row.values.map(v => (v && typeof v === 'object' && v.text !== undefined) ? v.text : v));
  });
  console.log('rowCount', rows.length);
  console.log('headerRow', JSON.stringify(rows[3]));
  for (let i = 4; i < Math.min(rows.length, 20); i++) {
    console.log('ROW' + i + ':', JSON.stringify(rows[i].slice(0, 20)));
  }
})();
