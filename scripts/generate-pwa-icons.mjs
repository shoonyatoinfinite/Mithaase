import fs from "fs";
import path from "path";
import sharp from "sharp";

const iconsDir = path.join(process.cwd(), "public", "icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function getSvg(size, isMaskable = false) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="#3B0820" />
      <stop offset="60%" stop-color="#24052C" />
      <stop offset="100%" stop-color="#14021A" />
    </radialGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F5D061" />
      <stop offset="50%" stop-color="#D4AF37" />
      <stop offset="100%" stop-color="#AA8010" />
    </linearGradient>
    <radialGradient id="flameGrad" cx="50%" cy="70%" r="70%">
      <stop offset="0%" stop-color="#FFFDF0" />
      <stop offset="35%" stop-color="#FFD54F" />
      <stop offset="70%" stop-color="#FF6F00" />
      <stop offset="100%" stop-color="#D84315" />
    </radialGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${size * 0.025}" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  ${
    isMaskable
      ? `<rect width="${size}" height="${size}" fill="url(#bgGrad)" />`
      : `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bgGrad)" stroke="url(#goldGrad)" stroke-width="${size * 0.02}" />`
  }

  <g transform="translate(${size / 2}, ${size / 2})">
    <circle cx="0" cy="${-size * 0.05}" r="${size * 0.22}" fill="#F5D061" opacity="0.3" filter="url(#glow)" />
    
    <!-- Diya Base -->
    <path d="M ${-size * 0.26} ${size * 0.08} 
             C ${-size * 0.21} ${size * 0.24}, ${size * 0.21} ${size * 0.24}, ${size * 0.26} ${size * 0.08}
             C ${size * 0.12} ${size * 0.12}, ${-size * 0.12} ${size * 0.12}, ${-size * 0.26} ${size * 0.08} Z"
          fill="url(#goldGrad)" />
    
    <ellipse cx="0" cy="${size * 0.08}" rx="${size * 0.25}" ry="${size * 0.035}" fill="#AA8010" opacity="0.6" />
    <ellipse cx="0" cy="${size * 0.075}" rx="${size * 0.23}" ry="${size * 0.025}" fill="url(#goldGrad)" />

    <!-- Flame Body -->
    <path d="M 0 ${-size * 0.25}
             C ${size * 0.08} ${-size * 0.16}, ${size * 0.1} ${-size * 0.02}, 0 ${size * 0.07}
             C ${-size * 0.1} ${-size * 0.02}, ${-size * 0.08} ${-size * 0.16}, 0 ${-size * 0.25} Z"
          fill="url(#flameGrad)"
          filter="url(#glow)" />

    <!-- Inner Flame Heart -->
    <path d="M 0 ${-size * 0.19}
             C ${size * 0.035} ${-size * 0.12}, ${size * 0.045} ${-size * 0.02}, 0 ${size * 0.04}
             C ${-size * 0.045} ${-size * 0.02}, ${-size * 0.035} ${-size * 0.12}, 0 ${-size * 0.19} Z"
          fill="#FFFDF5" />
  </g>
</svg>`;
}

async function buildIcons() {
  const svg192 = getSvg(192, false);
  const svg512 = getSvg(512, false);
  const svgMaskable = getSvg(512, true);

  await sharp(Buffer.from(svg192)).png().toFile(path.join(iconsDir, "icon-192x192.png"));
  await sharp(Buffer.from(svg512)).png().toFile(path.join(iconsDir, "icon-512x512.png"));
  await sharp(Buffer.from(svgMaskable)).png().toFile(path.join(iconsDir, "icon-maskable-512x512.png"));
  await sharp(Buffer.from(svg192)).png().toFile(path.join(iconsDir, "apple-touch-icon.png"));

  fs.writeFileSync(path.join(iconsDir, "icon.svg"), svg512, "utf8");
  console.log("✓ PWA Icons successfully generated in public/icons/");
}

buildIcons().catch(console.error);
