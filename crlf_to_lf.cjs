const fs = require('fs');
let content = fs.readFileSync('app/(dashboard)/whatsapp/page.tsx', 'utf8');
content = content.replace(/\r\n/g, '\n');
fs.writeFileSync('app/(dashboard)/whatsapp/page.tsx', content, 'utf8');
