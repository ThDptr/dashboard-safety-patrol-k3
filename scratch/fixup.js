const fs = require('fs');

let content = fs.readFileSync('app/patroli/[slug]/page.tsx', 'utf8');

// 1. format 2 desimal: replace all .toFixed(0) and Math.round(...) with .toFixed(2) in percentage calculations.
// Wait, we imported fmtPctVal? Let's just do .toFixed(2) directly for simplicity.
// Actually, let's look at how it was done. We used fmtPctVal. But doing .toFixed(2) is identical logic if it's already a number string.
content = content.replace(/\.toFixed\(0\)/g, '.toFixed(2)');
content = content.replace(/Math\.round\(([^)]+)\)/g, '(($1)).toFixed(2)');

// 2. isPerawat fix
const isPerawatOld = `
          if (matchCount > 0) {
            sumViolations += matchCount;
            
            // Build description indicating which room the violation occurred in
            const locationStr = p.location ? \` di \${p.location}\` : "";
            const profStr = \`[Tidak patuh: \${matchCount} \${namaProfesi}]\${locationStr}\`;
            const parts = [profStr];
            if (p.description && p.description !== "-") parts.push(p.description);
            if (p.photoUrl) parts.push(\`📷 \${p.photoUrl}\`);
`;
const isPerawatNew = `
          if (matchCount > 0) {
            // ONLY count if Perawat is the one violating!
            // Wait, this is profesiData, so we check if namaProfesi is 'Perawat'
            // The user rule: "seharusnya jika profesi yang melanggar adalah perawat , barulah mengurangi kepatuhan sebuah ruangan itu .jika selain perawat maka mengurangi kepatuhan profesinya"
            // So if it's profesiData, it DOES reduce profesi compliance. Wait, the rule is about RUANGAN compliance.
            // Oh, so the fix for isPerawat was NOT in profesiData, it was in fisikData!
`;
// Let's implement the isPerawat fix in fisikData correctly!
const fisikDataOld = `
            if (
              (a.label.includes("menggunakan APD") || a.label.includes("Kepatuhan")) &&
              a.jawaban === "Tidak"
            ) {
              return { ...a, jawaban: "Ya" };
            }
`;
const fisikDataNew = `
            if (
              (a.label.includes("menggunakan APD") || a.label.includes("Kepatuhan")) &&
              a.jawaban === "Tidak"
            ) {
              // Jika profesi yang melanggar BUKAN perawat, ruangan TIDAK berkurang kepatuhannya (dianggap Ya)
              const hasPerawatViolation = (p.tags || []).some((t) => t.toLowerCase().includes("perawat"));
              if (!hasPerawatViolation) {
                return { ...a, jawaban: "Ya" };
              }
            }
`;
content = content.replace(fisikDataOld, fisikDataNew);

// 3. Keterangan fix: "P1 (21 Agt 2026): ket"
// Inside buildPatrolKeterangan: remove date and photo logic.
// Then inside maps: construct photos, and change "P\${idx+1}: \${ket}" to "P\${idx+1} (tgl): ket".
// We will do this via a small script replacement logic.

fs.writeFileSync('app/patroli/[slug]/page.tsx', content, 'utf8');
console.log("Applied basic fixes!");
