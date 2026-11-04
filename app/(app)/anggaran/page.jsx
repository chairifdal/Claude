"use client";
import { useMemo, useState } from "react";
import { Target, Plus, Loader2, Trash2 } from "lucide-react";
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
      <PageHeader title="Anggaran" subtitle="Batas pengeluaran bulanan" />

      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-500 to-teal-700 p-5 text-white shadow-lift" style={{ boxShadow: "0 20px 40px -18px rgba(13,148,136,.6)" }}>
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/10" />
        <p className="text-[12px] font-bold uppercase tracking-[.14em] text-white/70">Sisa anggaran</p>
        <Money value={totalBudget - totalSpent} className="mt-1 block text-[32px] font-extrabold tracking-tight" />
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[12.5px] text-white/80">
          <span>Terpakai <Money value={totalSpent} compact dots={4} /> dari <Money value={totalBudget} compact dots={4} /></span>
          <span>{daysLeft} hari lagi</span>
        </div>
      </section>

      <h2 className="section-title mb-2 mt-6">Per kategori</h2>
      {withBudget.length === 0 ? (
        <div className="card"><Empty icon={Target} title="Belum ada anggaran" text="Pilih kategori di bawah untuk menetapkan batas bulanan." /></div>
      ) : (
        <div className="space-y-2">
          {withBudget.map((b) => {
            const p = b.spent / b.amount;
            const over = p > 1;
            const color = over ? "#E5484D" : p > 0.8 ? "#F59E0B" : b.cat.color;
            return (
              <button key={b.id} onClick={() => setEdit({ cat: b.cat, budget: b })} className="card flex w-full items-center gap-3 p-3.5 text-left">
                <CategoryIcon category={b.cat} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-bold">{b.cat.name}</p>
                    <p className={`text-[12.5px] font-bold ${over ? "text-expense" : "text-ink-mute"}`}>
                      {over ? "Lewat " : "Sisa "}<Money value={Math.abs(b.amount - b.spent)} compact dots={4} />
                    </p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, p * 100)}%`, background: color }} />
                  </div>
                  <p className="mt-1 text-[12px] text-ink-mute"><Money value={b.spent} compact dots={4} /> / <Money value={b.amount} compact dots={4} /></p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {without.length > 0 && (
        <>
          <h2 className="section-title mb-2 mt-6">Tambah anggaran</h2>
          <div className="card divide-y divide-line">
            {without.map((c) => (
              <button key={c.id} onClick={() => setEdit({ cat: c })} className="flex w-full items-center gap-3 p-3 text-left">
                <CategoryIcon category={c} size={36} />
                <span className="flex-1 font-semibold">{c.name}</span>
                {spent[c.id] ? <Money value={spent[c.id]} compact className="text-[12.5px] text-ink-mute" dots={4} /> : null}
                <Plus className="h-5 w-5 text-brand-600" />
              </button>
            ))}
          </div>
        </>
      )}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.cat?.name || ""}>
        {edit && <BudgetForm key={edit.cat.id} cat={edit.cat} budget={edit.budget} onDone={() => setEdit(null)} />}
      </Sheet>
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
      <div className="flex items-center gap-3 rounded-2xl bg-canvas p-3">
        <CategoryIcon category={cat} size={44} />
        <p className="text-[13px] text-ink-soft">Termasuk semua sub-kategori dan transaksi pasangan di akun bersama milikmu.</p>
      </div>
      <div>
        <span className="label">Batas per bulan</span>
        <input autoFocus className="field tabular text-[20px] font-extrabold" inputMode="numeric" placeholder="Rp 0" value={amount} onChange={(e) => setAmount(groupDigits(e.target.value))} />
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
