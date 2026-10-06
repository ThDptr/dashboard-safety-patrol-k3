const d = JSON.parse(require('fs').readFileSync(__dirname + '/apar_api.json', 'utf8'));
console.log('submissions', d.submissions.length, 'merged', (d.mergedSubmissions || []).length, 'master', d.masterData.length);
console.log('questionResults', d.questionResults.map(q => `${q.label}: ya=${q.countYa} tidak=${q.countTidak} na=${q.countNA} empty=${q.countEmpty}`));

const map = new Map();
d.masterData.forEach(m => {
  if (m.Ruangan) map.set(String(m.Ruangan).trim().toLowerCase(), m);
  if (m.Lokasi) map.set(String(m.Lokasi).trim().toLowerCase(), m);
  if (m['Area Luar']) map.set(String(m['Area Luar']).trim().toLowerCase(), m);
});
const int = v => parseInt(v, 10) || 0;
const ex = (s, l) => int(s.extras?.find(e => e.label === l || e.label.includes(l))?.value);

let dalamTotal = 0, dalamPatuh = 0, dalamExp = 0, noMaster = [], naRows = [];
const perQ = {};
d.submissions.forEach(s => {
  const m = map.get(String(s.location).trim().toLowerCase());
  let tot = m ? int(m['Jumlah APAR Powder']) + int(m['Jumlah APAR CO2']) : 0;
  if (!m) noMaster.push(s.location);
  if (tot === 0) tot = ex(s, 'Jumlah APAR Powder') + ex(s, 'Jumlah APAR CO2');
  dalamTotal += tot;
  d.questionResults.forEach((q, i) => {
    const a = s.answers.find(x => x.sheetHeader === q.sheetHeader)?.jawaban ?? '';
    if (a === 'N/A' || a === '') { naRows.push(`${s.location} | Q${i} = "${a}" (tot=${tot})`); return; }
    dalamExp += tot;
    perQ[q.label] = perQ[q.label] || { ya: 0, tidak: 0 };
    if (a === 'Ya') { dalamPatuh += tot; perQ[q.label].ya += tot; }
    else if (a === 'Tidak') {
      let nc = tot; const desc = s.description || '';
      const re = q.label.includes('Terjangkau') ? /TJ\s*[:=]\s*(\d+)/i : q.label.includes('Rambu') ? /RS\s*[:=]\s*(\d+)/i : q.label.includes('Kartu') ? /KP\s*[:=]\s*(\d+)/i : null;
      const mm = re && desc.match(re); if (mm) nc = parseInt(mm[1]);
      dalamPatuh += Math.max(0, tot - nc); perQ[q.label].ya += Math.max(0, tot - nc); perQ[q.label].tidak += tot - Math.max(0, tot - nc);
    }
  });
});
console.log('\nDALAM: sum total APAR', dalamTotal, 'patuh', dalamPatuh, 'expected', dalamExp);
console.log('Dalam rows w/o master:', noMaster);
console.log('Dalam N/A or empty answers:', naRows.length, naRows.slice(0, 40));

let luarTotal = 0, luarPatuh = 0, luarExp = 0, luarNa = [];
(d.mergedSubmissions || []).forEach(s => {
  const m = map.get(String(s.location).trim().toLowerCase());
  let tot = m ? int(m['Jumlah APAR Powder 6 kg']) + int(m['Jumlah APAR Powder 25 kg']) + int(m['Jumlah APAR CO2']) : 0;
  if (tot === 0) tot = ex(s, 'Jumlah APAR Powder') + int(s.extras.find(e => e.label === 'Jumlah APAR Powder 25 kg')?.value) + ex(s, 'Jumlah APAR CO2');
  luarTotal += tot;
  console.log('LUAR', s.location, 'master?', !!m, 'tot', tot, 'answers', s.answers.map(a => a.jawaban).join(','));
  d.questionResults.forEach((q, i) => {
    const a = s.answers.find(x => x.label === q.label)?.jawaban ?? '';
    if (a === 'N/A' || a === '') { luarNa.push(`${s.location} Q${i}="${a}"`); return; }
    luarExp += tot;
    if (a === 'Ya') luarPatuh += tot;
  });
});
console.log('\nLUAR: sum total', luarTotal, 'patuh', luarPatuh, 'expected', luarExp, 'na', luarNa);
console.log('\nGRAND expected', dalamExp + luarExp, 'patuh', dalamPatuh + luarPatuh);
console.log('Seharusnya (Total APAR x 3) =', (dalamTotal + luarTotal) * 3);
