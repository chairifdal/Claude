"use client";
import { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useApp, useTransactions, rootCategory } from "@/lib/app-data";
import { monthRange, monthLabel, formatIDR, firstName } from "@/lib/format";
import { CategoryIcon, Money, PageHeader, Segmented, Avatar, Empty } from "@/components/ui";
import MonthSwitcher from "@/components/MonthSwitcher";

const ACCENT = "#1d5fd6";
const NEUTRAL = "#b9c2cc";

export default function AnalysisPage() {
  const { categoryById, people, hidden } = useApp();
  const [month, setMonth] = useState(() => monthRange().start);
  const [kind, setKind] = useState("expense");
  const [openRoot, setOpenRoot] = useState(null);

  const sixStart = useMemo(() => new Date(month.getFullYear(), month.getMonth() - 5, 1), [month]);
  const { end } = useMemo(() => monthRange(month), [month]);
  const { rows } = useTransactions({ from: sixStart, to: end, limit: 5000 });

  const data = useMemo(() => {
    const key = (d) => `${d.getFullYear()}-${d.getMonth()}`;
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(month.getFullYear(), month.getMonth() - i, 1);
      trend.push({ key: key(d), label: monthLabel(d, { month: "short" }), income: 0, expense: 0 });
    }
    const idx = Object.fromEntries(trend.map((t, i) => [t.key, i]));
    const current = key(month);
    const roots = {};
    const byPerson = {};
    let total = 0;
    for (const t of rows) {
      if (t.type === "transfer") continue;
      const k = key(new Date(t.occurred_at));
      if (idx[k] !== undefined) trend[idx[k]][t.type] += t.amount;
      if (k !== current || t.type !== kind) continue;
      total += t.amount;
      const cat = categoryById[t.category_id];
      const root = rootCategory(cat, categoryById);
      const rk = root?.id || "none";
      roots[rk] = roots[rk] || { id: rk, cat: root || { name: "Tanpa kategori", color: "#94A3B8" }, total: 0, subs: {} };
      roots[rk].total += t.amount;
      const sk = cat && cat.parent_id ? cat.id : "_self";
      roots[rk].subs[sk] = roots[rk].subs[sk] || { name: sk === "_self" ? `${roots[rk].cat.name} (umum)` : cat.name, total: 0 };
      roots[rk].subs[sk].total += t.amount;
      byPerson[t.created_by] = (byPerson[t.created_by] || 0) + t.amount;
    }
    return {
      trend, total,
      roots: Object.values(roots).sort((a, b) => b.total - a.total),
      people: Object.entries(byPerson).sort((a, b) => b[1] - a[1]),
    };
  }, [rows, month, kind, categoryById]);

  const cur = data.trend[data.trend.length - 1];
  const prev = data.trend[data.trend.length - 2];
  const delta = cur && prev ? cur.expense - prev.expense : 0;
  const maxRoot = data.roots[0]?.total || 1;
  const yMax = niceMax(Math.max(...data.trend.map((t) => Math.max(t.income, t.expense)), 0));

  return (
    <div>
      <PageHeader title="Analisis" subtitle={`Pengeluaran ${monthLabel(month)}`} />
      <div className="max-w-[360px]"><MonthSwitcher value={month} onChange={(d) => { setMonth(d); setOpenRoot(null); }} /></div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <section className="card p-6">
          <div className="grid grid-cols-2 divide-x divide-line">
            <div className="pr-4">
              <p className="text-[14px] text-ink-soft">Pengeluaran</p>
              <Money value={cur?.expense} className="block text-[30px] font-semibold leading-tight" dots={5} />
              <p className="mt-1 text-[14px] text-ink-soft">
                {prev?.expense ? <><span className={delta > 0 ? "font-medium text-expense" : "font-medium text-income"}>{hidden ? "•••" : formatIDR(delta, { sign: true, compact: true })}</span> vs {monthLabel(new Date(month.getFullYear(), month.getMonth() - 1, 1), { month: "long" })}</> : "Belum ada data bulan lalu"}
              </p>
            </div>
            <div className="pl-4">
              <p className="text-[14px] text-ink-soft">Pemasukan</p>
              <Money value={cur?.income} className="block text-[22px] font-medium leading-tight text-income" dots={5} />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <h2 className="section-title">Tren 6 bulan</h2>
            <p className="flex gap-3 text-[14px] text-ink-soft">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: ACCENT }} /> Keluar</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: NEUTRAL }} /> Masuk</span>
            </p>
          </div>
          <div className="mt-3 h-52">
            <ResponsiveContainer>
              <BarChart data={data.trend} barGap={2} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e5e5e5" />
                <YAxis width={44} axisLine={false} tickLine={false} domain={[0, yMax]} tickCount={5}
                  tick={{ fontSize: 12, fill: "#5c6064" }} tickFormatter={(v) => (hidden ? "" : formatIDR(v, { compact: true }).replace("Rp ", ""))} />
                <XAxis dataKey="label" axisLine={{ stroke: "#c8cdd2" }} tickLine={false} tick={{ fontSize: 12, fill: "#5c6064" }} />
                <Tooltip cursor={{ fill: "#f3f5f7" }} formatter={(v, n) => [hidden ? "Rp •••••" : formatIDR(v), n === "income" ? "Masuk" : "Keluar"]}
                  contentStyle={{ borderRadius: 10, border: "1px solid #e6e6e6", boxShadow: "none", fontSize: 14 }} />
                <Bar dataKey="expense" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="income" fill={NEUTRAL} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="space-y-6">
          <section className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">Per kategori</h2>
              <Segmented value={kind} onChange={(k) => { setKind(k); setOpenRoot(null); }} className="w-[220px]" options={[
                { value: "expense", label: "Keluar" },
                { value: "income", label: "Masuk" },
              ]} />
            </div>
            {data.roots.length === 0 ? (
              <div className="mt-4"><Empty title="Tidak ada transaksi" text={`Belum ada ${kind === "expense" ? "pengeluaran" : "pemasukan"} di ${monthLabel(month)}.`} /></div>
            ) : (
              <ul className="mt-4 space-y-1">
                {data.roots.map((r, i) => {
                  const open = openRoot === r.id;
                  const subs = Object.values(r.subs).sort((a, b) => b.total - a.total);
                  const hasSubs = subs.length > 1 || !subs[0]?.name.endsWith("(umum)");
                  return (
                    <li key={r.id} className={`rounded-control ${open ? "bg-raised" : ""}`}>
                      <button onClick={() => hasSubs && setOpenRoot(open ? null : r.id)} aria-expanded={hasSubs ? open : undefined}
                        className="flex w-full items-center gap-3 px-2 py-2.5 text-left">
                        <CategoryIcon category={r.cat} size={40} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[16px]">{r.cat.name}</span>
                            <span className="flex-none">
                              <Money value={r.total} className="text-[16px] font-medium" dots={5} />
                              <span className="tabular ml-2 inline-block w-10 text-right text-[14px] text-ink-soft">{Math.round((r.total / data.total) * 100)}%</span>
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-rule">
                            <div className="h-full rounded-full" style={{ width: `${(r.total / maxRoot) * 100}%`, background: i === 0 ? ACCENT : NEUTRAL }} />
                          </div>
                        </div>
                        {hasSubs ? (open ? <ChevronDown className="h-4 w-4 text-ink-mute" /> : <ChevronRight className="h-4 w-4 text-ink-mute" />) : <span className="w-4" />}
                      </button>
                      {open && (
                        <ul className="space-y-2 pb-3 pl-[64px] pr-9">
                          {subs.map((s) => (
                            <li key={s.name} className="flex items-baseline justify-between gap-2 text-[14px]">
                              <span className="truncate text-ink-soft">{s.name}</span>
                              <Money value={s.total} className="flex-none font-medium" dots={4} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {data.people.length > 1 && (
            <section className="card p-6">
              <h2 className="section-title">Dicatat oleh</h2>
              <ul className="mt-3 space-y-3">
                {data.people.map(([id, v]) => (
                  <li key={id} className="flex items-center gap-3">
                    <Avatar profile={people[id]} size={32} />
                    <span className="flex-1 text-[16px]">{firstName(people[id]) || "Mantan anggota"}</span>
                    <Money value={v} className="text-[16px] font-medium" dots={5} />
                    <span className="tabular w-10 text-right text-[14px] text-ink-soft">{Math.round((v / data.total) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/** Puncak sumbu yang bulat dan di atas nilai maksimum */
function niceMax(v) {
  if (v <= 0) return 100000;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const steps = [1, 2, 2.5, 5, 10];
  for (const s of steps) if (s * pow * 1.0001 > v * 1.05) return s * pow;
  return 10 * pow;
}
