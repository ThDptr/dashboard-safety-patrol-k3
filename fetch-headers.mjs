const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxj3LOxtw627Ij_x_bXtadjLMq8wz4GE0bGf8EVu4K_VxF5kNQAHmH9kDmwiMt2FDr3/exec";
const SECRET = "rahasia_rsomh_k3";

async function run() {
  const url = `${WEBAPP_URL}?action=read&secret=${SECRET}&token=${SECRET}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const json = await res.json();
  console.log(json.headers.filter(h => h.toLowerCase().includes("eyewasher") || h.toLowerCase().includes("b3")));
}
run();
