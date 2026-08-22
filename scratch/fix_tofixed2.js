const fs = require('fs');
let content = fs.readFileSync('app/patroli/[slug]/page.tsx', 'utf8');

// The issue is: (((A / B).toFixed(2)) * 100)
// This is exactly: \(\(\(([^)]+)\)\.toFixed\(2\)\)\s*\*\s*100\)
content = content.replace(/\(\(\(([^)]+\))\.toFixed\(2\)\)\s*\*\s*100\)/g, 'Number((($1) * 100).toFixed(2))');

content = content.replace(/\(\(\(\(([^)]+\))\)\.toFixed\(2\)\)\s*\*\s*100\)/g, 'Number((($1) * 100).toFixed(2))');
content = content.replace(/\(\(\(\(([^)]+)\)\.toFixed\(2\)\)\s*\*\s*100\)/g, 'Number((($1) * 100).toFixed(2))');

// Catch any .toFixed(2)) * 100
content = content.replace(/\.toFixed\(2\)\)\s*\*\s*100/g, ' * 100).toFixed(2)');

// Catch line 3417: (((ya / (ya + tidak)).toFixed(2)) * 100)
content = content.replace(/\(\(\(ya \/ \(ya \+ tidak\)\)\.toFixed\(2\)\)\s*\*\s*100\)/g, 'Number(((ya / (ya + tidak)) * 100).toFixed(2))');

// Catch line 2775: (((sumCompliant / (sumCompliant + sumNonCompliant)).toFixed(2)) * 100)
content = content.replace(/\(\(\(sumCompliant \/ \(sumCompliant \+ sumNonCompliant\)\)\.toFixed\(2\)\)\s*\*\s*100\)/g, 'Number(((sumCompliant / (sumCompliant + sumNonCompliant)) * 100).toFixed(2))');

// Catch line 2781
content = content.replace(/\(\(\(sumNonCompliant \/ \(sumCompliant \+ sumNonCompliant\)\)\.toFixed\(2\)\)\s*\*\s*100\)/g, 'Number(((sumNonCompliant / (sumCompliant + sumNonCompliant)) * 100).toFixed(2))');

fs.writeFileSync('app/patroli/[slug]/page.tsx', content, 'utf8');
console.log("Fixed remaining toFixed errors");
