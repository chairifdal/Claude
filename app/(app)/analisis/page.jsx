"use client";
import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useApp, useTransactions, rootCategory } from "@/lib/app-data";
import { monthRange, monthLabel, formatIDR, firstName } from "@/lib/format";
import { CategoryIcon, Money, PageHeader, Segmented, Avatar, Empty } from "@/components/ui";
import MonthSwitcher from "@/components/MonthSwitcher";

export default function AnalysisPage() {
  const { categoryById, people, hidden } = useApp();
  const [month, setMonth] = useState(() => monthRange().start);
  const [kind, setKind] = useState("expense");
  const [openRoot, setOpenRoot] = useState(null);

  const sixStart = useMemo(() => new Date(month.getFullYear(), month.getMonth() - 5, 1), [month]);
  const { end } = useMemo(() => monthRange(month), [month]);
  const { rows } = useTransactions({ from: sixStart, to: end, limit: 5000 });

  const data = useMemo(() => {
    const monthKey = (d) => `${d.getFullYear()}-${d.getMonth()}`;
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(month.getFullYear(), month.getMonth() - i, 1);
      trend.push({ key: monthKey(d), label: monthLabel(d, { month: "short" }), income: 0, expense: 0 });
    }
    const tIdx = Object.fromEntries(trend.map((t, i) => [t.key, i]));
    const current = monthKey(month);
    const roots = {};
    const people_ = {};
    let total = 0;
    for (const t of rows) {
      if (t.type === "transfer") continue;
      const k = monthKey(new Date(t.occurred_at));
      if (tIdx[k] !== undefined) trend[tIdx[k]][t.type] += t.amount;
      if (k !== current || t.type !== kind) continue;
      total += t.amount;
      const cat = categoryById[t.category_id];
      const root = rootCategory(cat, categoryById);
      const rk = root?.id || "none";
      roots[rk] = roots[rk] || { id: rk, cat: root || { name: "Tanpa kategori", color: "#94A3B8" }, total: 0, subs: {} };
      roots[rk].total += t.amount;
      const sk = cat && cat.parent_id ? cat.id : "_self";
      roots[rk].subs[sk] = roots[rk].subs[sk] || { name: sk === "_self" ? "Umum" : cat.name, color: cat?.color, total: 0 };
      roots[rk].subs[sk].total += t.amount;
      people_[t.created_by] = (people_[t.created_by] || 0) + t.amount;
    }
    return {
      trend, total,
      roots: Object.values(roots).sort((a, b) => b.total - a.total),
      people: Object.entries(people_).sort((a, b) => b[1] - a[1]),
    };
  }, [rows, month, kind, categoryById]);

  const cur = data.trend[data.trend.length - 1];

  return (
    <div>
      <PageHeader title="Analisis" subtitle="Ke mana uang kita pergi" />
      <MonthSwitcher value={month} onChange={setMonth} />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="card p-3.5">
          <p className="text-[12px] font-semibold text-ink-mute">Pemasukan</p>
          <Money value={cur?.income} compact className="text-[18px] font-extrabold text-income" dots={5} />
        </div>
        <div className="card p-3.5">
          <p className="text-[12px] font-semibold text-ink-mute">Pengeluaran</p>
          <Money value={cur?.expense} compact className="text-[18px] font-extrabold text-expense" dots={5} />
        </div>
      </div>

      <section className="card mt-3 p-4">
        <Segmented value={kind} onChange={(k) => { setKind(k); setOpenRoot(null); }} options={[
          { value: "expense", label: "Pengeluaran", activeClass: "text-expense" },
          { value: "income", label: "Pemasukan", activeClass: "text-income" },
        ]} />
        {data.roots.length === 0 ? (
          <Empty title="Belum ada data" text="Tidak ada transaksi di bulan ini." />
        ) : (
          <>
            <div className="relative mx-auto mt-2 h-56 w-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data.roots} dataKey="total" innerRadius={72} outerRadius={104} paddingAngle={2} cornerRadius={6} stroke="none"
                    onClick={(d) => setOpenRoot(d.id === openRoot ? null : d.id)}>
                    {data.roots.map((r) => <Cell key={r.id} fill={r.cat.color} opacity={openRoot && openRoot !== r.id ? 0.3 : 1} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="text-[12px] font-semibold text-ink-mute">Total</p>
                  <Money value={data.total} compact className="text-[20px] font-extrabold" dots={5} />
                </div>
              </div>
            </div>

            <div className="mt-2 space-y-1">
              {data.roots.map((r) => {
                const open = openRoot === r.id;
                const subs = Object.values(r.subs).sort((a, b) => b.total - a.total);
                const pct = (r.total / data.total) * 100;
                return (
                  <div key={r.id} className={`rounded-2xl transition ${open ? "bg-canvas" : ""}`}>
                    <button onClick={() => setOpenRoot(open ? null : r.id)} className="flex w-full items-center gap-3 p-2 text-left">
                      <CategoryIcon category={r.cat} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-bold">{r.cat.name}</p>
                          <Money value={r.total} className="text-[14px] font-extrabold" dots={5} />
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.cat.color }} />
                          </div>
                          <span className="w-9 text-right text-[12px] font-bold text-ink-mute">{Math.round(pct)}%</span>
                        </div>
                      </div>
                      {subs.length > 1 || subs[0]?.name !== "Umum" ? (open ? <ChevronDown className="h-4 w-4 text-ink-mute" /> : <ChevronRight className="h-4 w-4 text-ink-mute" />) : <span className="w-4" />}
                    </button>
                    {open && (
                      <div className="space-y-1.5 px-3 pb-3 pl-[60px]">
                        {subs.map((s) => (
                          <div key={s.name} className="flex items-center gap-2 text-[13px]">
                            <span className="h-2 w-2 rounded-full" style={{ background: s.color || r.cat.color }} />
                            <span className="flex-1 text-ink-soft">{s.name}</span>
                            <Money value={s.total} className="font-bold" dots={4} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {data.people.length > 1 && (
        <section className="card mt-3 p-4">
          <p className="font-extrabold">Dicatat oleh</p>
          <div className="mt-3 space-y-2.5">
            {data.people.map(([id, v]) => (
              <div key={id} className="flex items-center gap-3">
                <Avatar profile={people[id]} size={32} />
                <span className="flex-1 font-semibold">{firstName(people[id]) || "Lainnya"}</span>
                <Money value={v} className="font-extrabold" dots={5} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card mt-3 p-4">
        <p className="font-extrabold">Tren 6 bulan</p>
        <div className="mt-3 h-48">
          <ResponsiveContainer>
            <BarChart data={data.trend} barGap={3}>
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#8A91AB", fontWeight: 600 }} />
              <Tooltip cursor={{ fill: "#F3F5FA", radius: 8 }}
                formatter={(v, n) => [hidden ? "Rp •••••" : formatIDR(v), n === "income" ? "Pemasukan" : "Pengeluaran"]}
                contentStyle={{ borderRadius: 14, border: "none", boxShadow: "0 8px 24px -12px rgba(14,20,48,.3)", fontSize: 13 }} />
              <Bar dataKey="income" fill="#0F9F6E" radius={[6, 6, 2, 2]} maxBarSize={16} />
              <Bar dataKey="expense" fill="#E5484D" radius={[6, 6, 2, 2]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
