const fs = require('fs');

const path = 'app/patroli/[slug]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Remove the "perawat" filter from Table A
// The original block:
/*
      // Filter tags: ONLY "perawat" violations reduce the physical room's compliance
      top10 = top10.map(p => {
        let pTags = p.tags ? [...p.tags] : [];
        pTags = pTags.filter(t => t.toLowerCase().includes("perawat"));
        return { ...p, tags: pTags };
      });
*/
code = code.replace(
  /\/\/ Filter tags: ONLY "perawat" violations reduce the physical room's compliance\n\s*top10 = top10\.map\(p => \{\n\s*let pTags = p\.tags \? \[\.\.\.p\.tags\] : \[\];\n\s*pTags = pTags\.filter\(t => t\.toLowerCase\(\)\.includes\("perawat"\)\);\n\s*return \{ \.\.\.p, tags: pTags \};\n\s*\}\);/,
  `// (Filter "perawat" dilepas, sekarang semua profesi mengurangi kepatuhan ruangan)`
);

// 2. Make Table B match softer using includes()
// The original block:
/*
        patrolsInSlot.forEach(p => {
          const matchCount = (p.tags || []).filter((t: string) => t.toLowerCase() === namaProfesi.toLowerCase()).length;
          if (matchCount > 0) {
*/
code = code.replace(
  /const matchCount = \(p\.tags \|\| \[\]\)\.filter\(\(t: string\) => t\.toLowerCase\(\) === namaProfesi\.toLowerCase\(\)\)\.length;/g,
  `const matchCount = (p.tags || []).filter((t: string) => {
            const tLower = t.toLowerCase();
            const npLower = namaProfesi.toLowerCase();
            return tLower.includes(npLower) || npLower.includes(tLower);
          }).length;`
);

fs.writeFileSync(path, code, 'utf8');
console.log('Done script');
