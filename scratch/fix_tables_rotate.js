const fs = require('fs');

function replaceAll(str, find, replace) {
  return str.split(find).join(replace);
}

let page = fs.readFileSync('app/patroli/[slug]/page.tsx', 'utf8');

// The outer container was already modified: '<div className="overflow-x-auto p-4" style={{ transform: "rotateX(180deg)" }}>'
// We need to modify the 4 inner tables
page = replaceAll(page, '<table className="data-table text-sm w-full text-left min-w-[1200px]">', '<table className="data-table text-sm w-full text-left min-w-[1200px]" style={{ transform: "rotateX(180deg)" }}>');
page = replaceAll(page, '<table className="data-table text-sm w-full text-left min-w-[800px]">', '<table className="data-table text-sm w-full text-left min-w-[800px]" style={{ transform: "rotateX(180deg)" }}>');
page = replaceAll(page, '<table className="data-table text-sm w-full text-left" style={{ minWidth: `${400 + nQ * 10 * 80}px` }}>', '<table className="data-table text-sm w-full text-left" style={{ minWidth: `${400 + nQ * 10 * 80}px`, transform: "rotateX(180deg)" }}>');

fs.writeFileSync('app/patroli/[slug]/page.tsx', page);
console.log('Fixed tables in page.tsx');
