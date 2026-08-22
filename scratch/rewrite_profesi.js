const fs = require('fs');

const replacement = `    const profesiData = masterProfesi.map((master) => {
      const namaProfesiRaw = master.Ruangan || "";
      const namaProfesi = namaProfesiRaw.substring(2).trim();
      const jumlahKaryawan = parseInt(master["Jumlah Karyawan"] as any) || 0;

      // Create 10 virtual patrols based on patroliKe (1 to 10)
      const top10 = [];
      let allKeterangan: { slot: number; desc: string, photoUrl?: string | null, date?: any }[] = [];
      let latestDate = 0;
      let allPetugas: string[] = [];
      let allPhotos: any[] = [];

      for (let i = 1; i <= 10; i++) {
        const patrolsInSlot = groupedSubmissionsByKe[i] || [];

        let sumViolations = 0;
        patrolsInSlot.forEach((p: any) => {
          const matchCount = (p.tags || []).filter((t: string) => {
            const tLower = t.toLowerCase();
            const npLower = namaProfesi.toLowerCase();
            return tLower.includes(npLower) || npLower.includes(tLower);
          }).length;
          
          if (matchCount > 0) {
            sumViolations += matchCount;
            
            // Build description indicating which room the violation occurred in
            const locationStr = p.location ? \` di \${p.location}\` : "";
            const profStr = \`[Tidak patuh: \${matchCount} \${namaProfesi}]\${locationStr}\`;
            const parts = [profStr];
            if (p.description && typeof p.description === 'string' && p.description.trim() !== "" && p.description !== "-") parts.push(p.description.trim());
            if (p.photoUrl) {
              allPhotos.push({ url: p.photoUrl, label: \`P\${i}\` });
            }
            allKeterangan.push({ slot: i, desc: parts.join(" | "), date: p.tanggalPemantauan || p.timestamp });
            
            if (p.namaPetugas) allPetugas.push(p.namaPetugas);
            const pTime = new Date(p.tanggalPemantauan || p.timestamp).getTime();
            if (pTime > latestDate) latestDate = pTime;
          }
        });

        if (patrolsInSlot.length > 0) {
          top10.push({
            tags: new Array(sumViolations).fill("violation"),
            answers: [
              { label: "Kepatuhan menggunakan APD", jawaban: sumViolations > 0 ? "Tidak" : "Ya" }
            ]
          });
        } else {
          top10.push(null);
        }
      }

      return {
        ruangan: namaProfesiRaw,
        jumlahKaryawan,
        tanggal: latestDate > 0 ? formatTanggal(new Date(latestDate).toISOString()) : "-",
        namaPetugas: allPetugas.length > 0 ? Array.from(new Set(allPetugas)).join(", ") : "-",
        keterangan: allKeterangan.length > 0
          ? allKeterangan.map(k => { const d = formatTanggal(k.date); return \`P\${k.slot} (\${d}): \${k.desc}\`; }).join(" ; ")
          : "-",
        patrols: top10,
        isProfesi: true,
        photos: allPhotos
      };
    }).filter(d => d.patrols.some(p => p !== null));

    return [...fisikData, ...profesiData];`;

let lines = fs.readFileSync('app/patroli/[slug]/page.tsx', 'utf8').split('\n');
let start = -1, end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const profesiData = masterProfesi.map')) start = i;
  if (start !== -1 && lines[i].includes('return [...fisikData, ...profesiData];')) {
    end = i;
    break;
  }
}

if (start !== -1 && end !== -1) {
  lines.splice(start, end - start + 1, replacement);
  fs.writeFileSync('app/patroli/[slug]/page.tsx', lines.join('\n'));
  console.log('Successfully replaced profesiData block.');
} else {
  console.log('Could not find block bounds!');
}
