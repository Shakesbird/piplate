import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const iconDir = resolve(projectRoot, 'public', 'icons');

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  return crc >>> 0;
});

const crc32 = buffer => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (name, data) => {
  const type = Buffer.from(name);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, checksum]);
};

const mix = (bottom, top, alpha) => bottom.map((value, index) => Math.round(value * (1 - alpha) + top[index] * alpha));
const coverage = distance => Math.max(0, Math.min(1, 0.75 - distance));

const createIcon = (size, maskable = false) => {
  const background = [217, 93, 57];
  const cream = [255, 253, 248];
  const ink = [45, 42, 38];
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  const center = size / 2;
  const plateRadius = size * (maskable ? 0.265 : 0.31);
  const ringRadius = plateRadius * 0.76;
  const utensilOffset = plateRadius * 1.18;

  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    pixels[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - center;
      const dy = y + 0.5 - center;
      const distance = Math.hypot(dx, dy);
      let color = background;

      const plate = coverage(distance - plateRadius);
      if (plate > 0) color = mix(color, cream, plate);

      const ring = coverage(Math.abs(distance - ringRadius) - size * 0.012);
      if (ring > 0) color = mix(color, ink, ring * 0.72);

      const forkX = center - utensilOffset;
      const forkHandle = coverage(Math.max(Math.abs(x + 0.5 - forkX) - size * 0.015, Math.abs(y + 0.5 - center) - plateRadius * 0.72));
      if (forkHandle > 0) color = mix(color, cream, forkHandle);
      for (const tine of [-0.045, 0, 0.045]) {
        const tineCoverage = coverage(Math.max(Math.abs(x + 0.5 - (forkX + size * tine)) - size * 0.009, Math.abs(y + 0.5 - (center - plateRadius * 0.59)) - plateRadius * 0.22));
        if (tineCoverage > 0) color = mix(color, cream, tineCoverage);
      }

      const spoonX = center + utensilOffset;
      const spoonHandle = coverage(Math.max(Math.abs(x + 0.5 - spoonX) - size * 0.015, Math.abs(y + 0.5 - (center + plateRadius * 0.18)) - plateRadius * 0.54));
      if (spoonHandle > 0) color = mix(color, cream, spoonHandle);
      const spoonBowl = coverage(Math.hypot((x + 0.5 - spoonX) / 0.72, y + 0.5 - (center - plateRadius * 0.57)) - plateRadius * 0.2);
      if (spoonBowl > 0) color = mix(color, cream, spoonBowl);

      const offset = row + 1 + x * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 255;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

await mkdir(iconDir, { recursive: true });
await Promise.all([
  writeFile(resolve(iconDir, 'piplate-192.png'), createIcon(192)),
  writeFile(resolve(iconDir, 'piplate-512.png'), createIcon(512)),
  writeFile(resolve(iconDir, 'piplate-maskable-512.png'), createIcon(512, true)),
]);
