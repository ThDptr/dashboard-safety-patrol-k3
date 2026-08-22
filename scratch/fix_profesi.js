const fs = require('fs');
let content = fs.readFileSync('app/patroli/[slug]/page.tsx', 'utf8');
content = content.replace('let allKeterangan: { slot: number; desc: string, photoUrl?: string | null }[] = [];', 'let allKeterangan: { slot: number; desc: string, photoUrl?: string | null, date?: any }[] = [];');

content = content.replace('let allPetugas: string[] = [];', 'let allPetugas: string[] = [];\n      let allPhotos: any[] = [];');

content = content.replace('if (p.photoUrl) {\n              parts.push(`📷 ${p.photoUrl}`);\n              allPhotos.push({ url: p.photoUrl, label: `P${i}` });\n            }\n            allKeterangan.push({ slot: i, desc: parts.join(" | ") });', 'if (p.photoUrl) {\n              allPhotos.push({ url: p.photoUrl, label: `P${i}` });\n            }\n            allKeterangan.push({ slot: i, desc: parts.join(" | "), date: p.tanggalPemantauan || p.timestamp });');

content = content.replace('keterangan: allKeterangan.length > 0\n          ? allKeterangan.map(k => `P${k.slot}: ${k.desc}`).join(" ; ")\n          : "-",\n        patrols: top10,\n        isProfesi: true', 'keterangan: allKeterangan.length > 0\n          ? allKeterangan.map(k => { const d = formatTanggal(k.date); return `P${k.slot} (${d}): ${k.desc}`; }).join(" ; ")\n          : "-",\n        patrols: top10,\n        isProfesi: true,\n        photos: allPhotos');

fs.writeFileSync('app/patroli/[slug]/page.tsx', content);
console.log('Fixed profesiData logic.');
