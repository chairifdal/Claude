"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp, rootCategory } from "@/lib/app-data";
import { formatIDR } from "@/lib/format";

const INV = "#AF52DE";
const REST = "#06B6D4";
const GREY = "#8E8E93";
const MAX_CHILDREN = 3; // sub-kategori per kategori induk; sisanya digabung jadi "Lainnya"

/**
 * Hitung simpul & nilai arus uang:
 * Sumber (pemasukan per kategori induk, + "Dari investasi"/"Dari saldo" bila kurang)
 * → Tujuan (pengeluaran per kategori induk, Investasi, Sisa) → Rincian (sub-kategori / akun investasi).
 */
export function buildFlow({ income, expense, inv, categoryById, accountById, t }) {
  const src = {};
  for (const r of income) {
    const root = rootCategory(categoryById[r.category_id], categoryById);
    const k = root?.id || "none";
    src[k] = src[k] || { id: `s:${k}`, name: root?.name || t("Tanpa kategori"), color: root?.color || "#34C759", value: 0 };
    src[k].value += r.amount;
  }
  const sources = Object.values(src).sort((a, b) => b.value - a.value);

  const mid = {};
  for (const r of expense) {
    const cat = categoryById[r.category_id];
    const root = rootCategory(cat, categoryById);
    const k = root?.id || "none";
    mid[k] = mid[k] || { id: `m:${k}`, name: root?.name || t("Tanpa kategori"), color: root?.color || GREY, value: 0, kids: {} };
    mid[k].value += r.amount;
    const ck = cat && root && cat.id !== root.id ? cat.id : "_self";
    mid[k].kids[ck] = mid[k].kids[ck] || { name: ck === "_self" ? t("Umum") : cat.name, color: (ck === "_self" ? null : cat.color) || mid[k].color, value: 0 };
    mid[k].kids[ck].value += r.amount;
  }
  const mids = Object.values(mid).sort((a, b) => b.value - a.value);

  const invNet = inv.in - inv.out;
  if (invNet > 0) {
    const kids = {};
    for (const [id, v] of Object.entries(inv.perAccount)) if (v > 0) kids[id] = { name: accountById[id]?.name || t("Akun"), color: accountById[id]?.color || INV, value: v };
    mids.push({ id: "m:inv", name: t("Investasi"), color: INV, value: invNet, kids });
  } else if (invNet < 0) {
    sources.push({ id: "s:inv", name: t("Dari investasi"), color: INV, value: -invNet });
  }

  const inTotal = sources.reduce((s, n) => s + n.value, 0);
  const outTotal = mids.reduce((s, n) => s + n.value, 0);
  if (inTotal > outTotal) mids.push({ id: "m:rest", name: t("Sisa"), color: REST, value: inTotal - outTotal, kids: {} });
  if (outTotal > inTotal) sources.push({ id: "s:bal", name: t("Dari saldo"), color: GREY, value: outTotal - inTotal });

  // Rincian di kolom kanan: sub-kategori (maks. MAX_CHILDREN + "Lainnya") atau akun investasi
  for (const m of mids) {
    let kids = Object.entries(m.kids || {}).map(([k, v]) => ({ ...v, id: `r:${m.id}:${k}` })).sort((a, b) => b.value - a.value);
    if (!kids.length || (kids.length === 1 && kids[0].id.endsWith(":_self"))) { m.children = []; continue; }
    if (kids.length > MAX_CHILDREN + 1) {
      const rest = kids.slice(MAX_CHILDREN).reduce((s, k) => s + k.value, 0);
      kids = [...kids.slice(0, MAX_CHILDREN), { id: `r:${m.id}:more`, name: t("Lainnya"), color: m.color, value: rest }];
    }
    m.children = kids;
  }
  // Kalau ada kolom kanan, kategori tanpa sub-kategori (juga "Sisa") diteruskan lurus ke kanan
  // dengan namanya sendiri, supaya kolom kanan tidak bolong.
  if (mids.some((m) => m.children.length)) {
    for (const m of mids) {
      if (m.children.length) continue;
      m.pass = true;
      m.children = [{ id: `r:${m.id}:_pass`, name: m.name, color: m.color, value: m.value }];
    }
  }
  const right = mids.flatMap((m) => m.children);
  return { sources, mids, right, total: Math.max(inTotal, outTotal), income: income.reduce((s, r) => s + r.amount, 0), spent: expense.reduce((s, r) => s + r.amount, 0) };
}

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const band = (xa, ya, xb, yb, th) => {
  const xm = (xa + xb) / 2;
  return `M${xa},${ya}C${xm},${ya} ${xm},${yb} ${xb},${yb}L${xb},${yb + th}C${xm},${yb + th} ${xm},${ya + th} ${xa},${ya + th}Z`;
};

/** Diagram Sankey arus uang. `mode` = "rp" | "pct". */
export default function MoneyFlow({ flow, mode = "rp" }) {
  const { hidden } = useApp();
  const [ref, W] = useWidth();
  const fmt = (v) => mode === "pct"
    ? (v / flow.total < 0.01 ? "<1%" : `${Math.round((v / flow.total) * 100)}%`)
    : hidden ? "Rp •••" : formatIDR(v, { compact: true });

  const layout = useMemo(() => {
    if (!W || !flow.total) return null;
    const NW = 6;
    const hasRight = flow.right.length > 0;
    const x0 = 0;
    const x1 = Math.round(W * (hasRight ? 0.42 : 0.62));
    const x2 = Math.round(W * 0.58);
    const k = Math.max(220, Math.min(340, (flow.mids.length + flow.right.length) * 16)) / flow.total;

    const stack = (nodes, minSlot, gap) => {
      let y = 0;
      for (const n of nodes) {
        n.h = Math.max(1.5, n.value * k);
        const slot = Math.max(n.h, minSlot);
        n.y = y + (slot - n.h) / 2;
        n.cy = y + slot / 2;
        y += slot + gap;
      }
      return Math.max(0, y - gap);
    };
    const L = flow.sources.map((n) => ({ ...n }));
    const M = flow.mids.map((n) => ({ ...n }));
    const R = M.flatMap((m) => m.children.map((c) => ({ ...c, parent: m.id })));
    const hs = [stack(L, 2, 4), stack(M, 32, 6), stack(R, 18, 4)];
    const H = Math.max(...hs);
    [L, M, R].forEach((col, i) => { const off = (H - hs[i]) / 2; for (const n of col) { n.y += off; n.cy += off; } });

    const links = [];
    const outL = L.map(() => 0);
    const inM = M.map(() => 0);
    L.forEach((s, i) => M.forEach((m, j) => {
      const th = (s.value * m.value / flow.total) * k;
      if (th <= 0) return;
      links.push({ id: `${s.id}>${m.id}`, d: band(x0 + NW, s.y + outL[i], x1, m.y + inM[j], th), from: s.color, to: m.color, xa: x0 + NW, xb: x1 });
      outL[i] += th; inM[j] += th;
    }));
    const byId = Object.fromEntries(R.map((r) => [r.id, r]));
    for (const m of M) {
      let off = 0;
      for (const c of m.children) {
        const r = byId[c.id];
        const th = c.value * k;
        links.push({ id: `${m.id}>${r.id}`, d: band(x1 + NW, m.y + off, x2, r.y, th), from: m.color, to: r.color, xa: x1 + NW, xb: x2 });
        off += th;
      }
    }
    return { L, M, R, links, H, x0, x1, x2, NW, hasRight };
  }, [W, flow]);

  const maxChars = Math.max(8, Math.floor((W - (layout?.x2 || 0) - 64) / 6.2));
  const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const halo = { paintOrder: "stroke", stroke: "rgb(var(--surface))", strokeWidth: 3, strokeLinejoin: "round" };

  return (
    <div ref={ref} className="w-full">
      {layout && (
        <svg width={W} height={layout.H + 4} viewBox={`0 -2 ${W} ${layout.H + 4}`} role="img" aria-label="Sankey">
          <defs>
            {layout.links.map((l, i) => (
              <linearGradient key={l.id} id={`mf${i}`} gradientUnits="userSpaceOnUse" x1={l.xa} x2={l.xb} y1="0" y2="0">
                <stop offset="0%" stopColor={l.from} stopOpacity=".34" />
                <stop offset="100%" stopColor={l.to} stopOpacity=".34" />
              </linearGradient>
            ))}
          </defs>
          {layout.links.map((l, i) => <path key={l.id} d={l.d} fill={`url(#mf${i})`} />)}
          {layout.L.map((n) => <rect key={n.id} x={layout.x0} y={n.y} width={layout.NW} height={n.h} rx="2" fill={n.color} />)}
          {layout.M.map((n) => <rect key={n.id} x={layout.x1} y={n.y} width={layout.NW} height={n.h} rx="2" fill={n.color} />)}
          {layout.R.map((n) => <rect key={n.id} x={layout.x2} y={n.y} width={layout.NW} height={n.h} rx="2" fill={n.color} />)}
          {layout.M.filter((n) => !n.pass).map((n) => layout.hasRight ? (
            <text key={n.id} x={layout.x1 - 6} textAnchor="end" style={halo}>
              <tspan x={layout.x1 - 6} y={n.cy - 2} className="fill-ink" fontSize="11.5" fontWeight="600">{clip(n.name, 16)}</tspan>
              <tspan x={layout.x1 - 6} y={n.cy + 11} className="fill-ink-soft" fontSize="10.5">{fmt(n.value)}</tspan>
            </text>
          ) : (
            <text key={n.id} x={layout.x1 + layout.NW + 6} y={n.cy + 4} style={halo}>
              <tspan className="fill-ink" fontSize="11.5" fontWeight="600">{clip(n.name, 18)}</tspan>
              <tspan className="fill-ink-soft" fontSize="10.5" dx="5">{fmt(n.value)}</tspan>
            </text>
          ))}
          {layout.R.map((n) => (
            <text key={n.id} x={layout.x2 + layout.NW + 6} y={n.cy + 4} style={halo}>
              <tspan className="fill-ink" fontSize="11.5" fontWeight="600">{clip(n.name, maxChars)}</tspan>
              <tspan className="fill-ink-soft" fontSize="10.5" dx="5">{fmt(n.value)}</tspan>
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}
