import { copyFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '..', 'node_modules', 'essentia.js', 'dist', 'essentia-wasm.web.wasm');
const destDir = join(__dirname, '..', 'public', 'wasm');
mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, 'essentia-wasm.web.wasm'));
console.log('Copied essentia-wasm.web.wasm to public/wasm/');
