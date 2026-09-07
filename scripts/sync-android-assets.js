import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../apps/mobile/dist');
const targetAssetsDir = path.resolve(__dirname, '../apps/mobile/android/app/src/main/assets');
const targetPublicDir = path.resolve(targetAssetsDir, 'public');

console.log('[Sync Assets] Copying mobile dist to Android assets...');
if (!fs.existsSync(distDir)) {
  console.error('[Sync Assets] ERROR: apps/mobile/dist does not exist! Please run npm run build first.');
  process.exit(1);
}

fs.mkdirSync(targetPublicDir, { recursive: true });

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

copyRecursive(distDir, targetPublicDir);

const config = {
  appId: 'com.road.patrol',
  appName: 'RoadPatrol',
  webDir: 'dist'
};
fs.writeFileSync(path.join(targetAssetsDir, 'capacitor.config.json'), JSON.stringify(config, null, 2));

console.log('[Sync Assets] Done! Copied web bundle and generated capacitor.config.json.');
