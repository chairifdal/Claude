"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell, PieChart, Pie } from "recharts";
import { ChevronRight } from "lucide-react";
import { useApp, useTransactions, rootCategory } from "@/lib/app-data";
import { useTheme, chartColors } from "@/lib/theme";
import { periodRange, shiftPeriod, periodLabel, formatIDR, firstName } from "@/lib/format";
import { buckets, daysIn, niceMax, toISODate } from "@/lib/analytics";
import { CategoryIcon, Money, PageHeader, Avatar, Empty, Segmented, AccountGlyph } from "@/components/ui";
import PeriodBar, { FilterChip } from "@/components/PeriodBar";
import { TxRow } from "@/components/TxList";

const today = () => toISODate(new Date());
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 29); return toISODate(d); };

function loadState() {
  try {
    const s = JSON.parse(sessionStorage.getItem("kk-analysis") || "null");
    if (s) return { range: { from: monthAgo(), to: today() }, ...s, anchor: new Date(s.anchor) };
  } catch {}
  return { period: "month", anchor: new Date(), kind: "expense", who: "all", group: "category", view: "list", range: { from: monthAgo(), to: today() } };
}

export default function AnalysisPage() {
  const C = chartColors(useTheme().isDark);
  const { categoryById, people, user, hidden, t, countsInStats, statRows, cycle, accounts, accountById } = useApp();
  const [st, setSt] = useState(loadState);
  const set = (patch) => setSt((s) => ({ ...s, ...patch }));
  useEffect(() => { try { sessionStorage.setItem("kk-analysis", JSON.stringify(st)); } catch {} }, [st]);
  const { period, anchor, kind, who, group, view, range } = st;

  // Periode "Bulan" mengikuti siklus orang yang dipilih: saya → siklus saya; lainnya → bulan kalender
  const ctx = { cycle: who === user?.id || who === "all" ? cycle : null, range };
  const { start, end } = periodRange(period, anchor, ctx);
  const len = end - start;
  const prev = period === "range" ? { start: new Date(start.getTime() - len), end: start } : periodRange(period, shiftPeriod(period, anchor, -1, ctx), ctx);
  const { rows } = useTransactions({ from: prev.start, to: end, limit: 20000 });

  const data = useMemo(() => {
    const all = statRows(rows).filter((r) => countsInStats(r) && (who === "all" || r.created_by === who));
    const inCur = (r) => { const d = new Date(r.occurred_at); return d >= start && d < end; };
    const cur = all.filter((r) => inCur(r) && r.type === kind);
    const before = all.filter((r) => !inCur(r) && r.type === kind);
    const income = all.filter((r) => inCur(r) && r.type === "income").reduce((s, r) => s + r.amount, 0);
    const expense = all.filter((r) => inCur(r) && r.type === "expense").reduce((s, r) => s + r.amount, 0);
    const total = cur.reduce((s, r) => s + r.amount, 0);
    const prevTotal = before.reduce((s, r) => s + r.amount, 0);

    const groups = {};
    for (const r of cur) {
      const cat = categoryById[r.category_id];
      const root = rootCategory(cat, categoryById);
      const node = group === "sub" ? cat : root;
      const key = node?.id || "none";
      groups[key] = groups[key] || { id: key, cat: node || { name: t("Tanpa kategori"), icon: "circle", color: "#8E8E93" }, parent: group === "sub" && cat?.parent_id ? root : null, total: 0, n: 0 };
      groups[key].total += r.amount; groups[key].n++;
    }
    const bs = buckets(period, anchor, ctx);
    for (const r of cur) {
      const d = new Date(r.occurred_at);
      const b = bs.find((x) => d >= x.start && d < x.end);
      if (b) b.total += r.amount;
    }
    const byPerson = {};
    for (const r of cur) byPerson[r.created_by] = (byPerson[r.created_by] || 0) + r.amount;
    // 5 transaksi terbesar (pakai baris asli, bukan baris biaya transfer)
    const top = cur.filter((r) => !r.isFee).sort((a, b) => b.amount - a.amount).slice(0, 5);
    // Investasi: transfer ke/dari akun bertipe Investasi di periode ini (mengikuti filter orang)
    const isInv = (id) => accountById[id]?.kind === "investment";
    const inv = { in: 0, out: 0, change: 0, perAccount: {} };
    for (const r of rows) {
      const d = new Date(r.occurred_at);
      if (d < start || d >= end || (who !== "all" && r.created_by !== who)) continue;
      if (r.type === "transfer") {
        if (isInv(r.to_account_id) && !isInv(r.account_id)) { inv.in += r.amount; inv.perAccount[r.to_account_id] = (inv.perAccount[r.to_account_id] || 0) + r.amount; }
        if (isInv(r.account_id) && !isInv(r.to_account_id)) { inv.out += r.amount; inv.perAccount[r.account_id] = (inv.perAccount[r.account_id] || 0) - r.amount; }
      } else if (r.is_adjustment && isInv(r.account_id)) {
        // Kenaikan/penurunan nilai pasar dicatat lewat "Sesuaikan saldo"
        inv.change += r.type === "income" ? r.amount : -r.amount;
      }
    }
    return { inv, total, prevTotal, income, expense, groups: Object.values(groups).sort((a, b) => b.total - a.total), bs, top,
      byPerson: Object.entries(byPerson).sort((a, b) => b[1] - a[1]), count: cur.length };
  }, [rows, kind, who, group, period, anchor, start.getTime(), end.getTime(), categoryById, accountById, countsInStats, statRows, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = daysIn(period, anchor, ctx);
  const delta = data.total - data.prevTotal;
  const worse = kind === "expense" ? delta > 0 : delta < 0;
  const maxGroup = data.groups[0]?.total || 1;
  const bucketDays = period === "year" ? 30.4 : data.bs.length && (data.bs[0].end - data.bs[0].start) > 86400000 * 2 ? 7 : 1;
  const avgBucket = data.total / days * bucketDays;
  const yMax = niceMax(Math.max(...data.bs.map((b) => b.total), 0));
  const now = new Date();
  const saved = data.income - data.expense;
  const invAccounts = accounts.filter((a) => a.kind === "investment" && (who === "all" || a.owner_id === who || who === user?.id));
  const portfolio = invAccounts.reduce((s, a) => s + a.balance, 0);
  const saveRate = data.income > 0 ? saved / data.income : null;

  const persons = [{ value: "all", label: t("Semua") }, ...Object.values(people).sort((a, b) => (a.id === user?.id ? -1 : b.id === user?.id ? 1 : 0))
    .map((p) => ({ value: p.id, label: p.id === user?.id ? t("Saya") : firstName(p) }))];
  const qs = `p=${period}&d=${toISODate(anchor)}&w=${who}${period === "range" ? `&f=${range.from}&t=${range.to}` : ""}`;
  const prevWord = period === "range" ? t("rentang sebelumnya") : t("{period} lalu", { period: t(period === "week" ? "minggu" : period === "year" ? "tahun" : cycle && !cycle.isCalendar && ctx.cycle ? "periode" : "bulan") });

  return (
    <div>
      <PageHeader title={t("Analisis")} subtitle={periodLabel(period, anchor, ctx)} />

      <div className="space-y-3">
        {persons.length > 2 && <Segmented value={who} onChange={(v) => set({ who: v })} className="w-full sm:w-[400px]" options={persons} />}
        <PeriodBar period={period} anchor={anchor} ctx={ctx} allowRange range={range}
          onChange={(p, a) => set({ period: p, anchor: a })} onRange={(r) => set({ range: r })} />
        <div className="flex flex-wrap gap-2" aria-label={t("Filter")}>
          <FilterChip label={t("Jenis")} value={kind} onChange={(v) => set({ kind: v })}
            options={[{ value: "expense", label: t("Pengeluaran") }, { value: "income", label: t("Pemasukan") }]} />
          <FilterChip label={t("Kelompok")} value={group} onChange={(v) => set({ group: v })}
            options={[{ value: "category", label: t("Kategori") }, { value: "sub", label: t("Sub-kategori") }]} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-5">
          {/* Ringkasan */}
          <section className="card p-5">
            <p className="text-[15px] text-ink-soft">{kind === "expense" ? t("Total pengeluaran") : t("Total pemasukan")}</p>
            <Money value={data.total} className="block text-[34px] font-bold leading-tight tracking-tight" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[14px] bg-fill p-3">
                <p className="text-[13px] text-ink-soft">{t("vs {period}", { period: prevWord })}</p>
                {data.prevTotal ? (
                  <p className={`tabular text-[17px] font-semibold ${delta === 0 ? "text-ink-soft" : worse ? "text-expense" : "text-income"}`}>
                    {hidden ? "Rp •••" : formatIDR(delta, { sign: true, compact: true })}
                    <span className="ml-1 text-[13px] font-normal text-ink-soft">({delta >= 0 ? "+" : ""}{Math.round((delta / data.prevTotal) * 100)}%)</span>
                  </p>
                ) : <p className="text-[17px] text-ink-mute">—</p>}
              </div>
              <div className="rounded-[14px] bg-fill p-3">
                <p className="text-[13px] text-ink-soft">{t("Rata-rata per hari")}</p>
                <Money value={Math.round(data.total / days)} compact className="block text-[17px] font-semibold" dots={4} />
              </div>
            </div>
          </section>

          {/* Arus kas */}
          <section className="card p-5">
            <h2 className="section-title">{t("Arus kas")}</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Flow label={t("Masuk")} value={data.income} color="#34C759" sign />
              <Flow label={t("Keluar")} value={data.expense} color="#FF3B30" />
              <Flow label={t("Sisa")} value={saved} color={saved >= 0 ? "#0EA5E9" : "#FF3B30"} sign />
            </div>
            {saveRate !== null && (
              <div className="mt-4">
                <div className="flex items-baseline justify-between text-[14px]">
                  <span className="text-ink-soft">{t("Rasio menabung")}</span>
                  <span className={`font-semibold ${saveRate < 0 ? "text-expense" : saveRate >= 0.2 ? "text-income" : "text-ink"}`}>{Math.round(saveRate * 100)}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-rule">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, saveRate)) * 100}%`, background: saveRate >= 0.2 ? "#34C759" : "#FF9500" }} />
                </div>
                <p className="mt-1.5 text-[13px] text-ink-soft">{t("Sisa dibanding pemasukan. Banyak perencana keuangan menyarankan minimal 20%.")}</p>
              </div>
            )}
          </section>

          {/* Investasi */}
          {invAccounts.length > 0 && (
            <section className="card p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="section-title">{t("Investasi")}</h2>
                <span className="text-[13px] text-ink-soft">{t("Portofolio")} <Money value={portfolio} compact className="font-semibold text-ink" dots={4} /></span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Flow label={t("Disetor")} value={data.inv.in} color="#AF52DE" />
                <Flow label={t("Ditarik")} value={data.inv.out} color="#FF9500" />
                <Flow label={t("Bersih")} value={data.inv.in - data.inv.out} color={data.inv.in - data.inv.out >= 0 ? "#5856D6" : "#FF3B30"} sign />
              </div>
              {data.income > 0 && data.inv.in - data.inv.out > 0 && (
                <p className="mt-3 text-[14px] text-ink-soft">
                  {t("{pct}% dari pemasukan periode ini diinvestasikan.", { pct: Math.round(((data.inv.in - data.inv.out) / data.income) * 100) })}
                </p>
              )}
              {data.inv.change !== 0 && (
                <p className="mt-1 text-[14px] text-ink-soft">
                  {t("Perubahan nilai (dari Sesuaikan saldo)")}: <Money value={data.inv.change} sign className={`font-semibold ${data.inv.change >= 0 ? "text-income" : "text-expense"}`} dots={4} />
                </p>
              )}
              <ul className="mt-3 divide-y divide-line">
                {invAccounts.map((a) => (
                  <li key={a.id}>
                    <Link href={`/dompet/${a.id}`} className="flex items-center gap-3 py-2.5 active:opacity-60">
                      <AccountGlyph account={a} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px]">{a.name}</span>
                        {data.inv.perAccount[a.id] ? <span className="block text-[13px] text-ink-soft">{t("Periode ini")} <Money value={data.inv.perAccount[a.id]} compact sign dots={3} /></span> : null}
                      </span>
                      <Money value={a.balance} className="flex-none text-[16px] font-semibold" dots={5} />
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[13px] text-ink-soft">{t("Setoran ke akun investasi dicatat sebagai Transfer, jadi tidak dihitung sebagai pengeluaran.")}</p>
            </section>
          )}

          {/* Tren */}
          <section className={`card p-5 ${view === "trend" ? "" : "hidden lg:block"}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="section-title">{t("Tren")}</h2>
              <span className="flex items-center gap-1.5 text-[13px] text-ink-soft"><i className="inline-block h-0 w-4 border-t border-dashed border-ink-soft" /> {t("rata-rata")}</span>
            </div>
            <div className="mt-3 h-56">
              <ResponsiveContainer>
                <BarChart data={data.bs} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <YAxis width={44} axisLine={false} tickLine={false} domain={[0, yMax]} tickCount={5}
                    tick={{ fontSize: 12, fill: C.tick }} tickFormatter={(v) => (hidden ? "" : formatIDR(v, { compact: true }).replace("Rp ", ""))} />
                  <XAxis dataKey="label" axisLine={{ stroke: C.axis }} tickLine={false} tick={{ fontSize: 12, fill: C.tick }}
                    interval={data.bs.length > 14 ? Math.ceil(data.bs.length / 7) - 1 : 0} />
                  <Tooltip cursor={{ fill: C.cursor }} formatter={(v) => [hidden ? "Rp •••••" : formatIDR(v), kind === "expense" ? t("Keluar") : t("Masuk")]}
                    contentStyle={{ borderRadius: 12, border: `1px solid ${C.tipBorder}`, background: C.tipBg, boxShadow: "none", fontSize: 14 }} />
                  {avgBucket > 0 && <ReferenceLine y={avgBucket} stroke={C.ref} strokeDasharray="4 4" />}
                  <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={data.bs.length > 20 ? 10 : 28}>
                    {data.bs.map((b, i) => <Cell key={i} fill={b.start <= now && now < b.end ? C.accent : b.start > now ? C.future : C.soft} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-5">
          <div role="tablist" className="flex gap-6 border-b border-line lg:hidden">
            {[["list", t("Kategori")], ["trend", t("Tren")]].map(([v, l]) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => set({ view: v })}
                className={`-mb-px border-b-2 pb-2.5 text-[17px] ${view === v ? "border-brand-600 font-semibold text-brand-600" : "border-transparent text-ink-soft"}`}>{l}</button>
            ))}
          </div>

          {/* Pie + daftar kategori */}
          <section className={`card p-5 ${view === "list" ? "" : "hidden lg:block"}`}>
            <h2 className="section-title">{group === "sub" ? t("Per sub-kategori") : t("Per kategori")}</h2>
            {data.groups.length === 0 ? (
              <div className="mt-3"><Empty title={t("Tidak ada transaksi")} text={t("Belum ada catatan di periode ini dengan filter tersebut.")} /></div>
            ) : (
              <>
                <div className="relative mx-auto mt-2 h-56 w-56">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={data.groups} dataKey="total" nameKey="id" innerRadius={68} outerRadius={104} paddingAngle={data.groups.length > 1 ? 2 : 0}
                        cornerRadius={6} stroke="none" isAnimationActive={false}>
                        {data.groups.map((g) => <Cell key={g.id} fill={g.cat.color || C.accent} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div>
                      <p className="text-[13px] text-ink-soft">{t("{n} catatan", { n: data.count })}</p>
                      <Money value={data.total} compact className="block text-[22px] font-bold" dots={4} />
                    </div>
                  </div>
                </div>
                <ul className="mt-2">
                  {data.groups.map((g) => (
                    <li key={g.id}>
                      <Link href={g.id === "none" ? "#" : `/analisis/kategori/${g.id}?${qs}`} aria-disabled={g.id === "none"}
                        className="flex items-center gap-3 rounded-[12px] px-1 py-2 active:bg-fill">
                        <CategoryIcon category={g.cat} size={34} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="min-w-0 truncate text-[16px]">{g.cat.name}{g.parent && <span className="text-ink-soft"> · {g.parent.name}</span>}</span>
                            <span className="flex-none">
                              <Money value={g.total} className="text-[16px] font-semibold" dots={5} />
                              <span className="tabular ml-2 inline-block w-10 text-right text-[13px] text-ink-soft">{Math.round((g.total / data.total) * 100)}%</span>
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-rule">
                            <div className="h-full rounded-full" style={{ width: `${(g.total / maxGroup) * 100}%`, background: g.cat?.color || C.accent }} />
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 flex-none text-ink-mute" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Transaksi terbesar */}
          {data.top.length > 0 && (
            <section>
              <h2 className="section-title mb-2 px-1">{kind === "expense" ? t("Pengeluaran terbesar") : t("Pemasukan terbesar")}</h2>
              <div className="card p-1">
                {data.top.map((tx) => <TxRow key={tx.id} tx={tx} />)}
              </div>
              <p className="mt-1.5 px-1 text-[13px] text-ink-soft">{t("Ketuk untuk mengubah catatan.")}</p>
            </section>
          )}

          {/* Kontribusi per orang (hanya saat "Semua") */}
          {who === "all" && data.byPerson.length > 1 && (
            <section className="card p-5">
              <h2 className="section-title">{t("Per orang")}</h2>
              <ul className="mt-3 space-y-3">
                {data.byPerson.map(([id, v]) => (
                  <li key={id}>
                    <button onClick={() => set({ who: id })} className="flex w-full items-center gap-3 text-left">
                      <Avatar profile={people[id]} size={32} />
                      <span className="flex-1 text-[16px]">{id === user?.id ? t("Saya") : firstName(people[id]) || t("Mantan anggota")}</span>
                      <Money value={v} className="text-[16px] font-semibold" dots={5} />
                      <span className="tabular w-10 text-right text-[13px] text-ink-soft">{Math.round((v / data.total) * 100)}%</span>
                    </button>
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

function Flow({ label, value, color, sign }) {
  return (
    <div className="min-w-0 rounded-[14px] p-3" style={{ background: `${color}17` }}>
      <p className="text-[13px] font-semibold" style={{ color }}>{label}</p>
      <Money value={value} compact sign={sign} className="block text-[17px] font-bold tracking-tight" dots={4} />
    </div>
  );
}
