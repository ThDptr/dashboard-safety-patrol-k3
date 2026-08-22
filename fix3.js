const fs = require('fs'); 
let data = fs.readFileSync('components/SubmissionTable.tsx', 'utf8'); 
data = data.replace(/<div className="overflow-x-auto" style={{ transform: "rotateX\(180deg\)" }}>\s*<table className="data-table text-sm" id="submission-table" style={{ transform: "rotateX\(180deg\)" }}>/g, '<div className="overflow-x-auto">\n        <table className="data-table text-sm" id="submission-table">'); 
fs.writeFileSync('components/SubmissionTable.tsx', data);
