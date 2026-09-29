const fs = require('fs');
let content = fs.readFileSync('app/(dashboard)/whatsapp/page.tsx', 'utf8');

// 1. Add shrink-0 to tag buttons
content = content.replace(/className="flex items-center gap-1.5/g, 'className="flex items-center shrink-0 gap-1.5');

// 2. Remove AI floating button and overlay
const regex = /\{\/\* ── FLOATING ASSISTANT BUTTON[\s\S]*?Envoyer\s*<\/button>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\}/g;
content = content.replace(regex, '{/* ── ASSISTANT OVERLAY REMOVED (Handled Globally) ──────────────────── */}');

fs.writeFileSync('app/(dashboard)/whatsapp/page.tsx', content, 'utf8');
