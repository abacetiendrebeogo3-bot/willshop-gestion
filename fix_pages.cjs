const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  if (!fs.existsSync(dir)) return filelist;
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('page.tsx')) filelist.push(dirFile);
    }
  });
  return filelist;
};

const files = walkSync('app/(dashboard)');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Skip if already has PageTransition
  if (!content.includes('PageTransition')) {
    // Inject import
    content = content.replace(/(import React.*?from "react";|import {.*?from "lucide-react";)/, `$1\nimport { PageTransition } from "@/components/animations/PageTransition";`);
    
    // Attempt to replace the outermost div. Usually right after `return (`
    // We look for `return (\n    <div`
    content = content.replace(/return\s*\(\s*<div\b([^>]*)>/, 'return (\n    <PageTransition$1>');
    // Now we need to replace the last </div> before );
    // A bit hacky: replace the last </div>
    const lastDivIdx = content.lastIndexOf('</div>\n  );');
    if (lastDivIdx !== -1) {
      content = content.substring(0, lastDivIdx) + '</PageTransition>\n  );' + content.substring(lastDivIdx + 12);
    } else {
      const lastDivIdx2 = content.lastIndexOf('</div>\n    )\n}');
      if (lastDivIdx2 !== -1) {
        content = content.substring(0, lastDivIdx2) + '</PageTransition>\n    )\n}' + content.substring(lastDivIdx2 + 13);
      }
    }
  }

  // Make tables horizontally scrollable
  // Find <table className="..."> and ensure it's wrapped in overflow-x-auto or add min-w
  if (content.includes('<table')) {
    content = content.replace(/<table className="([^"]*)"/g, (match, classes) => {
      if (!classes.includes('min-w-')) {
        return `<table className="${classes} min-w-[800px]"`;
      }
      return match;
    });
  }

  // Ensure responsive font sizes and spacing (rudimentary audit)
  // E.g., text-3xl -> text-2xl md:text-3xl
  content = content.replace(/text-4xl/g, 'text-3xl md:text-4xl');
  content = content.replace(/text-3xl(?! md:)/g, 'text-2xl md:text-3xl');

  fs.writeFileSync(file, content, 'utf8');
});

console.log('Processed pages for responsive and animation.');
