import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

fs.removeSync(dist);
fs.ensureDirSync(dist);

const items = [
  'index.html',
  'manifest.webmanifest',
  'service-worker.js',
  'README.md',
  'css',
  'js',
  'assets',
];

for (const item of items) {
  const source = path.join(root, item);
  const target = path.join(dist, item);
  if (fs.existsSync(source)) {
    fs.copySync(source, target);
  } else {
    console.warn(`Missing expected item: ${item}`);
  }
}

console.log('Static build complete → dist/');
