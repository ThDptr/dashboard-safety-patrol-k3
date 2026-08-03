const fs = require('fs');
const file = 'C:/Kuliah/smester6/KP/dashboard-safety-patrol-k3/dashboard-safety-patrol-k3-main/lib/modules.ts';
let text = fs.readFileSync(file, 'utf8');

// The file might contain literal `n from powershell
text = text.replace(/`n/g, '\n');

try {
  const bytes = Buffer.from(text, 'latin1');
  const fixed = bytes.toString('utf8');
  if (fixed.includes('Dalam Gedung') || fixed.includes('Bulanan')) {
    fs.writeFileSync(file, fixed, 'utf8');
    console.log('Fixed using latin1 conversion!');
  } else {
    fs.writeFileSync(file, text, 'utf8');
    console.log('Did not look like proper fixed output. Wrote newlines only.');
  }
} catch(e) {
  fs.writeFileSync(file, text, 'utf8');
  console.log('Error converting, wrote newlines only.');
}
