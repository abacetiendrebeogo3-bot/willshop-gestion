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

  // Inject import
  if (!content.includes('PageTransition')) {
    content = content.replace(/(import React.*?from "react";|import {.*?from "lucide-react";)/, `$1\nimport { PageTransition } from "@/components/animations/PageTransition";`);
  }

  // Find the `return (` of the default export component
  const returnIndex = content.lastIndexOf('return (');
  if (returnIndex !== -1 && !content.includes('<PageTransition')) {
    let divIndex = content.indexOf('<div', returnIndex);
    if (divIndex !== -1) {
      // Find matching closing div
      let count = 0;
      let i = divIndex;
      let lastClosingDiv = -1;
      
      while (i < content.length) {
        if (content.substring(i, i + 4) === '<div') {
          count++;
          i += 4;
        } else if (content.substring(i, i + 6) === '</div') {
          count--;
          if (count === 0) {
            lastClosingDiv = i;
            break;
          }
          i += 6;
        } else {
          i++;
        }
      }

      if (lastClosingDiv !== -1) {
        content = content.substring(0, divIndex) + '<PageTransition' + content.substring(divIndex + 4, lastClosingDiv) + '</PageTransition' + content.substring(lastClosingDiv + 5);
      }
    }
  }

  // Make tables horizontally scrollable
  if (content.includes('<table')) {
    content = content.replace(/<table className="([^"]*)"/g, (match, classes) => {
      if (!classes.includes('min-w-')) {
        return `<table className="${classes} min-w-[800px]"`;
      }
      return match;
    });
    // wrap table in a div with overflow-x-auto if not already
    // (We assume they are mostly wrapped, we'll just add it to the tables)
  }

  fs.writeFileSync(file, content, 'utf8');
});

console.log('Processed pages robustly.');
