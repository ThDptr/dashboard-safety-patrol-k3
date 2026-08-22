const fs = require('fs'); 
let data = fs.readFileSync('app/patroli/[slug]/page.tsx', 'utf8'); 
data = data.replace(/<div className="overflow-x-auto p-4" style={{ transform: "rotateX\(180deg\)" }}>\s*<table className="data-table text-sm w-full text-left min-w-\[1200px\]" style={{ transform: "rotateX\(180deg\)" }}>/g, '<div className="overflow-x-auto p-4">\n              <table className="data-table text-sm w-full text-left min-w-[1200px]">'); 
fs.writeFileSync('app/patroli/[slug]/page.tsx', data);
