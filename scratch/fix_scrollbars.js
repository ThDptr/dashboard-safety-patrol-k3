const fs = require('fs');

function replaceAll(str, find, replace) {
  return str.split(find).join(replace);
}

// Fix SubmissionTable.tsx
let sub = fs.readFileSync('components/SubmissionTable.tsx', 'utf8');
sub = replaceAll(sub, '<div className="overflow-x-auto">', '<div className="overflow-x-auto" style={{ transform: "rotateX(180deg)" }}>');
sub = replaceAll(sub, '<table className="w-full text-sm text-left">', '<table className="w-full text-sm text-left" style={{ transform: "rotateX(180deg)" }}>');
fs.writeFileSync('components/SubmissionTable.tsx', sub);

// Fix page.tsx 
let page = fs.readFileSync('app/patroli/[slug]/page.tsx', 'utf8');
page = replaceAll(page, '<div className="overflow-x-auto p-4">', '<div className="overflow-x-auto p-4" style={{ transform: "rotateX(180deg)" }}>');
// There are several tables in page.tsx
page = replaceAll(page, '<table className="w-full text-sm text-left text-gray-500 min-w-[800px]">', '<table className="w-full text-sm text-left text-gray-500 min-w-[800px]" style={{ transform: "rotateX(180deg)" }}>');
page = replaceAll(page, '<table className="w-full text-sm text-left text-gray-500 min-w-[1200px]">', '<table className="w-full text-sm text-left text-gray-500 min-w-[1200px]" style={{ transform: "rotateX(180deg)" }}>');
// Also a general one
page = replaceAll(page, '<table className="w-full text-sm text-left">', '<table className="w-full text-sm text-left" style={{ transform: "rotateX(180deg)" }}>');

fs.writeFileSync('app/patroli/[slug]/page.tsx', page);
console.log('Fixed scrollbars.');
