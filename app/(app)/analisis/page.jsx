"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from "recharts";
import { ChevronRight } from "lucide-react";
import { useApp, useTransactions, rootCategory } from "@/lib/app-data";
import { useTheme, chartColors } from "@/lib/theme";
import { periodRange, shiftPeriod, periodLabel, formatIDR, firstName } from "@/lib/format";
import { buckets, daysIn, niceMax, toISODate } from "@/lib/analytics";
import { CategoryIcon, Money, PageHeader, Avatar, Empty } from "@/components/ui";
import PeriodBar, { FilterChip } from "@/components/PeriodBar";

const ACCENT = "#007AFF";
const NEUTRAL = "#B3D7FF";

function loadState() {
  try { const s = JSON.parse(sessionStorage.getItem("kk-analysis") || "null"); if (s) return { ...s, anchor: new Date(s.anchor) }; } catch {}
  return { period: "month", anchor: new Date(), kind: "expense", who: "all", group: "category", view: "list" };
}

export default function AnalysisPage() {
  const C = chartColors(useTheme().isDark);
  const { categoryById, people, user, hidden, t, countsInStats, statRows } = useApp();
  const [st, setSt] = useState(loadState);
  const set = (patch) => setSt((s) => ({ ...s, ...patch }));
  useEffect(() => { try { sessionStorage.setItem("kk-analysis", JSON.stringify(st)); } catch {} }, [st]);
  const { period, anchor, kind, who, group, view } = st;

  const { start, end } = periodRange(period, anchor);
  const prev = periodRange(period, shiftPeriod(period, anchor, -1));
  const { rows } = useTransactions({ from: prev.start, to: end, limit: 10000 });

  const data = useMemo(() => {
    const keep = (r) => countsInStats(r) && r.type === kind && (who === "all" || r.created_by === who);
    const all = statRows(rows);
    const cur = all.filter((r) => keep(r) && new Date(r.occurred_at) >= start);
    const before = all.filter((r) => keep(r) && new Date(r.occurred_at) < start);
    const total = cur.reduce((s, r) => s + r.amount, 0);
    const prevTotal = before.reduce((s, r) => s + r.amount, 0);

    const groups = {};
    for (const r of cur) {
      const cat = categoryById[r.category_id];
      const root = rootCategory(cat, categoryById);
      const node = group === "sub" ? cat : root;
      const key = node?.id || "none";
      groups[key] = groups[key] || { id: key, cat: node || { name: t("Tanpa kategori"), icon: "circle" }, parent: group === "sub" && cat?.parent_id ? root : null, total: 0, n: 0 };
      groups[key].total += r.amount; groups[key].n++;
    }
    const bs = buckets(period, anchor);
    for (const r of cur) {
      const d = new Date(r.occurred_at);
      const b = bs.find((x) => d >= x.start && d < x.end);
      if (b) b.total += r.amount;
    }
    const byPerson = {};
    for (const r of cur) byPerson[r.created_by] = (byPerson[r.created_by] || 0) + r.amount;
    return { total, prevTotal, groups: Object.values(groups).sort((a, b) => b.total - a.total), bs, byPerson: Object.entries(byPerson).sort((a, b) => b[1] - a[1]), count: cur.length };
  }, [rows, kind, who, group, period, anchor, start, categoryById, countsInStats, t]);

  const days = daysIn(period, anchor);
  const avgPerDay = data.total / days;
  const delta = data.total - data.prevTotal;
  const worse = kind === "expense" ? delta > 0 : delta < 0;
  const maxGroup = data.groups[0]?.total || 1;
  const avgBucket = data.bs.length ? data.total / (period === "year" ? 12 : days) : 0;
  const yMax = niceMax(Math.max(...data.bs.map((b) => b.total), 0));
  const now = new Date();

  const peopleOptions = [{ value: "all", label: t("Semua") }, ...Object.values(people).map((p) => ({ value: p.id, label: p.id === user?.id ? t("Saya") : firstName(p) }))];
  const qs = `p=${period}&d=${toISODate(anchor)}&w=${who}`;

  return (
    <div>
      <PageHeader title={t("Analisis")} subtitle={periodLabel(period, anchor)} />

      <div className="space-y-3">
        <PeriodBar period={period} anchor={anchor} onChange={(p, a) => set({ period: p, anchor: a })} />
        <div className="flex gap-2" aria-label={t("Filter")}>
          <FilterChip label={t("Jenis")} value={kind} onChange={(v) => set({ kind: v })}
            options={[{ value: "expense", label: t("Keluar") }, { value: "income", label: t("Masuk") }]} />
          <FilterChip label={t("Orang")} value={who} onChange={(v) => set({ who: v })} options={peopleOptions} />
          <FilterChip label={t("Kelompok")} value={group} onChange={(v) => set({ group: v })}
            options={[{ value: "category", label: t("Kategori") }, { value: "sub", label: t("Sub-kategori") }]} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Kiri: ringkasan + tren (desktop selalu tampil; HP lewat tab) */}
        <section className="card flex flex-col p-6">
          <p className="text-[16px] text-ink-soft">{kind === "expense" ? t("Total pengeluaran") : t("Total pemasukan")}</p>
          <Money value={data.total} className="block text-[32px] font-semibold leading-tight" />
          <div className="mt-3 grid grid-cols-2 divide-x divide-line">
            <div className="pr-4">
              <p className="text-[14px] text-ink-soft">{t("vs {period} lalu", { period: t(period === "week" ? "minggu" : period === "year" ? "tahun" : "bulan") })}</p>
              {data.prevTotal ? (
                <p className={`tabular text-[18px] font-medium ${delta === 0 ? "text-ink-soft" : worse ? "text-expense" : "text-income"}`}>
                  {hidden ? "Rp •••" : formatIDR(delta, { sign: true, compact: true })}
                  <span className="ml-1 text-[14px] font-normal text-ink-soft">({delta >= 0 ? "+" : ""}{Math.round((delta / data.prevTotal) * 100)}%)</span>
                </p>
              ) : <p className="text-[18px] text-ink-mute">—</p>}
            </div>
            <div className="pl-4">
              <p className="text-[14px] text-ink-soft">{t("Rata-rata per hari")}</p>
              <Money value={Math.round(avgPerDay)} compact className="block text-[18px] font-medium" dots={4} />
            </div>
          </div>

          <div role="tablist" className="mt-6 flex gap-6 border-b border-line lg:hidden">
            {[["list", t("Daftar")], ["trend", t("Tren")]].map(([v, l]) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => set({ view: v })}
                className={`-mb-px border-b-2 pb-2.5 text-[16px] ${view === v ? "border-brand-600 font-semibold text-brand-600" : "border-transparent text-ink-soft"}`}>{l}</button>
            ))}
          </div>
          <h2 className="section-title mt-6 hidden lg:block">{t("Tren")}</h2>

          <div className={`${view === "trend" ? "flex" : "hidden"} mt-4 flex-1 flex-col lg:mt-2 lg:flex`}>
            <p className="text-[14px] text-ink-soft">{period === "year" ? t("Per bulan") : t("Per hari")} · <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0 w-4 border-t border-dashed border-ink-soft" /> {t("rata-rata")} {hidden ? "" : formatIDR(Math.round(avgBucket), { compact: true })}</span></p>
            <div className="mt-3 h-56 min-h-56 flex-1">
              <ResponsiveContainer>
                <BarChart data={data.bs} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <YAxis width={44} axisLine={false} tickLine={false} domain={[0, yMax]} tickCount={5}
                    tick={{ fontSize: 12, fill: C.tick }} tickFormatter={(v) => (hidden ? "" : formatIDR(v, { compact: true }).replace("Rp ", ""))} />
                  <XAxis dataKey="label" axisLine={{ stroke: C.axis }} tickLine={false} tick={{ fontSize: 12, fill: C.tick }}
                    interval={period === "month" ? 4 : 0} />
                  <Tooltip cursor={{ fill: C.cursor }} formatter={(v) => [hidden ? "Rp •••••" : formatIDR(v), kind === "expense" ? t("Keluar") : t("Masuk")]}
                    contentStyle={{ borderRadius: 12, border: `1px solid ${C.tipBorder}`, background: C.tipBg, boxShadow: "none", fontSize: 14 }} />
                  {avgBucket > 0 && <ReferenceLine y={avgBucket} stroke={C.ref} strokeDasharray="4 4" />}
                  <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={period === "month" ? 10 : 28}>
                    {data.bs.map((b, i) => <Cell key={i} fill={b.start <= now && now < b.end ? C.accent : b.start > now ? C.future : C.soft} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {data.bs.some((b) => b.total > 0) && (() => {
              const peak = [...data.bs].sort((a, b) => b.total - a.total)[0];
              return <p className="mt-2 text-[14px] text-ink-soft">{t("Tertinggi: {label}, {amount}", { label: peak.label, amount: hidden ? "Rp •••" : formatIDR(peak.total) })}</p>;
            })()}
          </div>

          <div className={`${view === "list" ? "block" : "hidden"} lg:hidden`}>
            <GroupList data={data} maxGroup={maxGroup} qs={qs} t={t} />
          </div>
        </section>

        {/* Kanan (desktop): daftar kategori + per orang dalam satu kartu */}
        <section className="card hidden flex-col p-6 lg:flex">
          <h2 className="section-title">{group === "sub" ? t("Sub-kategori") : t("Kategori")}</h2>
          <GroupList data={data} maxGroup={maxGroup} qs={qs} t={t} />
          <div className="mt-auto border-t border-rule pt-5">
            <PersonList data={data} people={people} user={user} who={who} set={set} t={t} />
          </div>
        </section>

        <section className="card p-6 lg:hidden">
          <PersonList data={data} people={people} user={user} who={who} set={set} t={t} />
        </section>
      </div>
    </div>
  );
}

function GroupList({ data, maxGroup, qs, t }) {
  if (!data.groups.length) return <div className="mt-4"><Empty title={t("Tidak ada transaksi")} text={t("Belum ada catatan di periode ini dengan filter tersebut.")} /></div>;
  return (
    <ul className="mt-3">
      {data.groups.map((g, i) => (
        <li key={g.id}>
          <Link href={g.id === "none" ? "#" : `/analisis/kategori/${g.id}?${qs}`} aria-disabled={g.id === "none"}
            className="flex items-center gap-3 rounded-control px-1 py-2.5 hover:bg-raised">
            <CategoryIcon category={g.cat} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[16px]">{g.cat.name}{g.parent && <span className="text-ink-soft"> · {g.parent.name}</span>}</span>
                <span className="flex-none">
                  <Money value={g.total} className="text-[16px] font-medium" dots={5} />
                  <span className="tabular ml-2 inline-block w-10 text-right text-[14px] text-ink-soft">{Math.round((g.total / data.total) * 100)}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-rule">
                <div className="h-full rounded-full" style={{ width: `${(g.total / maxGroup) * 100}%`, background: g.cat?.color || ACCENT }} />
              </div>
            </div>
            <ChevronRight className="h-4 w-4 flex-none text-ink-mute" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PersonList({ data, people, user, who, set, t }) {
  return (
    <>
      <h2 className="section-title">{t("Per orang")}</h2>
      {data.byPerson.length === 0 ? (
        <p className="mt-3 text-[14px] text-ink-soft">{t("Belum ada catatan.")}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {data.byPerson.map(([id, v]) => (
            <li key={id}>
              <button onClick={() => set({ who: who === id ? "all" : id })} className="flex w-full items-center gap-3 text-left">
                <Avatar profile={people[id]} size={32} />
                <span className="flex-1 text-[16px]">{id === user?.id ? t("Saya") : firstName(people[id]) || t("Mantan anggota")}</span>
                <Money value={v} className="text-[16px] font-medium" dots={5} />
                <span className="tabular w-10 text-right text-[14px] text-ink-soft">{Math.round((v / data.total) * 100)}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[14px] text-ink-soft">{t("{n} catatan di periode ini", { n: data.count })}</p>
    </>
  );
}
