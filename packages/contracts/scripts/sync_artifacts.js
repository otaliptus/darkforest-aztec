import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contractsDir = path.resolve(__dirname, '..');
const src = path.join(contractsDir, 'target', 'darkforest_contract-DarkForest.json');
const dest = path.join(contractsDir, 'darkforest_contract-DarkForest.json');

if (!fs.existsSync(src)) {
  console.warn('[sync_artifacts] Missing target artifact:', src);
  process.exit(0);
}

fs.copyFileSync(src, dest);
console.log('[sync_artifacts] Copied artifact to', dest);
