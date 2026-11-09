"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell, PieChart, Pie } from "recharts";
import { ArrowDown, ArrowUp, ChevronRight, LineChart, PieChart as PieIcon, PiggyBank, Shuffle, TrendingUp, Users, HandHeart, Target, RefreshCw } from "lucide-react";
import { useApp, useTransactions, rootCategory } from "@/lib/app-data";
import { useTheme, chartColors } from "@/lib/theme";
import { INSTRUMENTS } from "@/lib/constants";
import { budgetReport, periodOf } from "@/lib/budgets";
import { investStats, monthlyInvestSeries } from "@/lib/investments";
import { periodRange, shiftPeriod, periodLabel, formatIDR, firstName } from "@/lib/format";
import { buckets, daysIn, niceMax, toISODate } from "@/lib/analytics";
import { CategoryIcon, Money, PageHeader, Avatar, Empty, Segmented, AccountGlyph, Sheet } from "@/components/ui";
import { FilterChip, PeriodPill } from "@/components/PeriodBar";
import { TxRow } from "@/components/TxList";
import MoneyFlow, { buildFlow } from "@/components/MoneyFlow";

const today = () => toISODate(new Date());
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 29); return toISODate(d); };
const GOOD = "#34C759", WARN = "#FF9500", BAD = "#FF3B30";
const CHARITY = "#00A884";
// Kategori ibadah harta: dikenali dari nama kategori (atau kategori induknya).
// "Religious Giving" (dan semua sub-kategorinya: Infaq & Sedekah, Zakat, Umroh, Gift) ikut terhitung.
const CHARITY_RE = /religious\s*giving|infa[qk]|s[h]?[ao]d[ae]q[ao]?h|sedeka[hk]|zaka[th]|wakaf|donasi|amal\b/i;

function loadState() {
  try {
    const s = JSON.parse(sessionStorage.getItem("kk-analysis") || "null");
    if (s) return { range: { from: monthAgo(), to: today() }, ...s, anchor: new Date(s.anchor) };
  } catch {}
  return { period: "month", anchor: new Date(), kind: "expense", who: "all", group: "category", range: { from: monthAgo(), to: today() } };
}

export default function AnalysisPage() {
  const C = chartColors(useTheme().isDark);
  const { categoryById, categories, people, user, hidden, t, countsInStats, statRows, cycle, accounts, accountById, budgets, supabase, version, locale } = useApp();
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

    const hasKids = new Set(Object.values(categoryById).filter((c) => c.parent_id).map((c) => c.parent_id));
    const groupsOf = (list, mode) => {
      const g = {};
      for (const r of list) {
        const cat = categoryById[r.category_id];
        const root = rootCategory(cat, categoryById);
        const node = mode === "sub" ? cat : root;
        const key = node?.id || "none";
        // Per sub-kategori: catatan langsung di induk yang punya sub-kategori tampil sebagai "Umum/General"
        const general = mode === "sub" && cat && !cat.parent_id && hasKids.has(cat.id);
        g[key] = g[key] || {
          id: key,
          cat: node ? (general ? { ...node, name: t("Umum") } : node) : { name: t("Tanpa kategori"), icon: "circle", color: "#8E8E93" },
          parent: mode === "sub" && (cat?.parent_id || general) ? root : null, total: 0, n: 0,
        };
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
      } else if (isInv(r.account_id)) {
        // Untung/rugi: Sesuaikan saldo (nilai pasar), dividen/bunga yang masuk ke akun investasi, biaya admin
        inv.change += r.type === "income" ? r.amount : -r.amount;
      }
    }

    // Infaq & sedekah (termasuk zakat, wakaf, donasi): pengeluaran di kategori yang namanya cocok
    const isCharity = (r) => {
      const cat = categoryById[r.category_id];
      return !!cat && (CHARITY_RE.test(cat.name) || CHARITY_RE.test(rootCategory(cat, categoryById)?.name || ""));
    };
    const charityRows = cur.expense.filter(isCharity);
    let charityBefore = 0;
    for (const r of all) {
      if (r.type !== "expense" || !isCharity(r)) continue;
      const ts = new Date(r.occurred_at).getTime();
      if (ts < t0 && ts >= prev.start.getTime() && ts < prevCut) charityBefore += r.amount;
    }
    const charity = {
      total: sum(charityRows), before: charityBefore, groups: groupsOf(charityRows, "sub"),
      top: charityRows.filter((r) => !r.isFee).sort((a, b) => b.amount - a.amount).slice(0, 5),
    };

    return {
      income, expense, before, ongoing, inv, charity,
      total: kind === "expense" ? expense : income,
      prevTotal: before[kind],
      groups: groupsOf(cur[kind], group),
      expenseRoots: groupsOf(cur.expense, "category"),
      expenseRows: cur.expense,
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
  // Alokasi portofolio per instrumen (Emas, Reksadana, Saham, SBN, …)
  const allocation = Object.values(invAccounts.reduce((m, a) => {
    const k = INSTRUMENTS[a.instrument] ? a.instrument : "_none";
    const meta = INSTRUMENTS[k] || { label: "Belum dipilih", color: "#C7C7CC" };
    m[k] = m[k] || { key: k, label: meta.label, color: meta.color, value: 0 };
    m[k].value += Math.max(0, a.balance);
    return m;
  }, {})).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);

  // Seluruh riwayat akun investasi (untuk modal, untung/rugi total, dan grafik 12 bulan)
  const invIds = invAccounts.map((a) => a.id).sort().join(",");
  const [invTx, setInvTx] = useState([]);
  useEffect(() => {
    if (!invIds) { setInvTx([]); return; }
    let off = false;
    (async () => {
      const all = [];
      for (let o = 0; o < 10000; o += 1000) {
        const { data: d, error } = await supabase.from("transactions").select("id,account_id,to_account_id,type,amount,fee,is_adjustment,occurred_at")
          .or(`account_id.in.(${invIds}),to_account_id.in.(${invIds})`).order("occurred_at").order("id").range(o, o + 999);
        if (error || !d) break;
        all.push(...d);
        if (d.length < 1000) break;
      }
      if (!off) setInvTx(all.map((r) => ({ ...r, amount: Number(r.amount), fee: Number(r.fee) || 0 })));
    })();
    return () => { off = true; };
  }, [supabase, invIds, version]);
  const invStats = useMemo(() => Object.fromEntries(invAccounts.map((a) => [a.id,
    investStats(a, invTx.filter((x) => x.account_id === a.id || x.to_account_id === a.id))])), [invAccounts, invTx]);
  const invTotal = invAccounts.reduce((s, a) => ({ modal: s.modal + invStats[a.id].modal, value: s.value + a.balance }), { modal: 0, value: 0 });
  const invGainAll = invTotal.value - invTotal.modal;
  const invSeries = useMemo(() => {
    const ids = new Set(invIds.split(","));
    return monthlyInvestSeries(invTx, (id) => !!id && ids.has(id), new Date(end.getTime() - 1), 12,
      (d) => d.toLocaleDateString(locale === "en" ? "en-GB" : "id-ID", { month: "short" }));
  }, [invTx, invIds, end.getTime(), locale]); // eslint-disable-line react-hooks/exhaustive-deps
  const staleInv = invAccounts.filter((a) => invStats[a.id]?.stale);
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
  const invNet = data.inv.in - data.inv.out;
  const invRate = data.income > 0 ? invNet / data.income : null;
  const hasCharityCats = categories.some((c) => c.kind === "expense" && CHARITY_RE.test(c.name));
  // Judul kartu mengikuti nama kategori induknya (mis. "Religious Giving") bila ada
  const charityTitle = categories.find((c) => c.kind === "expense" && !c.parent_id && c.owner_id === user?.id && CHARITY_RE.test(c.name))?.name || t("Infaq & Sedekah");
  const charityRate = data.income > 0 ? data.charity.total / data.income : null;
  // Anggaran (harian / mingguan / bulanan) disesuaikan dengan periode yang dipilih
  const budget = useMemo(() => budgetReport({
    budgets, categoryById, rows: data.expenseRows, rootOf: (id) => rootCategory(categoryById[id], categoryById),
    start, end, wholeMonth: period === "month",
  }), [budgets, categoryById, data.expenseRows, start.getTime(), end.getTime(), period]); // eslint-disable-line react-hooks/exhaustive-deps
  // Warna mengikuti jalur: lewat batas = merah, lebih cepat dari bagian periode yang berjalan = oranye
  const budgetTone = (r) => (r > 1 ? BAD : r > budget.pace + 0.05 ? WARN : GOOD);
  const budgetStatus = {
    none: { label: t("Belum ada anggaran"), color: "#8E8E93" },
    ok: { label: t("Sesuai rencana"), color: GOOD },
    fast: { label: t("Lebih cepat dari rencana"), color: WARN },
    over: { label: t("Lewat anggaran"), color: BAD },
  }[budget.state];
  const perLabel = (b) => t({ daily: "{amount}/hari", weekly: "{amount}/minggu", monthly: "{amount}/bulan" }[periodOf(b)], { amount: hidden ? "Rp •••" : formatIDR(b.amount, { compact: true }) });
  const pctText = (r) => (r === null ? "—" : `${Math.round(r * 1000) / 10}`.replace(".", ","));

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
            value={invRate === null ? "—" : <>{pctText(invRate)}<small className="ml-0.5 text-[15px] font-medium text-ink-soft">%</small></>}
            status={data.inv.change ? <>{data.inv.change > 0 ? t("Untung") : t("Rugi")} <Money value={data.inv.change} compact sign dots={3} /></>
              : invNet ? <>{invNet > 0 ? t("Disetor") : t("Ditarik")} <Money value={Math.abs(invNet)} compact dots={3} /></> : t("Tidak ada setoran")}
            statusColor={data.inv.change ? (data.inv.change > 0 ? GOOD : BAD) : invNet >= 0 ? INV_COLOR : BAD}>
            <RateBar rate={invRate} color={INV_COLOR} label={t("dari pemasukan")} />
          </Tile>
        )}

        {hasCharityCats && (
          <Tile icon={HandHeart} title={charityTitle} color={CHARITY} onClick={() => setDetail("charity")}
            value={charityRate === null ? "—" : <>{pctText(charityRate)}<small className="ml-0.5 text-[15px] font-medium text-ink-soft">%</small></>}
            status={<Money value={data.charity.total} compact dots={4} />}>
            <RateBar rate={charityRate} color={CHARITY} label={t("dari pemasukan")} max={0.2} />
          </Tile>
        )}

        <Tile icon={Target} title={t("Anggaran")} color="#0A84FF" onClick={() => setDetail("budget")}
          value={budget.rate === null ? "—" : <>{Math.round(budget.rate * 100)}<small className="ml-0.5 text-[15px] font-medium text-ink-soft">%</small></>}
          status={budgetStatus.label} statusColor={budgetStatus.color}>
          <PaceBar rate={budget.rate} pace={budget.pace} color={budgetStatus.color} />
        </Tile>

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
            <p className="text-[15px] text-ink-soft">{t("Bagian pemasukan yang diinvestasikan")}</p>
            <p className="text-[34px] font-bold leading-tight tracking-tight" style={{ color: INV_COLOR }}>{invRate === null ? "—" : `${pctText(invRate)}%`}</p>
            <p className="mt-1 text-[14px] text-ink-soft">
              {t("Setoran bersih {inv} dari pemasukan {inc} di {period}.", { inv: hidden ? "Rp •••" : formatIDR(invNet, { compact: true }), inc: hidden ? "Rp •••" : formatIDR(data.income, { compact: true }), period: periodLabel(period, anchor, ctx) })}
            </p>
            <div className="mt-3"><RateBar rate={invRate} color={INV_COLOR} label={t("dari pemasukan")} /></div>
          </section>

          {staleInv.length > 0 && (
            <div className="flex items-start gap-3 rounded-card bg-warn-soft p-4">
              <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-warn text-white"><RefreshCw className="h-4 w-4" /></span>
              <p className="text-[14px] leading-snug">
                {t("Nilai {names} belum diperbarui lebih dari {n} hari. Buka akunnya lalu ketuk Perbarui nilai investasi.", { names: staleInv.map((a) => a.name).join(", "), n: 30 })}
              </p>
            </div>
          )}

          <section className="card p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <p className="text-[13px] text-ink-soft">{t("Untung/rugi {period}", { period: periodLabel(period, anchor, ctx) })}</p>
                <Money value={data.inv.change} sign className={`block text-[22px] font-bold tracking-tight ${data.inv.change >= 0 ? "text-income" : "text-expense"}`} dots={4} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] text-ink-soft">{t("Untung/rugi total")}</p>
                <Money value={invGainAll} sign className={`block text-[22px] font-bold tracking-tight ${invGainAll >= 0 ? "text-income" : "text-expense"}`} dots={4} />
                {invTotal.modal > 0 && <p className={`text-[13px] font-medium ${invGainAll >= 0 ? "text-income" : "text-expense"}`}>{invGainAll >= 0 ? "+" : ""}{pctText(invGainAll / invTotal.modal)}% {t("dari modal")}</p>}
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between gap-3">
              <h3 className="text-[15px] font-semibold">{t("12 bulan terakhir")}</h3>
              <span className="flex gap-3 text-[12px] text-ink-soft">
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: INV_COLOR }} /> {t("Setoran bersih")}</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-income" /> {t("Untung/rugi")}</span>
              </span>
            </div>
            <div className="mt-2 h-48">
              <ResponsiveContainer>
                <BarChart data={invSeries} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barGap={1}>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <YAxis width={44} axisLine={false} tickLine={false} tickCount={5} tick={{ fontSize: 11, fill: C.tick }}
                    tickFormatter={(v) => (hidden ? "" : formatIDR(v, { compact: true }).replace("Rp ", ""))} />
                  <XAxis dataKey="label" axisLine={{ stroke: C.axis }} tickLine={false} tick={{ fontSize: 11, fill: C.tick }} interval={1} />
                  <ReferenceLine y={0} stroke={C.axis} />
                  <Tooltip cursor={{ fill: C.cursor }} formatter={(v, k) => [hidden ? "Rp •••••" : formatIDR(v, { sign: k === "gain" }), k === "dep" ? t("Setoran bersih") : t("Untung/rugi")]}
                    contentStyle={{ borderRadius: 12, border: `1px solid ${C.tipBorder}`, background: C.tipBg, boxShadow: "none", fontSize: 13 }} />
                  <Bar dataKey="dep" fill={INV_COLOR} radius={[3, 3, 0, 0]} maxBarSize={10} />
                  <Bar dataKey="gain" radius={[3, 3, 0, 0]} maxBarSize={10}>
                    {invSeries.map((m, i) => <Cell key={i} fill={m.gain >= 0 ? GOOD : BAD} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card p-5">
            <p className="text-[15px] text-ink-soft">{t("Portofolio")}</p>
            <Money value={portfolio} className="block text-[34px] font-bold leading-tight tracking-tight" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Flow label={t("Disetor")} value={data.inv.in} color={INV_COLOR} />
              <Flow label={t("Ditarik")} value={data.inv.out} color={WARN} />
              <Flow label={t("Bersih")} value={data.inv.in - data.inv.out} color={data.inv.in - data.inv.out >= 0 ? "#5856D6" : BAD} sign />
            </div>
            {allocation.length > 0 && (
              <div className="mt-4">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">{t("Alokasi per instrumen")}</p>
                <div className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full">
                  {allocation.map((x) => <div key={x.key} style={{ flex: x.value, background: x.color }} />)}
                </div>
                <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  {allocation.map((x) => (
                    <li key={x.key} className="flex items-center gap-1.5 text-[14px]">
                      <i className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: x.color }} />
                      <span className="min-w-0 flex-1 truncate">{t(x.label)}</span>
                      <span className="tabular text-ink-soft">{Math.round((x.value / (portfolio || 1)) * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ul className="mt-3 divide-y divide-line">
              {invAccounts.map((a) => (
                <li key={a.id}>
                  <Link href={`/dompet/${a.id}`} className="flex items-center gap-3 py-2.5 active:opacity-60">
                    <AccountGlyph account={a} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px]">{a.name}</span>
                      <span className="block truncate text-[13px] text-ink-soft">
                        {t("Modal")} <Money value={invStats[a.id]?.modal || 0} compact dots={3} />
                        {invStats[a.id]?.stale && <span className="font-medium text-warn"> · {t("perlu diperbarui")}</span>}
                      </span>
                    </span>
                    <span className="flex-none text-right">
                      <Money value={a.balance} className="block text-[16px] font-semibold" dots={5} />
                      {invStats[a.id] && (
                        <span className={`block text-[13px] font-medium ${invStats[a.id].gain >= 0 ? "text-income" : "text-expense"}`}>
                          <Money value={invStats[a.id].gain} compact sign dots={3} />{invStats[a.id].pct !== null && ` (${invStats[a.id].gain >= 0 ? "+" : ""}${pctText(invStats[a.id].pct)}%)`}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <Explain title={t("Cara membaca")} text={t("Setoran & penarikan dicatat sebagai Transfer, jadi bukan pengeluaran. Modal = total setor − total tarik. Untung/rugi = nilai sekarang − modal; naik-turunnya tercatat setiap kali kamu memperbarui nilai investasi (paling pas di akhir bulan).")} />
        </div>
      </Sheet>

      <Sheet open={detail === "charity"} onClose={() => setDetail(null)} title={charityTitle} full>
        <div className="space-y-4 pb-6">
          <section className="card p-5">
            <p className="text-[15px] text-ink-soft">{t("Total di {period}", { period: periodLabel(period, anchor, ctx) })}</p>
            <Money value={data.charity.total} className="block text-[34px] font-bold leading-tight tracking-tight" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[14px] p-3" style={{ background: `${CHARITY}17` }}>
                <p className="text-[13px] font-semibold" style={{ color: CHARITY }}>{t("Dari pemasukan")}</p>
                <p className="text-[17px] font-bold">{charityRate === null ? "—" : `${pctText(charityRate)}%`}</p>
              </div>
              <Delta cur={data.charity.total} prev={data.charity.before} kind="income" label={t("vs {period}", { period: prevWord })} hidden={hidden} />
            </div>
            {data.charity.groups.length > 0 && <CategoryList groups={data.charity.groups} total={data.charity.total} qs={qs} />}
          </section>
          {data.charity.top.length > 0 && (
            <section>
              <h2 className="section-title mb-2 px-1">{t("Catatan terbesar")}</h2>
              <div className="card p-1">{data.charity.top.map((tx) => <TxRow key={tx.id} tx={tx} />)}</div>
            </section>
          )}
          <Explain title={t("Apa yang dihitung?")}
            text={t("Semua pengeluaran di kategori Religious Giving beserta sub-kategorinya (mis. Infaq & Sedekah, Zakat, Umroh, Gift), ditambah kategori lain yang namanya mengandung Infaq, Sedekah/Shadaqah, Zakat, Wakaf, Donasi, atau Amal. Persentase dihitung dari total pemasukan di periode yang sama.")} />
        </div>
      </Sheet>

      <Sheet open={detail === "budget"} onClose={() => setDetail(null)} title={t("Laporan anggaran")} full>
        <div className="space-y-4 pb-6">
          {budget.rate === null ? (
            <Empty title={t("Belum ada anggaran")} text={t("Anggaran diatur di Pengaturan, lalu laporannya tampil di sini.")} />
          ) : (
            <>
              <section className="card p-5">
                <p className="text-[15px] text-ink-soft">{t("Terpakai di {period}", { period: periodLabel(period, anchor, ctx) })}</p>
                <p className="text-[34px] font-bold leading-tight tracking-tight" style={{ color: budgetStatus.color }}>{Math.round(budget.rate * 100)}%</p>
                <p className="mt-1 text-[15px] text-ink-soft">
                  <Money value={budget.spent} className="font-semibold text-ink" dots={5} /> {t("dari")} <Money value={Math.round(budget.limit)} dots={5} />
                </p>
                <div className="mt-3"><PaceBar rate={budget.rate} pace={budget.pace} color={budgetStatus.color} big /></div>
                <p className="mt-2 text-[14px] font-medium" style={{ color: budgetStatus.color }}>{budgetStatus.label}</p>
                <p className="mt-1 text-[14px] text-ink-soft">
                  {budget.pace < 1
                    ? t("Idealnya sekitar {pct}% terpakai di titik ini.", { pct: Math.round(budget.pace * 100) })
                    : budget.spent > budget.limit ? <>{t("Lewat")} <Money value={budget.spent - budget.limit} dots={5} /></> : <>{t("Sisa")} <Money value={budget.limit - budget.spent} dots={5} /></>}
                  {budget.items.length > 1 && <> · {t("{n} dari {m} kategori lewat batas", { n: budget.over, m: budget.items.length })}</>}
                </p>
              </section>

              {budget.items.map((x) => {
                const tone = budgetTone(x.rate);
                return (
                  <section key={x.id} className="card p-5">
                    <div className="flex items-center gap-3">
                      <CategoryIcon category={x.cat} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[17px] font-semibold">{x.cat.name}</p>
                        <p className="truncate text-[13px] text-ink-soft">{x.budgets.map(perLabel).join(" · ")}</p>
                      </div>
                      <span className="tabular text-[17px] font-bold" style={{ color: tone }}>{Math.round(x.rate * 100)}%</span>
                    </div>
                    <div className="mt-3"><PaceBar rate={x.rate} pace={budget.pace} color={tone} /></div>
                    <p className="mt-2 text-[14px] text-ink-soft">
                      <Money value={x.spent} className="font-semibold text-ink" dots={4} /> {t("dari batas")} <Money value={Math.round(x.limit)} dots={4} />
                      {x.spent > x.limit && <span className="text-expense"> · {t("lewat")} <Money value={x.spent - x.limit} compact dots={3} /></span>}
                    </p>
                    {x.daily && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="min-w-0 rounded-[12px] bg-fill p-2.5">
                          <p className="text-[12px] text-ink-soft">{t("Hari ini")}</p>
                          {x.daily.today === null ? <p className="text-[15px] font-semibold text-ink-mute">—</p> : (
                            <Money value={x.daily.today} compact dots={3} className={`block text-[15px] font-semibold ${x.daily.today > x.daily.amount ? "text-expense" : ""}`} />
                          )}
                        </div>
                        <div className="min-w-0 rounded-[12px] bg-fill p-2.5">
                          <p className="text-[12px] text-ink-soft">{t("Rata-rata/hari")}</p>
                          <Money value={Math.round(x.daily.avg)} compact dots={3} className={`block text-[15px] font-semibold ${x.daily.avg > x.daily.amount ? "text-expense" : ""}`} />
                        </div>
                        <div className="min-w-0 rounded-[12px] bg-fill p-2.5">
                          <p className="text-[12px] text-ink-soft">{t("Hari lewat batas")}</p>
                          <p className={`text-[15px] font-semibold ${x.daily.over ? "text-expense" : "text-income"}`}>{t("{n} dari {m}", { n: x.daily.over, m: x.daily.days })}</p>
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
              <p className="px-1 text-[13px] text-ink-soft">{t("Batas disesuaikan dengan periode yang dipilih: anggaran harian × jumlah hari, mingguan × jumlah minggu.")}</p>
            </>
          )}
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

/** Batang pemakaian anggaran + penanda "idealnya sampai sini" (bagian periode yang sudah berjalan) */
function PaceBar({ rate, pace, color, big }) {
  const w = rate === null ? 0 : Math.min(1, rate);
  return (
    <span className={`relative block ${big ? "pt-1" : "pt-3"}`}>
      <span className={`block overflow-hidden rounded-full bg-rule ${big ? "h-3" : "h-2.5"}`}>
        <span className="block h-full rounded-full" style={{ width: `${w * 100}%`, background: color }} />
      </span>
      {rate !== null && pace > 0 && pace < 1 && (
        <i className="absolute -bottom-1 w-[2px] rounded-full bg-ink" style={{ left: `calc(${pace * 100}% - 1px)`, top: big ? 0 : 8 }} aria-hidden="true" />
      )}
    </span>
  );
}

/** Batang persentase terhadap pemasukan; `max` = nilai yang memenuhi batang */
function RateBar({ rate, color, label, max = 0.5 }) {
  const w = rate === null ? 0 : Math.max(0, Math.min(1, rate / max));
  return (
    <span className="block pt-3">
      <span className="block h-3 overflow-hidden rounded-full bg-rule">
        <span className="block h-full rounded-full" style={{ width: `${w * 100}%`, background: color }} />
      </span>
      <span className="mt-1.5 flex justify-between text-[11px] text-ink-soft"><span>0%</span><span className="truncate px-1">{label}</span><span>{Math.round(max * 100)}%</span></span>
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
