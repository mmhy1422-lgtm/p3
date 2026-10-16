const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const seedDir = path.join(publicDir, '_seed');
const publicFiles = ['index.html', 'login.html', 'register.html', 'admin.html', 'script.js', 'style.css', 'pr.mp4'];
const seedFiles = ['menu.json', 'offers.json'];

fs.mkdirSync(seedDir, { recursive: true });

for (const file of publicFiles) {
  fs.copyFileSync(path.join(rootDir, file), path.join(publicDir, file));
}

for (const file of seedFiles) {
  fs.copyFileSync(path.join(rootDir, 'data', file), path.join(seedDir, file));
}

console.log('Prepared Cloudflare assets and catalog seed files.');
