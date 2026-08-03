const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwQbRro8v_-VvTj_Xmf9hCLp8S36Wb_ihyT670BKw01yXYR_b4RHxnizp-0ZaVID3Wraw/exec";

async function run() {
  console.log("Fetching data from WebApp...");
  const res = await fetch(WEBAPP_URL);
  if (!res.ok) {
    console.error("Failed to fetch", res.status);
    return;
  }
  const json = await res.json();
  const rows = json.data;
  
  // Track by "Year-Month|Location|PatroliKe"
  // For each key, we store array of rows
  const tracker = {};

  rows.forEach((row, idx) => {
    const rawDate = row["Tanggal Pemantauan"] || row["Timestamp"] || "";
    if (!rawDate) return;
    
    // Parse date quickly to get YYYY-MM
    let y, mo;
    const match = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
       y = match[3];
       mo = match[1].padStart(2, "0");
    } else {
       const d = new Date(rawDate);
       y = d.getFullYear();
       mo = String(d.getMonth() + 1).padStart(2, "0");
    }
    const monthKey = `${y}-${mo}`;
    
    const jenis = (row["Jenis Pemantauan"] || "").toLowerCase();
    let location = row["Ruangan"] || "-";
    if (jenis === "pcra") location = row["PCRA - Lokasi dan deskripsi pekerjaan"] || location || "PCRA";
    else if (jenis === "luar gedung") location = row["Lokasi"] || location || "Luar Gedung";
    else if (jenis.includes("b3")) location = row["Ruangan patroli B3"] || location || "B3";
    
    const patroliKe = parseInt(row["Patroli ke-"] || "0", 10) || 0;
    
    if (patroliKe === 0) return; // Ignore if not set or 0
    
    const key = `${monthKey} | ${location} | Patroli ke-${patroliKe}`;
    if (!tracker[key]) tracker[key] = [];
    tracker[key].push({
       idx: idx + 2, // approximate sheet row
       tanggal: rawDate,
       petugas: row["Nama Petugas"],
       jenis
    });
  });

  let anomaliesCount = 0;
  console.log("\n--- Anomaly Analysis (Duplicates) ---");
  for (const [key, records] of Object.entries(tracker)) {
    if (records.length > 1) {
      anomaliesCount++;
      console.log(`\nAnomaly found for: [${key}] - ${records.length} entries:`);
      records.forEach(r => {
         console.log(`   - Row ${r.idx}: ${r.tanggal} by ${r.petugas} (Modul: ${r.jenis})`);
      });
    }
  }
  
  if (anomaliesCount === 0) {
    console.log("No anomalies found!");
  } else {
    console.log(`\nTotal anomalies detected: ${anomaliesCount}`);
  }
}

run().catch(console.error);
