const fs = require('fs');

let content = fs.readFileSync('app/patroli/[slug]/page.tsx', 'utf8');

content = content.replace(/b3ReportData\.map\(\(row, i\) =>/g, 'b3ReportData.map((row: any, i: number) =>');
content = content.replace(/elektrikReportData\.map\(\(row, i\) =>/g, 'elektrikReportData.map((row: any, i: number) =>');
// Catch any others just in case
content = content.replace(/reportData\.map\(\(row, i\) =>/g, 'reportData.map((row: any, i: number) =>');

fs.writeFileSync('app/patroli/[slug]/page.tsx', content, 'utf8');
console.log("Fixed report data map typing");
