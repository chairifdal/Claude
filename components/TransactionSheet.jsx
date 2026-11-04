"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Trash2 } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { parseAmount, amountToInput, toLocalInput, firstName, formatIDR } from "@/lib/format";
import { CategoryIcon, Segmented, Sheet, Switch } from "./ui";
import AmountInput from "./AmountInput";
import AccountPicker from "./AccountPicker";

const QUICK = [10000, 20000, 50000, 100000];
// Biaya transfer umum di Indonesia: BI-FAST Rp 2.500, transfer online antarbank Rp 6.500
const FEES = [0, 2500, 6500];

export default function TransactionSheet() {
  const { txSheet, closeTx, t } = useApp();
  const title = txSheet?.tx ? t("Ubah catatan") : t("Catat");
  return (
    <Sheet open={!!txSheet} onClose={closeTx} title={title} full>
      {txSheet && <TxForm key={txSheet.tx?.id || `${txSheet.type}-${txSheet.billId || ""}`} init={txSheet} />}
    </Sheet>
  );
}

function TxForm({ init }) {
  const { supabase, user, accounts, accountById, categories, people, closeTx, notify, refresh, t, canRecord, lastAccountId, rememberAccount } = useApp();
  const editing = init.tx || null;

  const [type, setType] = useState(editing?.type || init.type || "expense");
  // Pemasukan/pengeluaran butuh akses catat; transfer cukup akses lihat (peran "Lihat & transfer")
  const sources = useMemo(() => (type === "transfer" ? accounts : accounts.filter(canRecord)), [accounts, type, canRecord]);
  const pickDefault = () => {
    const prefer = [editing?.account_id, init.accountId, lastAccountId()];
    // Akun asal tidak boleh sama dengan akun tujuan (mis. bayar tagihan kartu dari kartu itu sendiri)
    const ok = (id) => id && id !== init.toAccountId && sources.some((a) => a.id === id);
    return prefer.find(ok) || sources.find((a) => a.id !== init.toAccountId && a.kind !== "credit")?.id || sources.find((a) => a.id !== init.toAccountId)?.id || "";
  };

  const [amount, setAmount] = useState(editing ? amountToInput(editing.amount) : init.amount ? amountToInput(init.amount) : "");
  const [accountId, setAccountId] = useState(pickDefault);
  const [toAccountId, setToAccountId] = useState(editing?.to_account_id || init.toAccountId || "");
  const [categoryId, setCategoryId] = useState(editing?.category_id || init.categoryId || "");
  const [occurredAt, setOccurredAt] = useState(toLocalInput(editing?.occurred_at || new Date()));
  const [note, setNote] = useState(editing?.note || init.note || "");
  const [fee, setFee] = useState(editing?.fee ? amountToInput(editing.fee) : "");
  const [customFee, setCustomFee] = useState(!!editing?.fee && !FEES.includes(Number(editing.fee)));
  const [repeat, setRepeat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!sources.some((a) => a.id === accountId)) setAccountId(pickDefault());
  }, [type, sources]); // eslint-disable-line react-hooks/exhaustive-deps

  const from = accountById[accountId];
  const ownerId = from?.owner_id || user?.id;
  const kindCats = useMemo(() => categories.filter((c) => c.kind === type && c.owner_id === ownerId), [categories, type, ownerId]);
  const roots = kindCats.filter((c) => !c.parent_id);
  const selected = categories.find((c) => c.id === categoryId);
  const activeRootId = selected ? selected.parent_id || selected.id : null;
  const children = kindCats.filter((c) => c.parent_id === activeRootId);

  useEffect(() => {
    if (selected && (selected.kind !== type || selected.owner_id !== ownerId)) setCategoryId("");
  }, [type, ownerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const destinations = accounts.filter((a) => a.id !== accountId);
  const value = parseAmount(amount);
  const feeValue = type === "transfer" ? parseAmount(fee) : 0;
  const valid = value > 0 && accountId && (type === "transfer" ? toAccountId && toAccountId !== accountId : true);

  // Tanggal: Hari ini / Kemarin / tanggal lain
  const dayOffset = (() => {
    const d = new Date(occurredAt); const n = new Date();
    const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const b = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.round((b - a) / 86400000);
  })();
  const [customDate, setCustomDate] = useState(dayOffset > 1 || dayOffset < 0);
  const setDay = (offset) => {
    const d = new Date(); d.setDate(d.getDate() - offset);
    setOccurredAt(toLocalInput(d)); setCustomDate(false);
  };

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    const payload = {
      type, amount: value, account_id: accountId,
      to_account_id: type === "transfer" ? toAccountId : null,
      category_id: type === "transfer" ? null : categoryId || null,
      occurred_at: new Date(occurredAt).toISOString(),
      note: note.trim() || null,
      fee: feeValue,
      ...(init.billId && !editing ? { bill_id: init.billId } : {}),
    };
    const { error } = editing
      ? await supabase.from("transactions").update(payload).eq("id", editing.id)
      : await supabase.from("transactions").insert(payload);
    setBusy(false);
    if (error) return notify(error.message.includes("row-level") ? t("Kamu tidak punya akses untuk akun ini") : error.message, "err");
    if (repeat && !editing) {
      // Jadwal mulai bulan depan; catatan bulan ini sudah dibuat barusan
      const d = new Date(occurredAt);
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const { error: e2 } = await supabase.from("recurring").insert({
        type, amount: value, fee: feeValue, account_id: accountId, to_account_id: payload.to_account_id,
        category_id: payload.category_id, note: payload.note, day_of_month: d.getDate(),
        start_date: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`, // taste-skill-ignore: tanggal
      });
      if (e2) notify(e2.message, "err");
    }
    rememberAccount(accountId);
    notify(editing ? t("Catatan diperbarui") : t("Tersimpan"));
    refresh();
    closeTx();
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("transactions").delete().eq("id", editing.id);
    setBusy(false);
    if (error) return notify(error.message, "err");
    notify(t("Catatan dihapus")); refresh(); closeTx();
  }

  const verb = init.pay && !editing ? t("Bayar") : t("Simpan");

  // Tombol simpan menempel di bawah layar (sticky di dalam area scroll)
  const footer = (
      <div className="sticky bottom-0 -mx-4 mt-6 flex gap-2 border-t border-line bg-canvas/90 px-4 pt-3 pb-safe backdrop-blur-xl">
        {editing && (confirmDelete
          ? <button className="btn-danger" onClick={remove} disabled={busy}>{t("Yakin hapus?")}</button>
          : <button className="btn-danger w-12 px-0" onClick={() => setConfirmDelete(true)} aria-label={t("Hapus")}><Trash2 className="h-5 w-5" /></button>)}
        <button className="btn-primary flex-1" disabled={!valid || busy} onClick={save}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : value > 0 ? `${verb} ${formatIDR(value + feeValue)}` : verb}
        </button>
      </div>
  );

  if (!sources.length) {
    return <p className="py-8 text-[16px] text-ink-soft">{t("Buat akun dulu, atau minta akses \"Lihat, catat & ubah\" dari pasanganmu.")}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Peran "Lihat & transfer" hanya boleh transfer: jangan tawarkan ganti jenis saat mengubah transfernya */}
      {editing && editing.type === "transfer" && !canRecord(accountById[editing.account_id]) ? (
        <p className="rounded-[12px] bg-fill px-4 py-2.5 text-[15px] font-semibold">{t("Transfer")}</p>
      ) : editing?.is_adjustment ? (
        <p className="rounded-[12px] bg-fill px-4 py-2.5 text-[15px] font-semibold">{t("Penyesuaian saldo")}</p>
      ) : (
        <Segmented value={type} onChange={setType} options={[
          { value: "expense", label: t("Pengeluaran") },
          { value: "income", label: t("Pemasukan") },
          { value: "transfer", label: t("Transfer") },
        ]} />
      )}

      <div>
        <label htmlFor="tx-amount" className="label">{t("Jumlah")}</label>
        <AmountInput id="tx-amount" large value={amount} onChange={setAmount}
          tone={type === "income" ? "text-income" : "text-ink"} className="border-b-2 border-line pb-2 focus-within:border-ink" />
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => setAmount(amountToInput(value + q))}
              className="chip h-9 border border-transparent bg-fill text-ink">+{formatIDR(q, { compact: true }).replace("Rp ", "")}</button>
          ))}
        </div>
      </div>

      <AccountPicker id="tx-from" label={type === "transfer" ? t("Dari akun") : t("Akun")} accounts={sources} value={accountId} onChange={setAccountId} />
      {type === "transfer" && (
        <AccountPicker id="tx-to" label={t("Ke akun")} accounts={destinations} value={toAccountId} onChange={setToAccountId} placeholder={t("Pilih akun tujuan")} />
      )}
      {type === "transfer" && (
        <div>
          <p className="label">{t("Biaya transfer")}</p>
          <div className="flex flex-wrap gap-2">
            {FEES.map((f) => {
              const active = !customFee && parseAmount(fee) === f;
              return (
                <button key={f} type="button" aria-pressed={active} onClick={() => { setFee(f ? amountToInput(f) : ""); setCustomFee(false); }}
                  className={`chip h-10 border ${active ? "border-brand-600 bg-brand-600 text-white" : "border-transparent bg-fill text-ink"}`}>
                  {f === 0 ? t("Gratis") : `${formatIDR(f)} · ${f === 2500 ? "BI-FAST" : t("Online")}`}
                </button>
              );
            })}
            <button type="button" aria-pressed={customFee} onClick={() => setCustomFee(true)}
              className={`chip h-10 border ${customFee ? "border-brand-600 bg-brand-600 text-white" : "border-transparent bg-fill text-ink"}`}>{t("Lainnya")}</button>
          </div>
          {customFee && <AmountInput id="tx-fee" aria-label={t("Biaya transfer")} value={fee} onChange={setFee} className="mt-3" />}
          {feeValue > 0 && <p className="mt-2 text-[14px] text-ink-soft">{t("Saldo {name} berkurang {amount}", { name: from?.name || "", amount: formatIDR(value + feeValue) })}</p>}
        </div>
      )}

      {type !== "transfer" && (
        <div>
          <p className="label">
            {t("Kategori")} {from && from.owner_id !== user?.id && <span className="font-normal text-ink-soft">· {t("milik {name}", { name: firstName(people[from.owner_id]) })}</span>}
          </p>
          <div className="grid grid-cols-4 gap-1">
            {roots.map((c) => {
              const active = activeRootId === c.id;
              return (
                <button key={c.id} type="button" aria-pressed={active} onClick={() => setCategoryId(active && categoryId === c.id ? "" : c.id)}
                  className={`flex flex-col items-center gap-1 rounded-control border px-1 py-2 transition ${active ? "border-brand-600 bg-brand-50" : "border-transparent hover:bg-canvas"}`}>
                  <CategoryIcon category={c} size={32} />
                  <span className="line-clamp-2 text-center text-[13px] leading-tight">{c.name}</span>
                </button>
              );
            })}
          </div>
          {children.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {children.map((c) => {
                const active = categoryId === c.id;
                return (
                  <button key={c.id} type="button" aria-pressed={active} onClick={() => setCategoryId(active ? c.parent_id : c.id)}
                    className={`chip h-10 border ${active ? "border-brand-600 bg-brand-600 text-white" : "border-transparent bg-fill text-ink"}`}>
                    {active && <Check className="h-3.5 w-3.5" />} {c.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div>
        <p className="label">{t("Tanggal")}</p>
        <div className="flex flex-wrap gap-2">
          {[[0, t("Hari ini")], [1, t("Kemarin")]].map(([o, l]) => (
            <button key={o} type="button" aria-pressed={!customDate && dayOffset === o} onClick={() => setDay(o)}
              className={`chip h-10 border ${!customDate && dayOffset === o ? "border-brand-600 bg-brand-600 text-white" : "border-transparent bg-fill text-ink"}`}>{l}</button>
          ))}
          <button type="button" aria-pressed={customDate} onClick={() => setCustomDate(true)}
            className={`chip h-10 border ${customDate ? "border-brand-600 bg-brand-600 text-white" : "border-transparent bg-fill text-ink"}`}>{t("Tanggal lain")}</button>
        </div>
        {customDate && (
          <input type="datetime-local" aria-label={t("Tanggal")} className="field mt-3" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
        )}
      </div>

      <div>
        <label htmlFor="tx-note" className="label">{t("Catatan")} <span className="font-normal text-ink-soft">({t("opsional")})</span></label>
        <input id="tx-note" className="field" placeholder={t("mis. belanja mingguan")} value={note} onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()} />
      </div>
      {!editing && (
        <Switch id="tx-repeat" checked={repeat} onChange={setRepeat} label={t("Ulangi tiap bulan")}
          description={t("Dicatat otomatis setiap tanggal {day}, mulai bulan depan. Bisa diubah di Pengaturan, Transaksi berulang.", { day: new Date(occurredAt).getDate() })} />
      )}
      {footer}
    </div>
  );
}
