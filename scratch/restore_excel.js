const fs = require('fs');
const original = fs.readFileSync('scratch/original_page.tsx', 'utf-8');
const current = fs.readFileSync('app/patroli/[slug]/page.tsx', 'utf-8');

// The chunk we accidentally deleted was between:
// "          sheet.addRow(rowData);"
// "        });"
// and:
// "      const buffer = await workbook.xlsx.writeBuffer();"

const origMatch = original.match(/(\/\/ Append summary rows[\s\S]*?)(const buffer = await workbook\.xlsx\.writeBuffer\(\);)/);

if (!origMatch) {
  console.log("Could not find original chunk!");
  process.exit(1);
}

const deletedChunk = origMatch[1];
console.log("Found deleted chunk of length " + deletedChunk.length);

// In current file, we have:
// "        // [Logic for B3 Excel similar to current structure]"
// "      } else if (type === 'harian') {"
// "        // [Logic for Harian Excel similar to current structure]"
// "      }"

const currentMatch = current.match(/\/\/ \[Logic for B3 Excel similar to current structure\][\s\S]*?\/\/ \[Logic for Harian Excel similar to current structure\]\s*\}\s*/);

if (!currentMatch) {
  console.log("Could not find current placeholder chunk!");
  process.exit(1);
}

const restored = current.replace(currentMatch[0], deletedChunk);
fs.writeFileSync('app/patroli/[slug]/page.tsx', restored, 'utf-8');
console.log("Restored successfully!");
