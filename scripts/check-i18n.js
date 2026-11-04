// Memeriksa teks t("…") yang belum punya terjemahan Inggris di lib/i18n-en.js.
// Jalankan: node scripts/check-i18n.js
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    if (["node_modules", ".next", ".claude", ".taste-skill"].includes(f)) continue;
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|mjs)$/.test(f)) files.push(p);
  }
})(root);

const keys = new Set();
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  for (const m of s.matchAll(/\b(?:t|tr|translate)\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(m[1].replace(/\\"/g, '"'));
}
for (const m of fs.readFileSync(path.join(root, "lib/constants.js"), "utf8").matchAll(/(?:label|editor|viewer|owner): "([^"]+)"/g)) keys.add(m[1]);

const en = fs.readFileSync(path.join(root, "lib/i18n-en.js"), "utf8");
const have = new Set([...en.matchAll(/^\s*"((?:[^"\\]|\\.)*)":/gm)].map((m) => m[1].replace(/\\"/g, '"')));
const missing = [...keys].filter((k) => !have.has(k)).sort();
if (missing.length) {
  console.log(`${missing.length} teks belum diterjemahkan:\n` + missing.map((k) => "  " + k).join("\n"));
  process.exit(1);
}
console.log(`OK: ${keys.size} teks, semua punya terjemahan Inggris.`);
