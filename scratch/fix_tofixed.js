const fs = require('fs');

let content = fs.readFileSync('app/patroli/[slug]/page.tsx', 'utf8');

// The bad regex replaced `Math.round(X)` with `((X)).toFixed(2)`.
// Sometimes X was `A * 100`, so it became `((A * 100)).toFixed(2)`. This is fine if it's used in a string context, but wait, `Math.round()` returns a Number!
// So anything that was `Math.round(X)` should become `Number((X).toFixed(2))` to preserve its type.
// If it was `Math.round(A / B * 100)`, it became `(((A / B) * 100)).toFixed(2)`. Wait, no, the regex was:
// `.replace(/Math\.round\(([^)]+)\)/g, '(($1)).toFixed(2)')`
// So `Math.round(a / b * 100)` became `((a / b * 100)).toFixed(2)`.
// But look at line 761: `(((totalKetersediaanYa / totalKetersediaanAns)).toFixed(2) * 100)`
// That means the original was `Math.round(totalKetersediaanYa / totalKetersediaanAns) * 100` ???
// NO! Original was `Math.round(totalKetersediaanYa / totalKetersediaanAns) * 100` ?? That's wrong. Usually it's `Math.round((a/b)*100)`.
// If original was `Math.round(totalKetersediaanYa / totalKetersediaanAns) * 100`, then my regex made it `((totalKetersediaanYa / totalKetersediaanAns)).toFixed(2) * 100`.
// Let's just fix the bad `.toFixed(2) * 100` patterns.

// Fix 1: `((X)).toFixed(2) * 100` -> `Number(((X) * 100).toFixed(2))`
content = content.replace(/\(\(\(([^)]+)\)\)\.toFixed\(2\)\s*\*\s*100\)/g, 'Number((($1) * 100).toFixed(2))');

// Fix 2: `((X)).toFixed(2) * 100` without outer parens -> `Number(((X) * 100).toFixed(2))`
content = content.replace(/\(\(([^)]+)\)\)\.toFixed\(2\)\s*\*\s*100/g, 'Number((($1) * 100).toFixed(2))');

// Fix 3: any remaining `X.toFixed(2) * 100` -> `Number((X * 100).toFixed(2))`
content = content.replace(/(\([^)]+\))\.toFixed\(2\)\s*\*\s*100/g, 'Number(($1 * 100).toFixed(2))');

fs.writeFileSync('app/patroli/[slug]/page.tsx', content, 'utf8');
console.log("Fixed toFixed errors in page.tsx");
