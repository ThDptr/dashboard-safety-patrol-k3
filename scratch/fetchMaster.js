const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxaSUBlS7lw20sPEPkCYqeerleaLSum7-G8st1U5OkrT3pex6XKzKyv9DY0hub4cUf9UQ/exec";
const SECRET = "rahasia_rsomh_k3";

async function run() {
  const url = new URL(WEBAPP_URL);
  url.searchParams.append("action", "read");
  url.searchParams.append("target", "masterPertanyaan");
  url.searchParams.append("secret", SECRET);
  url.searchParams.append("token", SECRET);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "read", target: "masterPertanyaan", secret: SECRET, token: SECRET })
  });

  const json = await res.json();
  const rows = json.data || [];
  
  const luar = rows.filter(r => (r.Topik || "").includes("Luar") || (r.Pertanyaan || "").includes("Luar"));
  console.log(JSON.stringify(luar, null, 2));
}

run();
