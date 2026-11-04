"use client";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from "recharts";
import { useApp, useTransactions, rootCategory } from "@/lib/app-data";
import { useTheme, chartColors } from "@/lib/theme";
import { periodRange, periodLabel, formatIDR, firstName } from "@/lib/format";
import { lastPeriods, niceMax, toISODate } from "@/lib/analytics";
import { rangeLabel } from "@/lib/period";
import { CategoryIcon, Money, PageHeader, Avatar, Empty } from "@/components/ui";
import PeriodBar from "@/components/PeriodBar";
import { TxRow } from "@/components/TxList";

const ACCENT = "#007AFF";
const NEUTRAL = "#B3D7FF";

function initial() {
  const q = new URLSearchParams(window.location.search);
  const p = ["week", "month", "year", "range"].includes(q.get("p")) ? q.get("p") : "month";
  const d = q.get("d") ? new Date(`${q.get("d")}T12:00:00`) : new Date();
  const range = { from: q.get("f") || toISODate(new Date(Date.now() - 29 * 86400000)), to: q.get("t") || toISODate(new Date()) };
  return { period: p, anchor: isNaN(d) ? new Date() : d, who: q.get("w") || "all", range };
}

export default function CategoryDetail() {
  const C = chartColors(useTheme().isDark);
  const { id } = useParams();
  const { categoryById, categories, budgets, people, user, hidden, t, countsInStats, statRows, cycle } = useApp();
  const [{ period, anchor, who, range }, setSt] = useState(initial);
  const [showAll, setShowAll] = useState(false);
  const cat = categoryById[id];
  const root = rootCategory(cat, categoryById);
  const isRoot = cat && !cat.parent_id;

  const N = 6;
  const ctx = { cycle: who === user?.id || who === "all" ? cycle : null, range };
  const { start, end } = periodRange(period, anchor, ctx);
  // Rentang bebas: 6 rentang berurutan dengan panjang yang sama
  const periods = period === "range"
    ? Array.from({ length: N }, (_, i) => { const len = end - start; const e = new Date(end.getTime() - (N - 1 - i) * len); return { anchor: e, start: new Date(e.getTime() - len), end: e, total: 0 }; })
    : lastPeriods(period, anchor, N, ctx);
  const { rows } = useTransactions({ from: periods[0].start, to: end, limit: 10000 });

  const ids = useMemo(() => new Set(isRoot ? [id, ...categories.filter((c) => c.parent_id === id).map((c) => c.id)] : [id]), [id, isRoot, categories]);

  const d = useMemo(() => {
    const all = statRows(rows);
    const inCat = all.filter((r) => countsInStats(r) && ids.has(r.category_id) && (who === "all" || r.created_by === who));
    const series = periods.map((p) => ({ ...p, label: period === "range" ? rangeLabel(p.start, p.end) : periodLabel(period, p.anchor, ctx), total: 0 }));
    for (const r of inCat) {
      const dt = new Date(r.occurred_at);
      const s = series.find((p) => dt >= p.start && dt < p.end);
      if (s) s.total += r.amount;
    }
    const cur = inCat.filter((r) => new Date(r.occurred_at) >= start);
    const kind = cat?.kind || "expense";
    const allSameKind = all.filter((r) => countsInStats(r) && r.type === kind && new Date(r.occurred_at) >= start && (who === "all" || r.created_by === who));
    const allTotal = allSameKind.reduce((s, r) => s + r.amount, 0);
    const subs = {};
    for (const r of cur) {
      const c = categoryById[r.category_id];
      const key = c?.parent_id ? c.id : "_self";
      subs[key] = subs[key] || { name: key === "_self" ? t("{cat} (umum)", { cat: cat?.name }) : c.name, color: key === "_self" ? cat?.color : c.color, total: 0 };
      subs[key].total += r.amount;
    }
    const byPerson = {};
    for (const r of cur) byPerson[r.created_by] = (byPerson[r.created_by] || 0) + r.amount;
    const total = series[series.length - 1].total;
    const prevTotal = series[series.length - 2]?.total || 0;
    const past = series.slice(0, -1).filter((s) => s.total > 0);
    const avg = past.length ? past.reduce((s, x) => s + x.total, 0) / past.length : 0;
    return { series, cur, total, prevTotal, avg, allTotal, subs: Object.values(subs).sort((a, b) => b.total - a.total), byPerson: Object.entries(byPerson).sort((a, b) => b[1] - a[1]) };
  }, [rows, ids, who, periods, period, start, cat, categoryById, countsInStats, t]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cat) return <div><PageHeader title={t("Kategori")} back="/analisis" /><Empty title={t("Kategori tidak ditemukan")} /></div>;

  const delta = d.total - d.prevTotal;
  const worse = cat.kind === "expense" ? delta > 0 : delta < 0;
  const budget = cat.kind === "expense" && period === "month" ? budgets.find((b) => b.category_id === root?.id) : null;
  const budgetSpent = budget && root?.id === id ? d.total : null;
  const yMax = niceMax(Math.max(...d.series.map((s) => s.total), d.avg, 0));
  const maxSub = d.subs[0]?.total || 1;
  const prevWord = period === "range" ? t("rentang") : t(period === "week" ? "minggu" : period === "year" ? "tahun" : ctx.cycle && !ctx.cycle.isCalendar ? "periode" : "bulan");

  return (
    <div>
      <PageHeader title={cat.name} subtitle={cat.parent_id ? t("Sub-kategori dari {cat}", { cat: root?.name }) : cat.kind === "expense" ? t("Kategori pengeluaran") : t("Kategori pemasukan")} back="/analisis"
        right={<CategoryIcon category={cat} size={40} />} />

      <div className="space-y-3">
        <PeriodBar period={period} anchor={anchor} ctx={ctx} allowRange range={range} onRange={(r) => setSt((s) => ({ ...s, range: r }))}
          onChange={(p, a) => setSt((s) => ({ ...s, period: p, anchor: a }))} />
        {who !== "all" && (
          <button className="chip h-10 border border-brand-600 bg-brand-600 text-white" onClick={() => setSt((s) => ({ ...s, who: "all" }))}>
            {who === user?.id ? t("Saya") : firstName(people[who])} · {t("tampilkan semua")}
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="card flex flex-col p-6">
            <p className="text-[16px] text-ink-soft">{periodLabel(period, anchor, ctx)}</p>
            <Money value={d.total} className="block text-[32px] font-semibold leading-tight" />
            <p className="mt-1 text-[16px] text-ink-soft">
              {d.allTotal ? t("{pct}% dari semua {kind}", { pct: Math.round((d.total / d.allTotal) * 100), kind: cat.kind === "expense" ? t("pengeluaran") : t("pemasukan") }) : ""}
              {" · "}{t("{n} catatan", { n: d.cur.length })}
            </p>
            <div className="mt-4 grid grid-cols-2 divide-x divide-line">
              <div className="pr-4">
                <p className="text-[14px] text-ink-soft">{t("vs {period} lalu", { period: prevWord })}</p>
                {d.prevTotal ? (
                  <p className={`tabular text-[18px] font-medium ${delta === 0 ? "text-ink-soft" : worse ? "text-expense" : "text-income"}`}>
                    {hidden ? "Rp •••" : formatIDR(delta, { sign: true, compact: true })}
                  </p>
                ) : <p className="text-[18px] text-ink-mute">—</p>}
              </div>
              <div className="pl-4">
                <p className="text-[14px] text-ink-soft">{t("Rata-rata {n} {period} terakhir", { n: N - 1, period: prevWord })}</p>
                <Money value={Math.round(d.avg)} compact className="block text-[18px] font-medium" dots={4} />
              </div>
            </div>

            {budget && budgetSpent !== null && (
              <div className="mt-5">
                <div className="flex items-baseline justify-between text-[14px]">
                  <span className="text-ink-soft">{t("Anggaran bulan ini")}</span>
                  <span className={budgetSpent > budget.amount ? "font-medium text-expense" : "text-ink-soft"}>
                    {Math.round((budgetSpent / budget.amount) * 100)}% · <Money value={budget.amount} dots={4} />
                  </span>
                </div>
                <div className="mt-2 flex h-2 gap-0.5">
                  <div className="h-full flex-1 overflow-hidden rounded-full bg-rule" style={budgetSpent > budget.amount ? { flexGrow: budget.amount / budgetSpent } : undefined}>
                    <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(1, budgetSpent / budget.amount) * 100}%` }} />
                  </div>
                  {budgetSpent > budget.amount && <div className="h-full rounded-full bg-expense" style={{ flexGrow: 1 - budget.amount / budgetSpent }} />}
                </div>
                {period === "month" && budgetSpent <= budget.amount && periodRange(period, anchor, ctx).end > new Date() && (
                  <p className="mt-1.5 text-[14px] text-ink-soft">
                    {t("Sisa")} <Money value={budget.amount - budgetSpent} dots={4} className="text-ink" /> · {t("aman {amount}/hari", { amount: hidden ? "Rp •••" : formatIDR(Math.floor((budget.amount - budgetSpent) / Math.max(1, Math.round((end - new Date()) / 86400000)))) })}
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 flex items-baseline justify-between gap-3">
              <h2 className="section-title">{t("Tren {n} {period}", { n: N, period: prevWord })}</h2>
              <span className="flex items-center gap-1.5 text-[14px] text-ink-soft"><i className="inline-block h-0 w-4 border-t border-dashed border-ink-soft" /> {t("rata-rata")}</span>
            </div>
            <div className="mt-3 h-52 min-h-52 flex-1">
              <ResponsiveContainer>
                <BarChart data={d.series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <YAxis width={44} axisLine={false} tickLine={false} domain={[0, yMax]} tickCount={5}
                    tick={{ fontSize: 12, fill: C.tick }} tickFormatter={(v) => (hidden ? "" : formatIDR(v, { compact: true }).replace("Rp ", ""))} />
                  <XAxis dataKey="label" axisLine={{ stroke: C.axis }} tickLine={false} tick={{ fontSize: 12, fill: C.tick }}
                    interval={0} tickFormatter={(v) => (period === "month" ? String(v).split(" ")[0].slice(0, 3) : period === "week" ? String(v).split("–")[0] : v)} />
                  <Tooltip cursor={{ fill: C.cursor }} formatter={(v) => [hidden ? "Rp •••••" : formatIDR(v), cat.name]}
                    contentStyle={{ borderRadius: 12, border: `1px solid ${C.tipBorder}`, background: C.tipBg, boxShadow: "none", fontSize: 14 }} />
                  {d.avg > 0 && <ReferenceLine y={d.avg} stroke={C.ref} strokeDasharray="4 4" />}
                  <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={28}>
                    {d.series.map((s, i) => <Cell key={i} fill={i === d.series.length - 1 ? C.accent : C.soft} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
        </section>

        <section className="card p-6">
          {isRoot && d.subs.length > 0 && (
            <div className="mb-6">
              <h2 className="section-title">{t("Rincian sub-kategori")}</h2>
              <ul className="mt-3 space-y-3">
                {d.subs.map((s, i) => (
                  <li key={s.name}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[16px]">{s.name}</span>
                      <span className="flex-none"><Money value={s.total} className="text-[16px] font-medium" dots={5} />
                        <span className="tabular ml-2 inline-block w-10 text-right text-[14px] text-ink-soft">{Math.round((s.total / d.total) * 100)}%</span></span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-rule"><div className="h-full rounded-full" style={{ width: `${(s.total / maxSub) * 100}%`, background: s.color || cat.color || ACCENT }} /></div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {d.byPerson.length > 0 && (
            <div>
              <h2 className="section-title">{t("Per orang")}</h2>
              <ul className="mt-3 space-y-3">
                {d.byPerson.map(([pid, v]) => (
                  <li key={pid} className="flex items-center gap-3">
                    <Avatar profile={people[pid]} size={32} />
                    <span className="flex-1 text-[16px]">{pid === user?.id ? t("Saya") : firstName(people[pid]) || t("Mantan anggota")}</span>
                    <Money value={v} className="text-[16px] font-medium" dots={5} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={d.byPerson.length || (isRoot && d.subs.length) ? "mt-6" : ""}>
            <div className="flex items-baseline justify-between">
              <h2 className="section-title">{t("Catatan")}</h2>
              {d.cur.length > 6 && (
                <button className="text-[14px] font-medium text-brand-600" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? t("Lebih sedikit") : t("Semua {n}", { n: d.cur.length })}
                </button>
              )}
            </div>
            {d.cur.length ? (
              <div className="-mx-3 mt-2">{(showAll ? d.cur : d.cur.slice(0, 6)).map((tx) => <TxRow key={tx.id} tx={tx} />)}</div>
            ) : (
              <div className="mt-3"><Empty title={t("Tidak ada catatan di periode ini")} /></div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
