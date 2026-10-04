const ExcelJS = require('exceljs');

(async () => {
  const res = await fetch('http://localhost:3004/api/export/excel?slug=apar&bulan=2026-09', {
    cache: 'no-store',
    headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet(1);
  const rows = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    rows.push(row.values.map(v => (v && typeof v === 'object' && v.text !== undefined) ? v.text : v));
  });
  console.log('rowCount=' + rows.length);
  console.log('header=' + JSON.stringify(rows[2]));
  console.log('title=' + JSON.stringify(rows[0]?.[1]));
  console.log('banner=' + JSON.stringify(rows.filter(r => Array.isArray(r) && r.some(v => typeof v === 'string' && v.includes('APAR LUAR GEDUNG'))).slice(0, 5)));
  console.log('sample=' + JSON.stringify(rows.slice(3, 12).map(r => r.slice(0, 12))));
})();
