const fs = require('fs');

let content = fs.readFileSync('app/patroli/[slug]/page.tsx', 'utf8');

content = content.replace(/\.forEach\(p => \{/g, '.forEach((p: any) => {');
content = content.replace(/\.forEach\(\(p\) => \{/g, '.forEach((p: any) => {');

fs.writeFileSync('app/patroli/[slug]/page.tsx', content, 'utf8');
console.log("Fixed forEach p any");
