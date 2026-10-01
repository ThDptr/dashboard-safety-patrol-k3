import { fetchPatrolData, fetchMasterData } from '../lib/google-sheets';
import { MODULE_BY_SLUG } from '../lib/modules';
import { computeModuleAggregate } from '../lib/analytics';

async function main() {
  const rows = await fetchPatrolData();
  const masterData = await fetchMasterData("Master Fisik");
  const masterTopik = await fetchMasterData("Master Topik");
  const masterPertanyaan = await fetchMasterData("Master Pertanyaan");
  
  const b3Mod = MODULE_BY_SLUG['b3'];
  const res = computeModuleAggregate(b3Mod, rows, masterData, masterTopik, masterPertanyaan);
  
  console.log(JSON.stringify(res.questionResults, null, 2));
}
main();
