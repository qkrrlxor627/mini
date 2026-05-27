// PWA 아이콘 생성 — 브랜드 그라데이션 위 흰색 종이비행기(송금) 마크.
// 폰트 비의존(순수 SVG path)이라 플랫폼 폰트 없이도 동일 렌더. `npm run gen:icons` 로 재생성.
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const iconsDir = path.join(pub, 'icons');

const BRAND = '#3b63f5'; // --color-brand-500 (app.css 와 동기화)
const BRAND_DARK = '#2d4fd6';
// Material "send" 필드 패스 (viewBox 0 0 24 24).
const SEND = 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z';

// rounded=true: 라운드 사각(any 용도). false: 풀블리드(maskable/apple — 플랫폼이 마스킹/라운딩).
function svg(rounded) {
  const bg = rounded
    ? '<rect width="512" height="512" rx="112" fill="url(#g)"/>'
    : '<rect width="512" height="512" fill="url(#g)"/>';
  // 마크는 중앙 280px(=24*11.6) → maskable 안전영역(80%·약 410px) 안.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${BRAND}"/><stop offset="1" stop-color="${BRAND_DARK}"/>
  </linearGradient></defs>
  ${bg}
  <g transform="translate(118,118) scale(11.6)" fill="#ffffff"><path d="${SEND}"/></g>
</svg>`;
}

await mkdir(iconsDir, { recursive: true });

const targets = [
  { svg: svg(true), size: 192, out: path.join(iconsDir, 'icon-192.png') },
  { svg: svg(true), size: 512, out: path.join(iconsDir, 'icon-512.png') },
  { svg: svg(false), size: 512, out: path.join(iconsDir, 'maskable-512.png') },
  { svg: svg(false), size: 180, out: path.join(pub, 'apple-touch-icon.png') },
];

for (const t of targets) {
  await sharp(Buffer.from(t.svg)).resize(t.size, t.size).png().toFile(t.out);
  console.log('wrote', path.relative(root, t.out));
}

await writeFile(path.join(pub, 'favicon.svg'), svg(true));
console.log('wrote', path.relative(root, path.join(pub, 'favicon.svg')));
