"use client";
import { useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useApp, useTransactions, rootCategory } from "@/lib/app-data";
import { monthRange, groupDigits, parseAmount } from "@/lib/format";
import { CategoryIcon, Money, PageHeader, Sheet, Empty } from "@/components/ui";

export default function BudgetPage() {
  const { categories, categoryById, budgets, user } = useApp();
  const { start, end } = useMemo(() => monthRange(), []);
  const { rows } = useTransactions({ from: start, to: end, limit: 3000 });
  const [edit, setEdit] = useState(null);

  const spent = useMemo(() => {
    const m = {};
    for (const t of rows) {
      if (t.type !== "expense") continue;
      const root = rootCategory(categoryById[t.category_id], categoryById);
      if (root) m[root.id] = (m[root.id] || 0) + t.amount;
    }
    return m;
  }, [rows, categoryById]);

  const roots = categories.filter((c) => c.owner_id === user?.id && c.kind === "expense" && !c.parent_id);
  const withBudget = budgets.map((b) => ({ ...b, cat: categoryById[b.category_id], spent: spent[b.category_id] || 0 })).filter((b) => b.cat);
  const without = roots.filter((c) => !budgets.some((b) => b.category_id === c.id));
  const totalBudget = withBudget.reduce((s, b) => s + b.amount, 0);
  const totalSpent = withBudget.reduce((s, b) => s + b.spent, 0);
  const pct = totalBudget ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
  const daysLeft = new Date(end - 1).getDate() - new Date().getDate() + 1;

  return (
    <div>
      <PageHeader title="Anggaran" subtitle={`Bulan ini, ${daysLeft} hari lagi`} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="space-y-6">
          <section className="card p-6">
            <p className="text-[16px] text-ink-soft">Sisa dari semua anggaran</p>
            <Money value={totalBudget - totalSpent} className={`mt-1 block text-[34px] font-semibold leading-tight ${totalSpent > totalBudget ? "text-expense" : ""}`} />
            <PlanTrack spent={totalSpent} plan={totalBudget} className="mt-4" />
            <p className="mt-2 flex justify-between text-[14px] text-ink-soft">
              <span>Terpakai <Money value={totalSpent} dots={4} className="text-ink" /></span>
              <span>dari <Money value={totalBudget} dots={4} className="text-ink" /></span>
            </p>
          </section>

          <section>
            <h2 className="section-title mb-2">Per kategori</h2>
            {withBudget.length === 0 ? (
              <Empty title="Belum ada anggaran" text="Pilih kategori di daftar untuk menetapkan batas bulanan." />
            ) : (
              <div className="card p-1">
                {withBudget.sort((a, b) => b.spent / b.amount - a.spent / a.amount).map((b) => {
                  const over = b.spent > b.amount;
                  const near = !over && b.spent / b.amount >= 0.8;
                  return (
                    <button key={b.id} onClick={() => setEdit({ cat: b.cat, budget: b })} className="flex min-h-[80px] w-full items-center gap-3 rounded-control px-3 py-3 text-left hover:bg-canvas">
                      <CategoryIcon category={b.cat} size={44} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[16px] font-medium">{b.cat.name}</p>
                          <p className={`flex-none text-[14px] ${over ? "font-medium text-expense" : near ? "font-medium text-warn-ink" : "text-ink-soft"}`}>
                            {over ? "Lewat " : "Sisa "}<Money value={Math.abs(b.amount - b.spent)} dots={4} />
                          </p>
                        </div>
                        <PlanTrack spent={b.spent} plan={b.amount} className="mt-2" />
                        <p className="tabular mt-1 text-[14px] text-ink-soft"><Money value={b.spent} dots={4} /> dari <Money value={b.amount} dots={4} /></p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {without.length > 0 && (
          <section>
            <h2 className="section-title mb-2">Belum dianggarkan</h2>
            <div className="card p-1">
              {without.map((c) => (
                <button key={c.id} onClick={() => setEdit({ cat: c })} className="flex min-h-[60px] w-full items-center gap-3 rounded-control px-3 py-2 text-left hover:bg-canvas">
                  <CategoryIcon category={c} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px]">{c.name}</span>
                    <span className="block text-[14px] text-ink-soft">{spent[c.id] ? <>Terpakai <Money value={spent[c.id]} dots={4} /></> : "Belum ada pengeluaran"}</span>
                  </span>
                  <span className="flex-none text-[14px] font-medium text-brand-700">Atur</span>
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
  const { supabase, user, notify, refresh } = useApp();
  const [amount, setAmount] = useState(budget ? groupDigits(String(budget.amount)) : "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("budgets").upsert(
      { owner_id: user.id, category_id: cat.id, amount: parseAmount(amount) },
      { onConflict: "owner_id,category_id" }
    );
    setBusy(false);
    if (error) return notify(error.message, "err");
    notify("Anggaran disimpan"); refresh(); onDone();
  }
  async function remove() {
    await supabase.from("budgets").delete().eq("id", budget.id);
    notify("Anggaran dihapus"); refresh(); onDone();
  }

  return (
    <div className="space-y-4 pb-3">
      <div className="flex items-center gap-3 rounded-control bg-canvas p-3">
        <CategoryIcon category={cat} size={44} />
        <p className="text-[14px] text-ink-soft">Termasuk semua sub-kategori dan transaksi pasangan di akun bersama milikmu.</p>
      </div>
      <div>
        <span className="label">Batas per bulan</span>
        <input autoFocus className="field tabular text-[20px] font-semibold" inputMode="numeric" placeholder="Rp 0" value={amount} onChange={(e) => setAmount(groupDigits(e.target.value))} />
      </div>
      <div className="flex gap-2">
        {budget && <button className="btn-danger px-4" onClick={remove} aria-label="Hapus"><Trash2 className="h-5 w-5" /></button>}
        <button className="btn-primary flex-1" disabled={busy || !parseAmount(amount)} onClick={save}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Simpan"}
        </button>
      </div>
    </div>
  );
}
