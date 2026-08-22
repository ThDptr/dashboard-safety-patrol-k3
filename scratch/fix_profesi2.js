const fs = require('fs');
let lines = fs.readFileSync('app/patroli/[slug]/page.tsx', 'utf8').split('\n');
let replaced = false;

for (let i = 500; i < 520; i++) {
  if (lines[i] && lines[i].includes('? allKeterangan.map(k => `P${k.slot}: ${k.desc}`).join(" ; ")')) {
    lines[i] = lines[i].replace(
      '? allKeterangan.map(k => `P${k.slot}: ${k.desc}`).join(" ; ")',
      '? allKeterangan.map(k => { const d = formatTanggal(k.date); return `P${k.slot} (${d}): ${k.desc}`; }).join(" ; ")'
    );
    // Also inject photos array if it's missing from the return block.
    // The return block ends a few lines later. Let's look for "isProfesi: true"
    for (let j = i; j < i + 10; j++) {
      if (lines[j] && lines[j].includes('isProfesi: true')) {
        if (!lines[j].includes(',')) lines[j] += ',';
        lines.splice(j + 1, 0, '        photos: allPhotos');
        break;
      }
    }
    replaced = true;
    break;
  }
}

if (replaced) {
  fs.writeFileSync('app/patroli/[slug]/page.tsx', lines.join('\n'));
  console.log('Replaced successfully.');
} else {
  console.log('Target string not found.');
}
