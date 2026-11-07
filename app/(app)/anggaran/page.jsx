"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { useApp, useTransactions, rootCategory } from "@/lib/app-data";
import { amountToInput, parseAmount } from "@/lib/format";
import { daysBetween } from "@/lib/period";
import AmountInput from "@/components/AmountInput";
import { CategoryIcon, Money, PageHeader, Sheet, Empty, Segmented } from "@/components/ui";
import { BUDGET_PERIODS, PERIOD_LABEL, budgetWindow, periodOf } from "@/lib/budgets";

export default function BudgetPage() {
  const { categories, categoryById, budgets, user, t, countsInStats, statRows, cycle } = useApp();
  // Kembali ke halaman asal; bawaannya Pengaturan (tempat mengatur anggaran)
  const back = ({ pengaturan: "/pengaturan", analisis: "/analisis", beranda: "/" })[useSearchParams().get("dari")] || "/pengaturan";
  // Anggaran berlaku per periode keuangan (bulan kalender, tanggal tetap, atau gajian ke gajian)
  // Anggaran harian / mingguan / bulanan masing-masing punya rentang sendiri; ambil transaksi dari yang paling awal
  const now = new Date();
  const wins = Object.fromEntries(BUDGET_PERIODS.map((p) => [p, budgetWindow(p, now, cycle)]));
  const end = wins.monthly.end;
  const start = BUDGET_PERIODS.reduce((m, p) => (wins[p].start < m ? wins[p].start : m), wins.monthly.start);
  const qEnd = BUDGET_PERIODS.reduce((m, p) => (wins[p].end > m ? wins[p].end : m), end);
  const { rows } = useTransactions({ from: start, to: qEnd, limit: 5000 });
  const [edit, setEdit] = useState(null);

  // spentBy[periode][idKategoriInduk] = total pengeluaran dalam rentang periode itu
  const spentBy = useMemo(() => {
    const out = { daily: {}, weekly: {}, monthly: {} };
    for (const tx of statRows(rows)) {
      if (tx.type !== "expense" || !countsInStats(tx)) continue;
      const root = rootCategory(categoryById[tx.category_id], categoryById);
      if (!root) continue;
      const d = new Date(tx.occurred_at);
      for (const p of BUDGET_PERIODS) {
        if (d >= wins[p].start && d < wins[p].end) out[p][root.id] = (out[p][root.id] || 0) + tx.amount;
      }
    }
    return out;
  }, [rows, categoryById, countsInStats, statRows, wins.daily.start.getTime(), wins.weekly.start.getTime(), wins.monthly.start.getTime(), wins.monthly.end.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const spent = spentBy.monthly;

  const roots = categories.filter((c) => c.owner_id === user?.id && c.kind === "expense" && !c.parent_id);
  const withBudget = budgets.map((b) => ({ ...b, period: periodOf(b), cat: categoryById[b.category_id], spent: spentBy[periodOf(b)][b.category_id] || 0 })).filter((b) => b.cat);
  const without = roots.filter((c) => !budgets.some((b) => b.category_id === c.id));
  // Ringkasan di atas hanya anggaran bulanan (harian/mingguan tidak bisa dijumlahkan dengan bulanan)
  const monthly = withBudget.filter((b) => b.period === "monthly");
  const totalBudget = monthly.reduce((s, b) => s + b.amount, 0);
  const totalSpent = monthly.reduce((s, b) => s + b.spent, 0);
  const pct = totalBudget ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
  const daysLeft = Math.max(1, daysBetween(new Date(), end));

  return (
    <div>
      <PageHeader title={t("Atur anggaran")} back={back} subtitle={`${cycle.label(new Date())} · ${t("{n} hari lagi", { n: daysLeft })}`} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="space-y-6">
          {monthly.length > 0 && <section className="card p-6">
            <p className="text-[16px] text-ink-soft">{t("Sisa dari semua anggaran bulanan")}</p>
            <Money value={totalBudget - totalSpent} className={`mt-1 block text-[34px] font-semibold leading-tight ${totalSpent > totalBudget ? "text-expense" : ""}`} />
            <PlanTrack spent={totalSpent} plan={totalBudget} className="mt-4" />
            <p className="mt-2 flex justify-between text-[14px] text-ink-soft">
              <span>{t("Terpakai")} <Money value={totalSpent} dots={4} className="text-ink" /></span>
              <span>{t("dari")} <Money value={totalBudget} dots={4} className="text-ink" /></span>
            </p>
            {totalBudget > totalSpent && (
              <p className="mt-3 text-[16px] text-ink-soft">
                {t("Aman dipakai")} <Money value={Math.floor((totalBudget - totalSpent) / daysLeft)} className="font-medium text-ink" dots={4} /> {cycle.isCalendar ? t("per hari sampai akhir bulan") : t("per hari sampai gajian berikutnya")}
              </p>
            )}
          </section>}

          <section>
            <h2 className="section-title mb-2">{t("Per kategori")}</h2>
            {withBudget.length === 0 ? (
              <Empty title={t("Belum ada anggaran")} text={t("Pilih kategori di daftar untuk menetapkan batas harian, mingguan, atau bulanan.")} />
            ) : (
              <div className="space-y-4">
                {["daily", "weekly", "monthly"].filter((p) => withBudget.some((b) => b.period === p)).map((p) => (
                  <div key={p}>
                    <p className="label">{t(PERIOD_LABEL[p])} · {p === "daily" ? t("hari ini") : p === "weekly" ? t("minggu ini") : cycle.label(now)}</p>
                    <div className="card p-1">
                      {withBudget.filter((b) => b.period === p).sort((a, b) => b.spent / b.amount - a.spent / a.amount).map((b) => {
                        const over = b.spent > b.amount;
                        const near = !over && b.spent / b.amount >= 0.8;
                        return (
                          <button key={b.id} onClick={() => setEdit({ cat: b.cat, budget: b })} className="flex min-h-[80px] w-full items-center gap-3 rounded-control px-3 py-3 text-left hover:bg-canvas">
                            <CategoryIcon category={b.cat} size={44} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="truncate text-[16px] font-medium">{b.cat.name}</p>
                                <p className={`flex-none text-[14px] ${over ? "font-medium text-expense" : near ? "font-medium text-warn-ink" : "text-ink-soft"}`}>
                                  {over ? t("Lewat") : t("Sisa")} <Money value={Math.abs(b.amount - b.spent)} dots={4} />
                                </p>
                              </div>
                              <PlanTrack spent={b.spent} plan={b.amount} className="mt-2" />
                              <p className="tabular mt-1 text-[14px] text-ink-soft"><Money value={b.spent} dots={4} /> dari <Money value={b.amount} dots={4} /></p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {without.length > 0 && (
          <section>
            <h2 className="section-title mb-2">{t("Belum dianggarkan")}</h2>
            <div className="card p-1">
              {without.map((c) => (
                <button key={c.id} onClick={() => setEdit({ cat: c })} className="flex min-h-[60px] w-full items-center gap-3 rounded-control px-3 py-2 text-left hover:bg-canvas">
                  <CategoryIcon category={c} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px]">{c.name}</span>
                    <span className="block text-[14px] text-ink-soft">{spent[c.id] ? <>{t("Terpakai")} <Money value={spent[c.id]} dots={4} /></> : t("Belum ada pengeluaran")}</span>
                  </span>
                  <span className="flex-none text-[14px] font-medium text-brand-600">{t("Atur")}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.cat?.name || ""}>
        {edit && <BudgetForm key={edit.cat.id} cat={edit.cat} budget={edit.budget} onDone={() => setEdit(null)} />}
      </Sheet>
    </div>
  );
}

/** Track sepanjang rencana; bagian terpakai diisi; lewat anggaran ditandai merah di ujung. */
function PlanTrack({ spent, plan, className = "" }) {
  const ratio = plan ? spent / plan : 0;
  const over = ratio > 1;
  return (
    <div className={`flex h-2 gap-0.5 ${className}`}>
      <div className="relative h-full flex-1 overflow-hidden rounded-full bg-rule" style={over ? { flexGrow: 1 / ratio } : undefined}>
        {spent > 0 && <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(1, ratio) * 100}%` }} />}
      </div>
      {over && <div className="h-full rounded-full bg-expense" style={{ flexGrow: 1 - 1 / ratio }} />}
    </div>
  );
}

function BudgetForm({ cat, budget, onDone }) {
  const { supabase, user, budgets, notify, refresh, t } = useApp();
  const existing = (p) => budgets.find((b) => b.category_id === cat.id && periodOf(b) === p);
  const [period, setPeriod] = useState(budget ? periodOf(budget) : "monthly");
  const [amount, setAmount] = useState(budget ? amountToInput(budget.amount) : "");
  const [busy, setBusy] = useState(false);
  const current = existing(period);

  function pickPeriod(p) {
    setPeriod(p);
    const e = existing(p);
    setAmount(e ? amountToInput(e.amount) : "");
  }

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("budgets").upsert(
      { owner_id: user.id, category_id: cat.id, period, amount: parseAmount(amount) },
      { onConflict: "owner_id,category_id,period" }
    );
    setBusy(false);
    if (error) return notify(error.message, "err");
    notify(t("Anggaran disimpan")); refresh(); onDone();
  }
  async function remove() {
    await supabase.from("budgets").delete().eq("id", current.id);
    notify(t("Anggaran dihapus")); refresh(); onDone();
  }

  const limitLabel = period === "daily" ? t("Batas per hari") : period === "weekly" ? t("Batas per minggu") : t("Batas per bulan");

  return (
    <div className="space-y-4 pb-3">
      <div className="flex items-center gap-3 rounded-control bg-canvas p-3">
        <CategoryIcon category={cat} size={44} />
        <p className="text-[14px] text-ink-soft">{t("Termasuk semua sub-kategori dan transaksi pasangan di akun bersama milikmu.")}</p>
      </div>
      <div>
        <p className="label">{t("Periode")}</p>
        <Segmented value={period} onChange={pickPeriod} options={BUDGET_PERIODS.map((p) => ({ value: p, label: t(PERIOD_LABEL[p]) }))} />
        <p className="mt-2 pl-1 text-[13px] text-ink-soft">
          {period === "daily" ? t("Dihitung ulang setiap hari, mulai pukul 00.00.") : period === "weekly" ? t("Dihitung ulang setiap Senin.") : t("Mengikuti periode keuangan di Pengaturan.")}
        </p>
      </div>
      <div>
        <label htmlFor="budget-amount" className="label">{limitLabel}</label>
        <AmountInput id="budget-amount" value={amount} onChange={setAmount} />
      </div>
      <div className="flex gap-2">
        {current && <button className="btn-danger px-4" onClick={remove} aria-label={t("Hapus")}><Trash2 className="h-5 w-5" /></button>}
        <button className="btn-primary flex-1" disabled={busy || !parseAmount(amount)} onClick={save}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("Simpan")}
        </button>
      </div>
    </div>
  );
}
