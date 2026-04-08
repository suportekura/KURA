import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';

// Gerar 512x512 real (upscale do 192x192 com alta qualidade)
await sharp('public/pwa-192x192.png')
  .resize(512, 512, { fit: 'contain', background: { r: 247, g: 245, b: 240, alpha: 1 } })
  .png({ quality: 100 })
  .toFile('public/pwa-512x512.png');

console.log('pwa-512x512.png gerado');

// Gerar icones Apple Touch Icons
const appleSizes = [180, 167, 152, 120, 76, 60];
mkdirSync('public/apple-icons', { recursive: true });

for (const size of appleSizes) {
  await sharp('public/pwa-192x192.png')
    .resize(size, size, { fit: 'contain', background: { r: 247, g: 245, b: 240, alpha: 1 } })
    .png({ quality: 95 })
    .toFile(`public/apple-icons/apple-touch-icon-${size}x${size}.png`);
  console.log(`apple-touch-icon-${size}x${size}.png gerado`);
}
