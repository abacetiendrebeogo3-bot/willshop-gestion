const fs = require('fs');

let content = fs.readFileSync('app/(dashboard)/sales/my-day/page.tsx', 'utf8');

// 1. Make the header buttons stack on mobile
content = content.replace(
  '<div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#EBE5DA] pb-4">',
  '<div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4 border-b border-[#EBE5DA] pb-4">'
);
content = content.replace(
  '<div className="flex items-center gap-3">',
  '<div className="flex flex-wrap items-center gap-3">'
);

// 2. Make the action bar responsive (prev/next/skip/validate buttons)
content = content.replace(
  '<div className="flex items-center justify-between pt-2 border-t border-stone-100">',
  '<div className="flex flex-col sm:flex-row items-center sm:justify-between gap-3 pt-4 border-t border-stone-100">'
);
// Replace the two inner divs to be w-full sm:w-auto
content = content.replace(
  '<div className="flex items-center gap-2">',
  '<div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">'
);
content = content.replace(
  '<div className="flex items-center gap-2">',
  '<div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">'
);

fs.writeFileSync('app/(dashboard)/sales/my-day/page.tsx', content, 'utf8');
