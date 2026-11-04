"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { useApp, useTransactions } from "@/lib/app-data";
import { parseAmount, amountToInput, formatIDR } from "@/lib/format";
import { CategoryIcon, Segmented } from "./ui";
import AmountInput from "./AmountInput";

/**
 * Catat cepat di Beranda: nominal → kategori yang paling sering dipakai → simpan.
 * Akun default = akun terakhir yang dipakai. "Ulangi" mengisi dari catatan yang sering berulang.
 */
export default function QuickEntry() {
  const { supabase, accounts, categories, categoryById, notify, refresh, t, canRecord, lastAccountId, rememberAccount, user, openTx } = useApp();
  const since = useMemo(() => new Date(Date.now() - 60 * 86400000), []);
  const { rows } = useTransactions({ from: since, limit: 400 });

  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const writable = accounts.filter(canRecord);
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!writable.some((a) => a.id === accountId)) {
      const last = lastAccountId();
      setAccountId(writable.some((a) => a.id === last) ? last : writable[0]?.id || "");
    }
  }, [writable, accountId, lastAccountId]);

  const account = writable.find((a) => a.id === accountId);
  const ownerId = account?.owner_id || user?.id;

  // Kategori yang paling sering dipakai (60 hari) untuk jenis & pemilik akun ini
  const frequent = useMemo(() => {
    const count = {};
    for (const r of rows) if (r.type === type && r.category_id) count[r.category_id] = (count[r.category_id] || 0) + 1;
    const pool = categories.filter((c) => c.kind === type && c.owner_id === ownerId);
    const used = pool.filter((c) => count[c.id]).sort((a, b) => count[b.id] - count[a.id]);
    const roots = pool.filter((c) => !c.parent_id && !count[c.id]);
    return [...used, ...roots].slice(0, 8);
  }, [rows, categories, type, ownerId]);

  // Catatan yang berulang: kategori + nominal yang sama ≥ 2 kali
  const repeats = useMemo(() => {
    const m = {};
    for (const r of rows) {
      if (r.type !== type || !r.category_id || r.created_by !== user?.id) continue;
      const k = `${r.category_id}|${r.amount}`;
      m[k] = m[k] || { categoryId: r.category_id, amount: r.amount, accountId: r.account_id, n: 0 };
      m[k].n++;
    }
    return Object.values(m).filter((x) => x.n >= 2 && categoryById[x.categoryId]).sort((a, b) => b.n - a.n).slice(0, 3);
  }, [rows, type, user, categoryById]);

  const value = parseAmount(amount);

  async function save() {
    if (!value || !accountId || busy) return;
    setBusy(true);
    const { error } = await supabase.from("transactions").insert({ type, amount: value, account_id: accountId, category_id: categoryId || null });
    setBusy(false);
    if (error) return notify(error.message, "err");
    rememberAccount(accountId);
    notify(t("Tersimpan: {amount}", { amount: formatIDR(value) }));
    setAmount(""); setCategoryId("");
    refresh();
  }

  if (!writable.length) return null;

  return (
    <section className="card p-5" aria-labelledby="quick-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="quick-title" className="section-title whitespace-nowrap">{t("Catat cepat")}</h2>
        <Segmented value={type} onChange={(v) => { setType(v); setCategoryId(""); }} className="w-[160px] flex-none" options={[
          { value: "expense", label: t("Keluar") },
          { value: "income", label: t("Masuk") },
        ]} />
      </div>

      <div className="mt-4 flex gap-2">
        <AmountInput id="quick-amount" aria-label={t("Jumlah")} value={amount} onChange={setAmount} className="min-w-0 flex-1"
          onKeyDown={(e) => e.key === "Enter" && save()} />
        <select aria-label={t("Akun")} value={accountId} onChange={(e) => setAccountId(e.target.value)}
          className="h-12 w-[38%] min-w-0 rounded-control border border-control bg-white px-3 text-[16px]">
          {writable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {repeats.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {repeats.map((r) => (
            <button key={`${r.categoryId}${r.amount}`} type="button"
              onClick={() => { setAmount(amountToInput(r.amount)); setCategoryId(r.categoryId); if (writable.some((a) => a.id === r.accountId)) setAccountId(r.accountId); }}
              className="chip h-9 border border-transparent bg-fill text-ink">
              <RotateCcw className="h-3.5 w-3.5 text-ink-soft" /> {categoryById[r.categoryId].name} {formatIDR(r.amount, { compact: true })}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-4 gap-1">
        {frequent.map((c) => {
          const active = categoryId === c.id;
          return (
            <button key={c.id} type="button" aria-pressed={active} onClick={() => setCategoryId(active ? "" : c.id)}
              className={`flex flex-col items-center gap-1 rounded-control border px-1 py-2 ${active ? "border-brand-600 bg-brand-50" : "border-transparent hover:bg-canvas"}`}>
              <CategoryIcon category={c} size={28} />
              <span className="line-clamp-2 text-center text-[13px] leading-tight">{c.name}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex gap-2">
        <button type="button" className="btn-ghost h-11 px-4 text-[14px]" onClick={() => openTx({ type, accountId, amount: value || undefined, categoryId: categoryId || undefined })}>
          {t("Detail lainnya")}
        </button>
        <button type="button" className="btn-primary h-11 flex-1 text-[15px]" disabled={!value || busy} onClick={save}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-4 w-4" /> {t("Simpan")}</>}
        </button>
      </div>
    </section>
  );
}
