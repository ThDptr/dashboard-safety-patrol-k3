const fs = require('fs');
let content = fs.readFileSync('app/patroli/[slug]/page.tsx', 'utf8');

// 1. Remove photo logic from buildPatrolKeterangan
const bpkOld = `    // 4. Photo URL
    const photo = useSecondary ? p?.secondaryPhotoUrl : p?.photoUrl;
    if (typeof photo === 'string' && photo.trim() !== "") {
      parts.push(\`📷 \${photo.trim()}\`);
    }

    return parts.length > 0 ? parts.join(" ") : null;`;
const bpkNew = `    return parts.length > 0 ? parts.join(" ") : null;`;
content = content.replace(bpkOld, bpkNew);

// 1b. Remove date logic from buildPatrolKeterangan
const bpkDateOld = `    // 1. Date
    const rawDate = p?.tanggalPemantauan || p?.timestamp;
    if (rawDate && rawDate !== "-") {
      parts.push(\`[\${formatTanggalPendek(rawDate)}]\`);
    }`;
content = content.replace(bpkDateOld, "");

// 2. Add photos to fisikData and modify keterangan format
const fisikDataOld = `      const keterangan = top10
        .map((p, idx) => {
          const ket = buildPatrolKeterangan(p, masterProfesiNamesForKet);
          return ket ? \`P\${idx + 1}: \${ket}\` : null;
        })
        .filter(Boolean)
        .join(" ; ") || "-";

      return {
        ruangan,
        jumlahKaryawan,
        tanggal,
        namaPetugas,
        keterangan,
        patrols: top10,
        isProfesi: false
      };`;
const fisikDataNew = `      const keterangan = top10
        .map((p, idx) => {
          const ket = buildPatrolKeterangan(p, masterProfesiNamesForKet);
          const tgl = p.tanggalPemantauan || p.timestamp;
          return ket ? \`P\${idx + 1} (\${tgl && tgl !== "-" ? formatTanggalPendek(tgl) : "-"}): \${ket}\` : null;
        })
        .filter(Boolean)
        .join(" ; ") || "-";

      const photos = top10
        .map((p, idx) => {
          if (p.photoUrl && p.photoUrl.trim() !== "" && p.photoUrl !== "-") {
            return { url: p.photoUrl.trim(), label: \`P\${idx + 1}\` };
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
      };`;
content = content.replace(fisikDataOld, fisikDataNew);

// 3. Add photos to profesiData
const profKeteranganOld = `      let allKeterangan: { slot: number; desc: string }[] = [];`;
const profKeteranganNew = `      let allKeterangan: { slot: number; desc: string, photoUrl?: string | null }[] = [];`;
content = content.replace(profKeteranganOld, profKeteranganNew);

const profPushOld = `            if (p.photoUrl) parts.push(\`📷 \${p.photoUrl}\`);
            allKeterangan.push({ slot: i, desc: parts.join(" | ") });`;
const profPushNew = `            allKeterangan.push({ slot: i, desc: parts.join(" | "), photoUrl: p.photoUrl && p.photoUrl !== "-" ? p.photoUrl : null });`;
content = content.replace(profPushOld, profPushNew);

const profRetOld = `      return {
        ruangan: namaProfesiRaw,
        jumlahKaryawan,
        tanggal: latestDate > 0 ? formatTanggal(new Date(latestDate)) : "-",
        namaPetugas: allPetugas.length > 0 ? Array.from(new Set(allPetugas)).join(", ") : "-",
        keterangan: allKeterangan.length > 0
          ? allKeterangan.map(k => \`P\${k.slot}: \${k.desc}\`).join(" ; ")
          : "-",
        patrols: top10,
        isProfesi: true
      };`;
const profRetNew = `      const photos = allKeterangan
        .filter(k => k.photoUrl)
        .map(k => ({ url: k.photoUrl, label: \`P\${k.slot}\` }));

      return {
        ruangan: namaProfesiRaw,
        jumlahKaryawan,
        tanggal: latestDate > 0 ? formatTanggal(new Date(latestDate)) : "-",
        namaPetugas: allPetugas.length > 0 ? Array.from(new Set(allPetugas)).join(", ") : "-",
        keterangan: allKeterangan.length > 0
          ? allKeterangan.map(k => \`P\${k.slot}: \${k.desc}\`).join(" ; ")
          : "-",
        photos,
        patrols: top10,
        isProfesi: true
      };`;
content = content.replace(profRetOld, profRetNew);

// 4. Add photos to elektrikData
const elektrikDataOld = `          const keterangan = top10
            .map((p, idx) => {
              const ket = buildPatrolKeterangan(p);
              return ket ? \`P\${idx + 1}: \${ket}\` : null;
            })
            .filter(Boolean)
            .join(" ; ") || "-";

          return { ruangan, tanggal, namaPetugas, keterangan, patrols: top10 };`;
const elektrikDataNew = `          const keterangan = top10
            .map((p, idx) => {
              const ket = buildPatrolKeterangan(p);
              const tgl = p.tanggalPemantauan || p.timestamp;
              return ket ? \`P\${idx + 1} (\${tgl && tgl !== "-" ? formatTanggalPendek(tgl) : "-"}): \${ket}\` : null;
            })
            .filter(Boolean)
            .join(" ; ") || "-";

          const photos = top10
            .map((p, idx) => {
              if (p.photoUrl && p.photoUrl.trim() !== "" && p.photoUrl !== "-") {
                return { url: p.photoUrl.trim(), label: \`P\${idx + 1}\` };
              }
              return null;
            })
            .filter(Boolean);

          return { ruangan, tanggal, namaPetugas, keterangan, photos, patrols: top10 };`;
content = content.replace(elektrikDataOld, elektrikDataNew);

// 5. Add photos to b3Data
const b3DataOld = `          const keteranganA = top2
            .map((p, idx) => {
              const ket = buildPatrolKeterangan(p, [], false);
              return ket ? \`P\${idx + 1}: \${ket}\` : null;
            })
            .filter(Boolean)
            .join(" ; ") || "-";
            
          const keteranganC = top2
            .map((p, idx) => {
              const ket = buildPatrolKeterangan(p, [], true);
              return ket ? \`P\${idx + 1}: \${ket}\` : null;
            })
            .filter(Boolean)
            .join(" ; ") || "-";

          let terlihatLemari = "-";`;
const b3DataNew = `          const keteranganA = top2
            .map((p, idx) => {
              const ket = buildPatrolKeterangan(p, [], false);
              const tgl = p.tanggalPemantauan || p.timestamp;
              return ket ? \`P\${idx + 1} (\${tgl && tgl !== "-" ? formatTanggalPendek(tgl) : "-"}): \${ket}\` : null;
            })
            .filter(Boolean)
            .join(" ; ") || "-";
            
          const keteranganC = top2
            .map((p, idx) => {
              const ket = buildPatrolKeterangan(p, [], true);
              const tgl = p.tanggalPemantauan || p.timestamp;
              return ket ? \`P\${idx + 1} (\${tgl && tgl !== "-" ? formatTanggalPendek(tgl) : "-"}): \${ket}\` : null;
            })
            .filter(Boolean)
            .join(" ; ") || "-";

          let terlihatLemari = "-";`;
content = content.replace(b3DataOld, b3DataNew);

const b3RetOld = `      return {
        ruangan,
        tanggal: latestPatrol ? formatTanggal(latestPatrol.tanggalPemantauan || latestPatrol.timestamp) : "-",
        namaPetugas,
        seharusnyaLemari,
        terlihatLemari,
        eyewasher,
        bodywasher,
        keteranganA,
        keteranganC,
        patrols: top2,
      };`;
const b3RetNew = `      const photosA = top2
        .map((p, idx) => {
          if (p.photoUrl && p.photoUrl.trim() !== "" && p.photoUrl !== "-") {
            return { url: p.photoUrl.trim(), label: \`P\${idx + 1}\` };
          }
          return null;
        })
        .filter(Boolean);
            
      const photosC = top2
        .map((p, idx) => {
          if (p.secondaryPhotoUrl && p.secondaryPhotoUrl.trim() !== "" && p.secondaryPhotoUrl !== "-") {
            return { url: p.secondaryPhotoUrl.trim(), label: \`P\${idx + 1}\` };
          }
          return null;
        })
        .filter(Boolean);

      return {
        ruangan,
        tanggal: latestPatrol ? formatTanggal(latestPatrol.tanggalPemantauan || latestPatrol.timestamp) : "-",
        namaPetugas,
        seharusnyaLemari,
        terlihatLemari,
        eyewasher,
        bodywasher,
        keteranganA,
        keteranganC,
        photosA,
        photosC,
        patrols: top2,
      };`;
content = content.replace(b3RetOld, b3RetNew);

// 6. Fix harian date format in keterangan
const harianDataOld = `      const keterangan = top10
        .map((p: any, idx: number) => {
          const ket = buildPatrolKeterangan(p);
          return ket ? \`P\${idx + 1}: \${ket}\` : null;
        })
        .filter(Boolean)
        .join(" ; ") || "-";`;
const harianDataNew = `      const keterangan = top10
        .map((p: any, idx: number) => {
          const ket = buildPatrolKeterangan(p);
          const tgl = p.tanggalPemantauan || p.timestamp;
          return ket ? \`P\${idx + 1} (\${tgl && tgl !== "-" ? formatTanggalPendek(tgl) : "-"}): \${ket}\` : null;
        })
        .filter(Boolean)
        .join(" ; ") || "-";`;
content = content.replace(harianDataOld, harianDataNew);

fs.writeFileSync('app/patroli/[slug]/page.tsx', content, 'utf8');
console.log("Applied mapping changes!");
