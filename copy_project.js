const fs = require('fs');
const path = require('path');

const src = '.';
const dest = 'workspace_fix';
const ignore = ['.git', '.trae', '.wrangler', 'node_modules', 'dist', 'workspace_fix', '.DS_Store'];

if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest);
}

function copyRecursive(source, target) {
    const stats = fs.statSync(source);
    if (stats.isDirectory()) {
        if (!fs.existsSync(target)) {
            fs.mkdirSync(target);
        }
        fs.readdirSync(source).forEach(file => {
            if (ignore.includes(file)) return;
            // Also ignore .npm-cache and other hidden files if needed, but let's be careful
            if (file === '.npm-cache') return;
            copyRecursive(path.join(source, file), path.join(target, file));
        });
    } else {
        fs.copyFileSync(source, target);
    }
}

try {
    copyRecursive(src, dest);
    console.log('Copy complete');
} catch (e) {
    console.error('Copy failed:', e);
}
