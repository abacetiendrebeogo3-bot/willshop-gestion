const fs = require('fs');
let content = fs.readFileSync('app/(dashboard)/whatsapp/page.tsx', 'utf8');

// Add shrink-0 to tag buttons with backticks
content = content.replace(/className=\{`flex items-center gap-1\.5/g, 'className={`flex items-center shrink-0 gap-1.5');

fs.writeFileSync('app/(dashboard)/whatsapp/page.tsx', content, 'utf8');
