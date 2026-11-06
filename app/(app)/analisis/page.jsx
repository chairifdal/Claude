"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell, PieChart, Pie } from "recharts";
import { ArrowDown, ArrowUp, ChevronRight, LineChart, PieChart as PieIcon, PiggyBank, Shuffle, TrendingUp, Users } from "lucide-react";
import { useApp, useTransactions, rootCategory } from "@/lib/app-data";
import { useTheme, chartColors } from "@/lib/theme";
import { periodRange, shiftPeriod, periodLabel, formatIDR, firstName } from "@/lib/format";
import { buckets, daysIn, niceMax, toISODate } from "@/lib/analytics";
import { CategoryIcon, Money, PageHeader, Avatar, Empty, Segmented, AccountGlyph, Sheet } from "@/components/ui";
import { FilterChip, PeriodPill } from "@/components/PeriodBar";
import { TxRow } from "@/components/TxList";
import MoneyFlow, { buildFlow } from "@/components/MoneyFlow";

const today = () => toISODate(new Date());
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 29); return toISODate(d); };
const GOOD = "#34C759", WARN = "#FF9500", BAD = "#FF3B30";

function loadState() {
  try {
    const s = JSON.parse(sessionStorage.getItem("kk-analysis") || "null");
    if (s) return { range: { from: monthAgo(), to: today() }, ...s, anchor: new Date(s.anchor) };
  } catch {}
  return { period: "month", anchor: new Date(), kind: "expense", who: "all", group: "category", range: { from: monthAgo(), to: today() } };
}

export default function AnalysisPage() {
  const C = chartColors(useTheme().isDark);
  const { categoryById, people, user, hidden, t, countsInStats, statRows, cycle, accounts, accountById } = useApp();
  const [st, setSt] = useState(loadState);
  const set = (patch) => setSt((s) => ({ ...s, ...patch }));
  useEffect(() => { try { sessionStorage.setItem("kk-analysis", JSON.stringify(st)); } catch {} }, [st]);
  const { period, anchor, kind, who, group, range } = st;
  const [detail, setDetail] = useState(null);
  const [flowMode, setFlowMode] = useState("rp");

  // Periode "Bulan" mengikuti siklus orang yang dipilih: saya → siklus saya; lainnya → bulan kalender
  const ctx = { cycle: who === user?.id || who === "all" ? cycle : null, range };
  const { start, end } = periodRange(period, anchor, ctx);
  const len = end - start;
  const prev = period === "range" ? { start: new Date(start.getTime() - len), end: start } : periodRange(period, shiftPeriod(period, anchor, -1, ctx), ctx);
  const { rows } = useTransactions({ from: prev.start, to: end, limit: 20000 });

  const data = useMemo(() => {
    const all = statRows(rows).filter((r) => countsInStats(r) && (who === "all" || r.created_by === who));
    const t0 = start.getTime(), t1 = end.getTime(), nowT = Date.now();
    // Periode berjalan dibandingkan dengan periode lalu sampai titik yang sama (adil, bukan sebulan penuh)
    const ongoing = nowT >= t0 && nowT < t1;
    const prevCut = ongoing ? prev.start.getTime() + (nowT - t0) : prev.end.getTime();
    const cur = { expense: [], income: [] };
    const before = { expense: 0, income: 0 };
    for (const r of all) {
      if (r.type !== "expense" && r.type !== "income") continue;
      const ts = new Date(r.occurred_at).getTime();
      if (ts >= t0 && ts < t1) cur[r.type].push(r);
      else if (ts < t0 && ts >= prev.start.getTime() && ts < prevCut) before[r.type] += r.amount;
    }
    const sum = (list) => list.reduce((s, r) => s + r.amount, 0);
    const income = sum(cur.income), expense = sum(cur.expense);

    const groupsOf = (list, mode) => {
      const g = {};
      for (const r of list) {
        const cat = categoryById[r.category_id];
        const root = rootCategory(cat, categoryById);
        const node = mode === "sub" ? cat : root;
        const key = node?.id || "none";
        g[key] = g[key] || { id: key, cat: node || { name: t("Tanpa kategori"), icon: "circle", color: "#8E8E93" }, parent: mode === "sub" && cat?.parent_id ? root : null, total: 0, n: 0 };
        g[key].total += r.amount; g[key].n++;
      }
      return Object.values(g).sort((a, b) => b.total - a.total);
    };
    const bucketsOf = (list) => {
      const bs = buckets(period, anchor, ctx);
      for (const r of list) {
        const d = new Date(r.occurred_at);
        const b = bs.find((x) => d >= x.start && d < x.end);
        if (b) b.total += r.amount;
      }
      return bs;
    };

    // Pengeluaran kumulatif periode lalu, per ember yang sama (untuk garis pembanding di tile Tren)
    const prevBs = period === "range" ? null : buckets(period, shiftPeriod(period, anchor, -1, ctx), ctx);
    if (prevBs) for (const r of all) {
      if (r.type !== "expense") continue;
      const d = new Date(r.occurred_at);
      const b = prevBs.find((x) => d >= x.start && d < x.end);
      if (b) b.total += r.amount;
    }

    const byPerson = {};
    for (const r of cur[kind]) byPerson[r.created_by] = (byPerson[r.created_by] || 0) + r.amount;

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

    return {
      income, expense, before, ongoing, inv,
      total: kind === "expense" ? expense : income,
      prevTotal: before[kind],
      groups: groupsOf(cur[kind], group),
      expenseRoots: groupsOf(cur.expense, "category"),
      bs: bucketsOf(cur[kind]),
      expenseBs: bucketsOf(cur.expense),
      prevBs,
      top: cur.expense.filter((r) => !r.isFee).sort((a, b) => b.amount - a.amount).slice(0, 5),
      byPerson: Object.entries(byPerson).sort((a, b) => b[1] - a[1]),
      count: cur[kind].length,
      flow: buildFlow({ income: cur.income, expense: cur.expense, inv, categoryById, accountById, t }),
    };
  }, [rows, kind, who, group, period, anchor, start.getTime(), end.getTime(), categoryById, accountById, countsInStats, statRows, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = daysIn(period, anchor, ctx);
  const now = new Date();
  const saved = data.income - data.expense;
  const saveRate = data.income > 0 ? saved / data.income : null;
  const invAccounts = accounts.filter((a) => a.kind === "investment" && (who === "all" || a.owner_id === who || who === user?.id));
  const portfolio = invAccounts.reduce((s, a) => s + a.balance, 0);
  const persons = [{ value: "all", label: t("Semua") }, ...Object.values(people).sort((a, b) => (a.id === user?.id ? -1 : b.id === user?.id ? 1 : 0))
    .map((p) => ({ value: p.id, label: p.id === user?.id ? t("Saya") : firstName(p) }))];
  const qs = `p=${period}&d=${toISODate(anchor)}&w=${who}${period === "range" ? `&f=${range.from}&t=${range.to}` : ""}`;
  const prevWord = period === "range" ? t("rentang sebelumnya") : t("{period} lalu", { period: t(period === "week" ? "minggu" : period === "year" ? "tahun" : cycle && !cycle.isCalendar && ctx.cycle ? "periode" : "bulan") });

  // Tren pengeluaran vs periode lalu (sampai titik yang sama)
  const expDelta = data.before.expense ? (data.expense - data.before.expense) / data.before.expense : null;
  const trendStatus = expDelta === null ? { label: t("Belum ada pembanding"), color: "#8E8E93" }
    : expDelta > 0.03 ? { label: t("Pengeluaran naik"), color: WARN }
    : expDelta < -0.03 ? { label: t("Pengeluaran turun"), color: GOOD } : { label: t("Stabil"), color: "#06B6D4" };
  const topCat = data.expenseRoots[0];
  const rateStatus = saveRate === null ? { label: t("Belum ada pemasukan"), color: "#8E8E93" }
    : saveRate >= 0.2 ? { label: t("Kuat"), color: GOOD } : saveRate >= 0 ? { label: t("Cukup"), color: WARN } : { label: t("Defisit"), color: BAD };
  const showPeople = who === "all" && persons.length > 2;

  return (
    <div>
      <PageHeader title={t("Analisis")} subtitle={periodLabel(period, anchor, ctx)} />

      <div className="flex flex-wrap items-center gap-2">
        <PeriodPill period={period} anchor={anchor} ctx={ctx} range={range} className="min-w-0 flex-1 sm:max-w-[360px] sm:flex-none sm:w-[360px]"
          onChange={(p, a) => set({ period: p, anchor: a })} onRange={(r) => set({ range: r })} />
        {persons.length > 2 && <FilterChip label={t("Orang")} value={who} onChange={(v) => set({ who: v })} options={persons} />}
      </div>

      {/* Ringkasan: tile yang bisa diketuk untuk detail */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile icon={LineChart} title={t("Tren")} color="#06B6D4" onClick={() => setDetail("trend")}
          value={expDelta === null ? "—" : <>{expDelta >= 0 ? "+" : ""}{Math.round(expDelta * 100)}<small className="ml-0.5 text-[15px] font-medium text-ink-soft">%</small></>}
          status={trendStatus.label} statusColor={trendStatus.color}>
          <Spark buckets={data.expenseBs} prev={data.prevBs} color="#06B6D4" now={now} />
        </Tile>

        <Tile icon={PieIcon} title={t("Paling boros")} color={topCat?.cat.color || "#FF2D55"} onClick={() => setDetail("top")}
          value={topCat ? <Money value={topCat.total} compact dots={4} /> : "—"}
          status={topCat ? topCat.cat.name : t("Belum ada pengeluaran")} statusColor={topCat?.cat.color}>
          <MiniDonut groups={data.expenseRoots} />
        </Tile>

        <Tile icon={PiggyBank} title={t("Rasio menabung")} color="#0A84FF" onClick={() => setDetail("save")}
          value={saveRate === null ? "—" : <>{saveRate > 0 ? "+" : ""}{Math.round(saveRate * 100)}<small className="ml-0.5 text-[15px] font-medium text-ink-soft">%</small></>}
          status={rateStatus.label} statusColor={rateStatus.color}>
          <Gauge value={saveRate} />
        </Tile>

        <Tile icon={Shuffle} title={t("Arus uang")} color="#30B0C7" onClick={() => setDetail("flow")}
          value={<Money value={data.income} compact dots={4} />}
          status={data.income > 0 ? t("{pct}% terpakai", { pct: Math.round((data.expense / data.income) * 100) }) : t("Belum ada pemasukan")}
          statusColor={data.income > 0 && data.expense > data.income ? BAD : "#30B0C7"}>
          <FlowBars income={data.income} roots={data.expenseRoots} spent={data.expense} />
        </Tile>

        {invAccounts.length > 0 && (
          <Tile icon={TrendingUp} title={t("Investasi")} color={INV_COLOR} onClick={() => setDetail("invest")}
            value={<Money value={portfolio} compact dots={4} />}
            status={data.inv.in - data.inv.out ? <>{t("Bersih")} <Money value={data.inv.in - data.inv.out} compact sign dots={3} /></> : t("Tidak ada setoran")}
            statusColor={data.inv.in - data.inv.out >= 0 ? INV_COLOR : BAD}>
            <InOutBars a={data.inv.in} b={data.inv.out} colors={[INV_COLOR, WARN]} />
          </Tile>
        )}

        {showPeople && (
          <Tile icon={Users} title={t("Per orang")} color="#FF9F0A" onClick={() => setDetail("people")}
            value={<Money value={data.total} compact dots={4} />}
            status={data.byPerson[0] ? t("Terbanyak: {name}", { name: data.byPerson[0][0] === user?.id ? t("Saya") : firstName(people[data.byPerson[0][0]]) || "—" }) : "—"}>
            <span className="flex -space-x-2 pt-3">
              {data.byPerson.slice(0, 4).map(([id]) => <Avatar key={id} profile={people[id]} size={34} />)}
            </span>
          </Tile>
        )}
      </div>

      {/* Per kategori: tetap tampil langsung karena paling sering dicek */}
      <section className="card mt-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">{group === "sub" ? t("Per sub-kategori") : t("Per kategori")}</h2>
          <div className="flex items-center gap-2">
            <FilterChip label={t("Kelompok")} value={group} onChange={(v) => set({ group: v })}
              options={[{ value: "category", label: t("Kategori") }, { value: "sub", label: t("Sub-kategori") }]} />
            <Segmented value={kind} onChange={(v) => set({ kind: v })} className="w-[150px]"
              options={[{ value: "expense", label: t("Keluar") }, { value: "income", label: t("Masuk") }]} />
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <Money value={data.total} className="text-[28px] font-bold tracking-tight" />
          <span className="text-[14px] text-ink-soft">{t("{n} catatan", { n: data.count })}</span>
        </div>
        {data.groups.length === 0 ? (
          <div className="mt-3"><Empty title={t("Tidak ada transaksi")} text={t("Belum ada catatan di periode ini dengan filter tersebut.")} /></div>
        ) : (
          <CategoryList groups={data.groups} total={data.total} qs={qs} />
        )}
      </section>

      {/* ---------- Detail ---------- */}
      <Sheet open={detail === "trend"} onClose={() => setDetail(null)} title={t("Tren")} full>
        <div className="space-y-4 pb-6">
          <Segmented value={kind} onChange={(v) => set({ kind: v })} className="w-full"
            options={[{ value: "expense", label: t("Pengeluaran") }, { value: "income", label: t("Pemasukan") }]} />
          <section className="card p-5">
            <p className="text-[15px] text-ink-soft">{kind === "expense" ? t("Total pengeluaran") : t("Total pemasukan")}</p>
            <Money value={data.total} className="block text-[34px] font-bold leading-tight tracking-tight" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Delta cur={data.total} prev={data.prevTotal} kind={kind} label={t("vs {period}", { period: prevWord })} hidden={hidden} />
              <div className="rounded-[14px] bg-fill p-3">
                <p className="text-[13px] text-ink-soft">{t("Rata-rata per hari")}</p>
                <Money value={Math.round(data.total / days)} compact className="block text-[17px] font-semibold" dots={4} />
              </div>
            </div>
            {data.ongoing && <p className="mt-2 text-[13px] text-ink-soft">{t("Dibandingkan sampai tanggal yang sama di periode lalu.")}</p>}
          </section>
          <section className="card p-5">
            <TrendChart bs={data.bs} total={data.total} days={days} period={period} kind={kind} C={C} hidden={hidden} t={t} now={now} />
          </section>
        </div>
      </Sheet>

      <Sheet open={detail === "top"} onClose={() => setDetail(null)} title={t("Paling boros")} full>
        <div className="space-y-4 pb-6">
          {data.expenseRoots.length === 0 ? <Empty title={t("Tidak ada transaksi")} /> : (
            <section className="card p-5">
              <div className="relative mx-auto h-56 w-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.expenseRoots} dataKey="total" nameKey="id" innerRadius={68} outerRadius={104} paddingAngle={data.expenseRoots.length > 1 ? 2 : 0}
                      cornerRadius={6} stroke="none" isAnimationActive={false}>
                      {data.expenseRoots.map((g) => <Cell key={g.id} fill={g.cat.color || C.accent} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-[13px] text-ink-soft">{t("Pengeluaran")}</p>
                    <Money value={data.expense} compact className="block text-[22px] font-bold" dots={4} />
                  </div>
                </div>
              </div>
              <CategoryList groups={data.expenseRoots} total={data.expense} qs={qs} />
            </section>
          )}
          {data.top.length > 0 && (
            <section>
              <h2 className="section-title mb-2 px-1">{t("Pengeluaran terbesar")}</h2>
              <div className="card p-1">{data.top.map((tx) => <TxRow key={tx.id} tx={tx} />)}</div>
              <p className="mt-1.5 px-1 text-[13px] text-ink-soft">{t("Ketuk untuk mengubah catatan.")}</p>
            </section>
          )}
        </div>
      </Sheet>

      <Sheet open={detail === "save"} onClose={() => setDetail(null)} title={t("Rasio menabung")} full>
        <div className="space-y-4 pb-6">
          <section className="card p-5">
            <div className="mx-auto w-48"><Gauge value={saveRate} big /></div>
            <p className="-mt-2 text-center text-[34px] font-bold tracking-tight">{saveRate === null ? "—" : `${Math.round(saveRate * 100)}%`}</p>
            <p className="text-center text-[15px] font-medium" style={{ color: rateStatus.color }}>{rateStatus.label}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Flow label={t("Masuk")} value={data.income} color={GOOD} sign />
              <Flow label={t("Keluar")} value={data.expense} color={BAD} />
              <Flow label={t("Sisa")} value={saved} color={saved >= 0 ? "#06B6D4" : BAD} sign />
            </div>
          </section>
          <Explain title={t("Apa itu rasio menabung?")}
            text={t("Sisa dibanding pemasukan. Banyak perencana keuangan menyarankan minimal 20%.")} />
        </div>
      </Sheet>

      <Sheet open={detail === "flow"} onClose={() => setDetail(null)} title={t("Arus uang")} full>
        <div className="space-y-4 pb-6">
          <section className="card p-4">
            {data.flow.total > 0 ? (
              <>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 pt-1">
                    {data.flow.sources.map((s) => (
                      <span key={s.id} className="flex items-center gap-1.5 text-[13px]">
                        <i className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: s.color }} />
                        <span className="font-medium">{s.name}</span>
                        <span className="text-ink-soft">{flowMode === "pct" ? `${Math.round((s.value / data.flow.total) * 100)}%` : <Money value={s.value} compact dots={3} />}</span>
                      </span>
                    ))}
                  </div>
                  <Segmented value={flowMode} onChange={setFlowMode} className="w-[96px] flex-none" options={[{ value: "rp", label: "Rp" }, { value: "pct", label: "%" }]} />
                </div>
                <MoneyFlow flow={data.flow} mode={flowMode} />
              </>
            ) : <Empty title={t("Tidak ada transaksi")} text={t("Belum ada catatan di periode ini dengan filter tersebut.")} />}
          </section>
          <Explain title={t("Apa itu arus uang?")}
            text={t("Diagram ini menunjukkan dari mana uangmu datang (kiri), ke kategori apa uang itu pergi (tengah), lalu rinciannya per sub-kategori (kanan). Makin tebal pitanya, makin besar uang yang mengalir lewat jalur itu.")} />
        </div>
      </Sheet>

      <Sheet open={detail === "invest"} onClose={() => setDetail(null)} title={t("Investasi")} full>
        <div className="space-y-4 pb-6">
          <section className="card p-5">
            <p className="text-[15px] text-ink-soft">{t("Portofolio")}</p>
            <Money value={portfolio} className="block text-[34px] font-bold leading-tight tracking-tight" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Flow label={t("Disetor")} value={data.inv.in} color={INV_COLOR} />
              <Flow label={t("Ditarik")} value={data.inv.out} color={WARN} />
              <Flow label={t("Bersih")} value={data.inv.in - data.inv.out} color={data.inv.in - data.inv.out >= 0 ? "#5856D6" : BAD} sign />
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
          </section>
          <Explain title={t("Investasi")} text={t("Setoran ke akun investasi dicatat sebagai Transfer, jadi tidak dihitung sebagai pengeluaran.")} />
        </div>
      </Sheet>

      <Sheet open={detail === "people"} onClose={() => setDetail(null)} title={t("Per orang")} full>
        <div className="space-y-4 pb-6">
          <Segmented value={kind} onChange={(v) => set({ kind: v })} className="w-full"
            options={[{ value: "expense", label: t("Pengeluaran") }, { value: "income", label: t("Pemasukan") }]} />
          <section className="card p-5">
            {data.byPerson.length === 0 ? <Empty title={t("Tidak ada transaksi")} /> : (
              <ul className="space-y-4">
                {data.byPerson.map(([id, v]) => (
                  <li key={id}>
                    <button onClick={() => { set({ who: id }); setDetail(null); }} className="flex w-full items-center gap-3 text-left">
                      <Avatar profile={people[id]} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[16px]">{id === user?.id ? t("Saya") : firstName(people[id]) || t("Mantan anggota")}</span>
                          <Money value={v} className="text-[16px] font-semibold" dots={5} />
                        </span>
                        <span className="mt-1.5 block h-1.5 rounded-full bg-rule">
                          <span className="block h-full rounded-full bg-brand-600" style={{ width: `${(v / data.total) * 100}%` }} />
                        </span>
                      </span>
                      <span className="tabular w-10 text-right text-[13px] text-ink-soft">{Math.round((v / data.total) * 100)}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[13px] text-ink-soft">{t("Ketuk nama untuk melihat analisis orang itu saja.")}</p>
          </section>
        </div>
      </Sheet>
    </div>
  );
}

const INV_COLOR = "#AF52DE";

/* ---------- Tile & grafik mini ---------- */

function Tile({ icon: Icon, title, color, value, status, statusColor, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className="card flex min-h-[188px] min-w-0 flex-col overflow-hidden p-4 text-left transition active:scale-[.98]"
      style={{ backgroundImage: `linear-gradient(165deg, ${color}2B, ${color}0A 65%, transparent)` }}>
      <span className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold">
        <Icon className="h-4 w-4 flex-none" style={{ color }} /> <span className="truncate">{title}</span>
      </span>
      <span className="mt-1 truncate text-[24px] font-bold leading-tight tracking-tight">{value}</span>
      <span className="my-2 block min-h-[56px] flex-1">{children}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
        <i className="h-2 w-2 flex-none rounded-full" style={{ background: statusColor || color }} />
        <span className="truncate">{status}</span>
      </span>
    </button>
  );
}

/** Garis kumulatif pengeluaran sampai hari ini */
function Spark({ buckets: bs, prev, color, now }) {
  const past = bs.filter((b) => b.start <= now);
  if (!past.length) return <span className="block h-14" />;
  const cum = (list) => { let acc = 0; return list.map((b) => (acc += b.total)); };
  const pts = cum(past);
  const prevPts = prev ? cum(prev).slice(0, bs.length) : [];
  const max = Math.max(...pts, ...prevPts, 1);
  const n = bs.length - 1 || 1;
  const toXY = (list) => list.map((v, i) => [(i / n) * 100, 38 - (v / max) * 34]);
  const path = (xy) => xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join("");
  const xy = toXY(pts.length === 1 ? [0, pts[0]] : pts);
  const line = path(xy);
  const prevLine = prevPts.length > 1 ? path(toXY(prevPts)) : null;
  const [lx, ly] = xy[xy.length - 1];
  return (
    <span className="relative block h-14">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="spark-g" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {prevLine && <path d={prevLine} fill="none" className="stroke-ink-mute" strokeWidth="1.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        <path d={`${line}L${lx},40L0,40Z`} fill="url(#spark-g)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <i className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface" style={{ left: `${lx}%`, top: `${(ly / 40) * 100}%`, background: color }} />
    </span>
  );
}

function MiniDonut({ groups }) {
  const total = groups.reduce((s, g) => s + g.total, 0);
  if (!total) return <span className="block h-16" />;
  const top = groups.slice(0, 4);
  const rest = total - top.reduce((s, g) => s + g.total, 0);
  const parts = [...top.map((g) => ({ v: g.total, c: g.cat.color || "#8E8E93" })), ...(rest > 0 ? [{ v: rest, c: "#8E8E93" }] : [])];
  const R = 22, Cc = 2 * Math.PI * R, gap = parts.length > 1 ? 2.5 : 0;
  let off = 0;
  return (
    <span className="grid h-16 place-items-center">
      <svg viewBox="0 0 60 60" className="h-16 w-16 -rotate-90">
        {parts.map((p, i) => {
          const L = (p.v / total) * Cc;
          const el = <circle key={i} cx="30" cy="30" r={R} fill="none" stroke={p.c} strokeWidth="9" strokeLinecap="butt"
            strokeDasharray={`${Math.max(0.5, L - gap)} ${Cc}`} strokeDashoffset={-off} />;
          off += L;
          return el;
        })}
      </svg>
    </span>
  );
}

/** Setengah lingkaran: 0% di kiri, 40%+ di kanan */
function Gauge({ value, big }) {
  const v = value === null ? 0 : Math.max(0, Math.min(1, value / 0.4));
  const color = value === null ? "#8E8E93" : value >= 0.2 ? GOOD : value >= 0 ? WARN : BAD;
  const arc = "M8,46 A38,38 0 0 1 84,46";
  const Lp = Math.PI * 38;
  const ang = Math.PI * (1 - v);
  const kx = 46 + 38 * Math.cos(ang), ky = 46 - 38 * Math.sin(ang);
  return (
    <span className={`grid place-items-center ${big ? "" : "h-16"}`}>
      <svg viewBox="0 0 92 54" className={big ? "w-full" : "h-14 w-24"}>
        <path d={arc} fill="none" className="stroke-rule" strokeWidth="8" strokeLinecap="round" />
        {value !== null && <path d={arc} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${v * Lp} ${Lp}`} />}
        {value !== null && <circle cx={kx} cy={ky} r="5.5" className="fill-surface" stroke={color} strokeWidth="3" />}
      </svg>
    </span>
  );
}

/** Masuk (satu batang) vs Keluar (bertumpuk per kategori induk) */
function FlowBars({ income, roots, spent }) {
  const max = Math.max(income, spent, 1);
  const top = roots.slice(0, 3);
  const rest = spent - top.reduce((s, g) => s + g.total, 0);
  return (
    <span className="block space-y-2 pt-2">
      <span className="flex items-center gap-2">
        <ArrowDown className="h-3.5 w-3.5 flex-none text-ink-soft" />
        <span className="block h-4 flex-1"><span className="block h-full rounded-[5px] bg-[#30B0C7]" style={{ width: `${(income / max) * 100}%` }} /></span>
      </span>
      <span className="flex items-center gap-2">
        <ArrowUp className="h-3.5 w-3.5 flex-none text-ink-soft" />
        <span className="flex h-4 flex-1 gap-[2px]" style={{ maxWidth: `${(spent / max) * 100}%` }}>
          {top.map((g) => <span key={g.id} className="block h-full rounded-[4px]" style={{ flex: g.total, background: g.cat.color || "#8E8E93" }} />)}
          {rest > 0 && <span className="block h-full rounded-[4px] bg-[#8E8E93]" style={{ flex: rest }} />}
        </span>
      </span>
    </span>
  );
}

function InOutBars({ a, b, colors }) {
  const max = Math.max(a, b, 1);
  return (
    <span className="block space-y-2 pt-2">
      {[[ArrowDown, a, colors[0]], [ArrowUp, b, colors[1]]].map(([I, v, c], i) => (
        <span key={i} className="flex items-center gap-2">
          <I className="h-3.5 w-3.5 flex-none text-ink-soft" />
          <span className="block h-4 flex-1"><span className="block h-full rounded-[5px]" style={{ width: `${Math.max(2, (v / max) * 100)}%`, background: c, opacity: v ? 1 : 0.25 }} /></span>
        </span>
      ))}
    </span>
  );
}

/* ---------- Bagian detail ---------- */

function CategoryList({ groups, total, qs }) {
  const max = groups[0]?.total || 1;
  return (
    <ul className="mt-2">
      {groups.map((g) => (
        <li key={g.id}>
          <Link href={g.id === "none" ? "#" : `/analisis/kategori/${g.id}?${qs}`} aria-disabled={g.id === "none"}
            className="flex items-center gap-3 rounded-[12px] px-1 py-2 active:bg-fill">
            <CategoryIcon category={g.cat} size={34} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[16px]">{g.cat.name}{g.parent && <span className="text-ink-soft"> · {g.parent.name}</span>}</span>
                <span className="flex-none">
                  <Money value={g.total} className="text-[16px] font-semibold" dots={5} />
                  <span className="tabular ml-2 inline-block w-10 text-right text-[13px] text-ink-soft">{Math.round((g.total / (total || 1)) * 100)}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-rule">
                <div className="h-full rounded-full" style={{ width: `${(g.total / max) * 100}%`, background: g.cat?.color || "#06B6D4" }} />
              </div>
            </div>
            <ChevronRight className="h-4 w-4 flex-none text-ink-mute" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Delta({ cur, prev, kind, label, hidden }) {
  const delta = cur - prev;
  const worse = kind === "expense" ? delta > 0 : delta < 0;
  return (
    <div className="rounded-[14px] bg-fill p-3">
      <p className="truncate text-[13px] text-ink-soft">{label}</p>
      {prev ? (
        <p className={`tabular text-[17px] font-semibold ${delta === 0 ? "text-ink-soft" : worse ? "text-expense" : "text-income"}`}>
          {hidden ? "Rp •••" : formatIDR(delta, { sign: true, compact: true })}
          <span className="ml-1 text-[13px] font-normal text-ink-soft">({delta >= 0 ? "+" : ""}{Math.round((delta / prev) * 100)}%)</span>
        </p>
      ) : <p className="text-[17px] text-ink-mute">—</p>}
    </div>
  );
}

function TrendChart({ bs, total, days, period, kind, C, hidden, t, now }) {
  const bucketDays = period === "year" ? 30.4 : bs.length && (bs[0].end - bs[0].start) > 86400000 * 2 ? 7 : 1;
  const avg = (total / days) * bucketDays;
  const yMax = niceMax(Math.max(...bs.map((b) => b.total), 0));
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="section-title">{t("Tren")}</h2>
        <span className="flex items-center gap-1.5 text-[13px] text-ink-soft"><i className="inline-block h-0 w-4 border-t border-dashed border-ink-soft" /> {t("rata-rata")}</span>
      </div>
      <div className="mt-3 h-56">
        <ResponsiveContainer>
          <BarChart data={bs} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={C.grid} />
            <YAxis width={44} axisLine={false} tickLine={false} domain={[0, yMax]} tickCount={5}
              tick={{ fontSize: 12, fill: C.tick }} tickFormatter={(v) => (hidden ? "" : formatIDR(v, { compact: true }).replace("Rp ", ""))} />
            <XAxis dataKey="label" axisLine={{ stroke: C.axis }} tickLine={false} tick={{ fontSize: 12, fill: C.tick }}
              interval={bs.length > 14 ? Math.ceil(bs.length / 7) - 1 : 0} />
            <Tooltip cursor={{ fill: C.cursor }} formatter={(v) => [hidden ? "Rp •••••" : formatIDR(v), kind === "expense" ? t("Keluar") : t("Masuk")]}
              contentStyle={{ borderRadius: 12, border: `1px solid ${C.tipBorder}`, background: C.tipBg, boxShadow: "none", fontSize: 14 }} />
            {avg > 0 && <ReferenceLine y={avg} stroke={C.ref} strokeDasharray="4 4" />}
            <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={bs.length > 20 ? 10 : 28}>
              {bs.map((b, i) => <Cell key={i} fill={b.start <= now && now < b.end ? C.accent : b.start > now ? C.future : C.soft} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function Explain({ title, text }) {
  return (
    <section className="px-1">
      <h3 className="text-[17px] font-semibold">{title}</h3>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{text}</p>
    </section>
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
