const fs = require('fs');

const path = 'app/patroli/[slug]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add photoPopup state
if (!code.includes('const [photoPopup, setPhotoPopup]')) {
  code = code.replace(
    /const \[keteranganPopup, setKeteranganPopup\] = useState<string \| null>\(null\);/,
    'const [keteranganPopup, setKeteranganPopup] = useState<string | null>(null);\n  const [photoPopup, setPhotoPopup] = useState<string | null>(null);'
  );
}

// 2. Add photoPopup modal
if (!code.includes('── Foto Popup Modal ──')) {
  code = code.replace(
    /\{\/\* ── Keterangan Popup Modal ── \*\/\}/,
    `{/* ── Foto Popup Modal ── */}
      {photoPopup && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPhotoPopup(null)}
        >
          <div className="relative max-w-4xl w-full flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPhotoPopup(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-3xl font-bold"
            >
              ×
            </button>
            <img src={photoPopup} alt="Foto Temuan" className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border-4 border-white/10" />
          </div>
        </div>
      )}

      {/* ── Keterangan Popup Modal ── */}`
  );
}

// 3. APD isProfesi: false photos
code = code.replace(
  /return \{\n\s*ruangan,\n\s*jumlahKaryawan,\n\s*tanggal,\n\s*namaPetugas,\n\s*keterangan,\n\s*patrols: top10,\n\s*isProfesi: false\n\s*\};/g,
  `const photos = top10
        .map((p, idx) => {
          if (p.photoUrl && p.photoUrl.trim() !== "" && p.photoUrl !== "-") {
            return { url: p.photoUrl, label: \`P\${idx + 1}\` };
          }
          return null;
        })
        .filter(Boolean);

      return {
        ruangan,
        jumlahKaryawan,
        tanggal,
        namaPetugas,
        keterangan,
        photos,
        patrols: top10,
        isProfesi: false
      };`
);

// 4. APD isProfesi: true photos
code = code.replace(
  /let allKeterangan: \{ slot: number; desc: string; date\?: string \}\[\] = \[\];/g,
  `let allKeterangan: { slot: number; desc: string; date?: string }[] = [];
      let allPhotos: { url: string; label: string }[] = [];`
);

code = code.replace(
  /if \(p\.photoUrl\) \{\n\s*parts\.push\(`📷 \$\{p\.photoUrl\}`\);\n\s*allPhotos\.push\(\{ url: p\.photoUrl, label: `P\$\{i\}` \}\);\n\s*\}/g,
  `if (p.photoUrl) {
              parts.push(\`📷 \${p.photoUrl}\`);
              allPhotos.push({ url: p.photoUrl, label: \`P\${i}\` });
            }`
);
if (!code.includes('allPhotos.push({ url: p.photoUrl')) {
  code = code.replace(
    /if \(p\.photoUrl\) parts\.push\(`📷 \$\{p\.photoUrl\}`\);/g,
    `if (p.photoUrl) {
              parts.push(\`📷 \${p.photoUrl}\`);
              allPhotos.push({ url: p.photoUrl, label: \`P\${i}\` });
            }`
  );
}

code = code.replace(
  /isProfesi: true\n\s*\};/g,
  `isProfesi: true,
        photos: allPhotos
      };`
);

// 5. B3 photos
code = code.replace(
  /return \{\n\s*ruangan,\n\s*seharusnyaLemari,\n\s*terlihatLemari,\n\s*eyewasher,\n\s*bodywasher,\n\s*keteranganA,\n\s*keteranganC,\n\s*patrols: top2,\n\s*\};/g,
  `const photos = top2
        .map((p, idx) => {
          if (p.photoUrl && p.photoUrl.trim() !== "" && p.photoUrl !== "-") {
            return { url: p.photoUrl, label: \`P\${idx + 1}\` };
          }
          return null;
        })
        .filter(Boolean);

      return {
        ruangan,
        seharusnyaLemari,
        terlihatLemari,
        eyewasher,
        bodywasher,
        keteranganA,
        keteranganC,
        photos,
        patrols: top2,
      };`
);

// 6. Fix headers
const thKeterangan = '<th className="w-48">Keterangan</th>';
const thKeteranganFoto = '<th className="w-48">Keterangan</th>\n                    <th className="w-24 text-center">Foto</th>';
if (!code.includes('<th className="w-24 text-center">Foto</th>')) {
  code = code.split(thKeterangan).join(thKeteranganFoto);
}

const thKeteranganB3 = '<th rowSpan={2} className="w-48 align-middle">Keterangan</th>';
const thKeteranganB3Foto = '<th rowSpan={2} className="w-48 align-middle">Keterangan</th>\n                    <th rowSpan={2} className="w-24 text-center align-middle border-l border-gray-200 dark:border-slate-700">Foto</th>';
if (!code.includes('border-l border-gray-200 dark:border-slate-700">Foto</th>')) {
  code = code.split(thKeteranganB3).join(thKeteranganB3Foto);
}

// 7. Fix td body
const tdFoto = `
                      <td className="text-center">
                        {row.photos && row.photos.length > 0 ? (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {row.photos.map((ph: any, i: number) => (
                              <button key={i} onClick={() => setPhotoPopup(ph.url)} className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors" title="Lihat Foto">
                                📷 {ph.label}
                              </button>
                            ))}
                          </div>
                        ) : <span className="text-gray-400">-</span>}
                      </td>
`;

// Replace `row.keterangan` tds
// There are multiple tables. Let's do a global replace for the closing td of row.keterangan
// APD, Elektrik, Umum, dll uses `row.keterangan`
const trEndPattern1 = /(\<td className="text-xs max-w-\[150px\]"\>[\s\S]*?row\.keterangan[\s\S]*?\<\/td\>)\n\s*\<\/tr\>/g;
if (!code.match(/row\.photos && row\.photos\.length/g) || code.match(/row\.photos && row\.photos\.length/g).length < 2) {
  code = code.replace(trEndPattern1, `$1\n${tdFoto}\n                    </tr>`);
}

// B3 uses `row.keteranganC`
const trEndPattern2 = /(\<td className="text-xs"\>[\s\S]*?row\.keteranganC[\s\S]*?\<\/td\>)\n\s*\<\/tr\>/g;
if (!code.includes('row.keteranganC') || !code.match(/row\.photos && row\.photos\.length/g) || code.match(/row\.photos && row\.photos\.length/g).length < 5) {
  code = code.replace(trEndPattern2, `$1\n${tdFoto}\n                    </tr>`);
}

fs.writeFileSync(path, code, 'utf8');
console.log('Done script');
