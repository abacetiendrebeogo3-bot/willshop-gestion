const fs = require('fs');
const walkSync = require('path');
const path = require('path');

function walk(dir, filelist = []) {
  if (!fs.existsSync(dir)) return filelist;
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walk(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.tsx')) filelist.push(dirFile);
    }
  });
  return filelist;
}

const files = walk('app');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Make side panels full screen on mobile
  if (content.match(/w-80|w-96|max-w-md|max-w-lg|max-w-sm/)) {
    // Look for fixed inset-0 flex justify-end containing a panel
    const regex = /className="fixed inset-0[^"]*justify-end[^"]*"[\s\S]*?<div className="([^"]*)"/g;
    content = content.replace(regex, (match, classes) => {
      let newClasses = classes;
      if (!newClasses.includes('w-full')) {
        newClasses = newClasses.replace(/w-\d+|w-sm|w-md|w-lg/g, 'w-full md:$&');
        if (!newClasses.includes('w-full')) {
          newClasses = 'w-full ' + newClasses;
        }
      }
      if (newClasses.includes('max-w-')) {
        newClasses = newClasses.replace(/max-w-[a-z0-9]+/g, 'md:$&');
      }
      if (newClasses !== classes) {
        changed = true;
        return match.replace(classes, newClasses);
      }
      return match;
    });
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated mobile panel width in ${file}`);
  }
});
