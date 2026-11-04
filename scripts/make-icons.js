// Render public/icons/icon.svg ke PNG (192, 512, apple-touch 180, maskable 512).
// Jalankan: npm run icons   (butuh playwright + chromium)
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  const svg = fs.readFileSync(path.join(__dirname, "../public/icons/icon.svg"), "utf8");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const out = (f) => path.join(__dirname, "../public/icons", f);
  const shots = [
    { file: "icon-192.png", size: 192, pad: 0, radius: true },
    { file: "icon-512.png", size: 512, pad: 0, radius: true },
    { file: "apple-touch-icon.png", size: 180, pad: 0, radius: false },
    { file: "maskable-512.png", size: 512, pad: 0.1, radius: false },
  ];
  for (const s of shots) {
    const inner = Math.round(s.size * (1 - s.pad * 2));
    // Tanpa sudut membulat untuk iOS/maskable (OS yang memotong)
    const body = s.radius ? svg : svg.replace(/rx="114"/g, 'rx="0"');
    await page.setViewportSize({ width: s.size, height: s.size });
    await page.setContent(`<html><body style="margin:0;background:${s.pad ? "#0EA5E9" : "transparent"};display:grid;place-items:center;width:${s.size}px;height:${s.size}px">
      <div style="width:${inner}px;height:${inner}px">${body.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
    await page.screenshot({ path: out(s.file), omitBackground: !s.pad });
  }
  await browser.close();
  console.log("icons generated");
})();
