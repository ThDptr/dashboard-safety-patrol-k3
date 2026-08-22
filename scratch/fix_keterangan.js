const fs = require('fs');
let content = fs.readFileSync('app/patroli/[slug]/page.tsx', 'utf8');

// 1. Remove photo logic from buildPatrolKeterangan
const photoLogicRegex = /\/\/ 3\. Photo URL[\s\S]*?(?=return parts\.length)/;
content = content.replace(photoLogicRegex, '');

// 2. Add dates to all the Keterangan mappings
// We will replace `return ket ? \`P${idx + 1}: ${ket}\` : null;`
content = content.replace(/return ket \? `P\$\{idx \+ 1\}: \$\{ket\}` : null;/g, "const d = formatTanggal(p.tanggalPemantauan || p.timestamp);\n          return ket ? `P${idx + 1} (${d}): ${ket}` : null;");
// and for B3: `return ket ? \`P\${idx + 1}: \${ket}\` : null;` wait, B3 uses `const k = buildPatrolKeterangan`!
content = content.replace(/return k \? `P\$\{i \+ 1\}: \$\{k\}` : null;/g, "const d = formatTanggal(p.tanggalPemantauan || p.timestamp);\n          return k ? `P${i + 1} (${d}): ${k}` : null;");

fs.writeFileSync('app/patroli/[slug]/page.tsx', content);
console.log('Fixed Keterangan logic.');
