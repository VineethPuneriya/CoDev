const fs = require('fs');
const path = require('path');

function generateStructure(dir, prefix = '') {
  const exclude = ['node_modules', '.git', '.DS_Store', 'dist', 'build'];
  let result = '';
  const items = fs.readdirSync(dir).filter(item => !exclude.includes(item));
  items.sort((a, b) => {
    const aIsDir = fs.statSync(path.join(dir, a)).isDirectory();
    const bIsDir = fs.statSync(path.join(dir, b)).isDirectory();
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isLast = i === items.length - 1;
    const itemPath = path.join(dir, item);
    const isDir = fs.statSync(itemPath).isDirectory();
    
    result += prefix + (isLast ? '└── ' : '├── ') + item + '\n';
    if (isDir) {
      result += generateStructure(itemPath, prefix + (isLast ? '    ' : '│   '));
    }
  }
  return result;
}

const structure = '.\n' + generateStructure('.');
fs.writeFileSync('file_structure.txt', structure);
console.log('Done');
