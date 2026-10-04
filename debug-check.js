const assert = require('node:assert');

(async () => {
  const res = await fetch('http://localhost:3004/api/patrol-data?mode=module&slug=apar&bulan=2026-09', { cache: 'no-store' });
  const data = await res.json();
  console.log('status', res.status);
  console.log('keys', Object.keys(data || {}));
  console.log('submissions', data?.submissions?.length ?? 0);
  console.log('merged', data?.mergedSubmissions?.length ?? 0);
  if (data?.mergedSubmissions?.length) {
    console.log('firstMergedKeys', Object.keys(data.mergedSubmissions[0]));
    console.log('firstMergedIsLuar', data.mergedSubmissions[0].isLuarGedung);
    console.log('firstMergedLocation', data.mergedSubmissions[0].location);
    console.log('firstMergedExtras', data.mergedSubmissions[0].extras?.slice(0, 6));
  }
})();
