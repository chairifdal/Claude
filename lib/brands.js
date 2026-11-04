// Badge merek bank / e-wallet / investasi Indonesia.
// Ini BUKAN logo resmi: hanya kotak berwarna khas merek dengan wordmark singkat.
// Untuk logo asli, pakai "Unggah ikon sendiri" di form akun.
export const BRAND_GROUPS = [
  { id: "bank", label: "Bank", kind: "bank" },
  { id: "ewallet", label: "E-Wallet", kind: "ewallet" },
  { id: "invest", label: "Investasi", kind: "investment" },
];

export const BRANDS = [
  { id: "bca", group: "bank", name: "BCA", text: "BCA", color: "#0060AF" },
  { id: "mandiri", group: "bank", name: "Mandiri", text: "mandiri", color: "#003D79", ink: "#FFB700" },
  { id: "bni", group: "bank", name: "BNI", text: "BNI", color: "#F15A22" },
  { id: "bri", group: "bank", name: "BRI", text: "BRI", color: "#00529C" },
  { id: "cimb", group: "bank", name: "CIMB Niaga", text: "CIMB", color: "#7A0C1E" },
  { id: "permata", group: "bank", name: "Permata", text: "Permata", color: "#00A650" },
  { id: "btn", group: "bank", name: "BTN", text: "BTN", color: "#FDB913", ink: "#004B93" },
  { id: "jago", group: "bank", name: "Jago", text: "jago", color: "#FFB400", ink: "#2A2A2A" },
  { id: "seabank", group: "bank", name: "SeaBank", text: "Sea", color: "#FF6A00" },
  { id: "blu", group: "bank", name: "blu", text: "blu", color: "#0069FF" },
  { id: "danamon", group: "bank", name: "Danamon", text: "Danamon", color: "#F7941D" },
  { id: "bsi", group: "bank", name: "BSI", text: "BSI", color: "#00A29A" },
  { id: "gopay", group: "ewallet", name: "GoPay", text: "gopay", color: "#00AED6" },
  { id: "ovo", group: "ewallet", name: "OVO", text: "OVO", color: "#4C2A86" },
  { id: "dana", group: "ewallet", name: "DANA", text: "DANA", color: "#118EEA" },
  { id: "shopeepay", group: "ewallet", name: "ShopeePay", text: "SPay", color: "#EE4D2D" },
  { id: "jenius", group: "ewallet", name: "Jenius", text: "J", color: "#00A9E0" },
  { id: "bibit", group: "invest", name: "Bibit", text: "Bibit", color: "#1CB26B" },
  { id: "bareksa", group: "invest", name: "Bareksa", text: "Bareksa", color: "#0A5EB0" },
  { id: "stockbit", group: "invest", name: "Stockbit", text: "SB", color: "#00AB6B" },
  { id: "ajaib", group: "invest", name: "Ajaib", text: "Ajaib", color: "#5B47DB" },
];

const BY_ID = Object.fromEntries(BRANDS.map((b) => [b.id, b]));

/** account.icon: "brand:<id>" (badge bawaan) atau URL gambar unggahan sendiri. */
export function parseIcon(icon) {
  if (!icon) return null;
  if (icon.startsWith("brand:")) { const b = BY_ID[icon.slice(6)]; return b ? { type: "brand", brand: b } : null; }
  if (/^https?:\/\//.test(icon)) return { type: "image", url: icon };
  return null;
}
