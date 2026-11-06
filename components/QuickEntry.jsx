"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useApp, useTransactions } from "@/lib/app-data";
import { parseAmount, formatIDR } from "@/lib/format";
import { CategoryIcon, Segmented } from "./ui";
import AmountInput from "./AmountInput";

/**
 * Catat cepat di Beranda: nominal → kategori yang paling sering dipakai → simpan.
 * Akun default = akun terakhir yang dipakai.
 */
export default function QuickEntry() {
  const { supabase, accounts, categories, notify, refresh, t, canRecord, lastAccountId, rememberAccount, user, openTx } = useApp();
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
    // Semua kategori: yang sering dipakai di depan, sisanya kategori utama
    return [...used, ...roots];
  }, [rows, categories, type, ownerId]);

  // Per halaman 8 kategori (4 x 2); halaman berikutnya digeser (HP) atau diklik panah (desktop)
  const PAGE = 8;
  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < frequent.length; i += PAGE) out.push(frequent.slice(i, i + PAGE));
    return out;
  }, [frequent]);
  const pagerRef = useRef(null);
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); if (pagerRef.current) pagerRef.current.scrollLeft = 0; }, [type, ownerId]);
  function goPage(i) {
    const el = pagerRef.current;
    if (!el) return;
    const n = Math.max(0, Math.min(pages.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
    setPage(n);
  }

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
          className="h-12 w-[38%] min-w-0 rounded-control border-0 bg-fill px-3 text-[16px]">
          {writable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <div className="relative mt-4">
        <div ref={pagerRef} className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
          onScroll={(e) => { const el = e.currentTarget; setPage(Math.round(el.scrollLeft / el.clientWidth)); }}>
          {pages.map((items, pi) => (
            <div key={pi} className="grid w-full flex-none snap-start snap-always grid-cols-4 content-start gap-1">
              {items.map((c) => {
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
          ))}
        </div>
        {pages.length > 1 && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <button type="button" aria-label={t("Sebelumnya")} onClick={() => goPage(page - 1)} disabled={page === 0}
              className="hidden h-7 w-7 place-items-center rounded-full bg-fill text-ink-soft disabled:opacity-30 md:grid">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex gap-1.5" role="tablist">
              {pages.map((_, i) => (
                <button key={i} type="button" role="tab" aria-selected={i === page} aria-label={t("Halaman {n}", { n: i + 1 })} onClick={() => goPage(i)}
                  className={`h-1.5 rounded-full transition-all ${i === page ? "w-4 bg-brand-600" : "w-1.5 bg-ink-mute/40"}`} />
              ))}
            </div>
            <button type="button" aria-label={t("Berikutnya")} onClick={() => goPage(page + 1)} disabled={page === pages.length - 1}
              className="hidden h-7 w-7 place-items-center rounded-full bg-fill text-ink-soft disabled:opacity-30 md:grid">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
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
