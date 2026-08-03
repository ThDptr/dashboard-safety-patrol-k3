const fs = require('fs');
const file = 'C:/Kuliah/smester6/KP/dashboard-safety-patrol-k3/dashboard-safety-patrol-k3-main/lib/modules.ts';
let text = fs.readFileSync(file, 'utf8');

const icons = {
  'peralatan-kerja': '🔧',
  'peralatan-medik': '💉',
  'apar': '🧯',
  'hydrant': '🚒',
  'sarana-proteksi': '🔥',
  'rambu': '🪧',
  'elektrik': '⚡',
  'jalur-evakuasi': '🚪',
  'kebersihan-sarana': '🧹',
  'risiko-kecelakaan': '⚠️',
  'apd': '🦺',
  'sampah': '🗑️',
  'code-red': '🚨',
  'sosialisasi': '🗣️',
  'pcra': '🚧',
  'luar-gedung': '🌳',
  'b3': '☣️'
};

for (const slug in icons) {
  const regex = new RegExp('slug: \\"' + slug + '\\",[\\s\\S]*?title: \\".*?\\",[\\s\\S]*?icon: \\".*?\\"');
  text = text.replace(regex, (match) => {
    return match.replace(/icon: \".*?\"/, 'icon: \"' + icons[slug] + '\"');
  });
}

// Fix dashes and group titles
text = text.replace(/Dalam Gedung \ufffd.*?Bulanan/g, 'Dalam Gedung — Bulanan');
text = text.replace(/Dalam Gedung \ufffd.*?Harian/g, 'Dalam Gedung — Harian');
text = text.replace(/Dalam Gedung [^\w\s]+ Bulanan/g, 'Dalam Gedung — Bulanan');
text = text.replace(/Dalam Gedung [^\w\s]+ Harian/g, 'Dalam Gedung — Harian');
text = text.replace(/Dalam Gedung(.*?)Bulanan/g, 'Dalam Gedung — Bulanan');
text = text.replace(/Dalam Gedung(.*?)Harian/g, 'Dalam Gedung — Harian');
// Fix the weird line dividers
text = text.replace(/[^\x00-\x7F]+/g, (match) => {
  if (match.length > 50) return '─────────────────────────────────────────────────────────────────────────────';
  return match;
});

fs.writeFileSync(file, text, 'utf8');
console.log('Fixed icons and dashes!');
