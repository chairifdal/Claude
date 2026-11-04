"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { useApp, useTransactions } from "@/lib/app-data";
import { amountToInput, monthRange, parseAmount, monthLabel } from "@/lib/format";
import { billStatus } from "@/lib/bills";
import { Money, PageHeader, Sheet, Empty } from "@/components/ui";
import AmountInput from "@/components/AmountInput";
import AccountPicker from "@/components/AccountPicker";

export default function BillsPage() {
  const { supabase, accountById, version, t } = useApp();
  const [all, setAll] = useState([]);
  const [edit, setEdit] = useState(null);
  const { start, end } = useMemo(() => monthRange(), []);
  const { rows } = useTransactions({ from: start, to: end, limit: 3000 });

  useEffect(() => {
    supabase.from("bills").select("*").order("due_day").then(({ data }) => setAll((data || []).map((b) => ({ ...b, amount: Number(b.amount) }))));
  }, [supabase, version]);

  const active = all.filter((b) => b.active && accountById[b.account_id]);
  const paused = all.filter((b) => !b.active && accountById[b.account_id]);
  const total = active.reduce((s, b) => s + b.amount, 0);

  return (
    <div>
      <PageHeader title={t("Tagihan rutin")} subtitle={t("{n} tagihan aktif", { n: active.length })} back="/"
        right={<button className="btn-primary h-10 px-4 text-[14px]" onClick={() => setEdit({})}><Plus className="h-4 w-4" /> {t("Tagihan")}</button>} />

      <div className="max-w-[640px] space-y-6">
        <section className="card p-6">
          <p className="text-[16px] text-ink-soft">{t("Total tagihan per bulan")}</p>
          <Money value={total} className="mt-1 block text-[30px] font-semibold" />
          <p className="mt-1 text-[14px] text-ink-soft">{t("Tagihan dibayar lewat tombol Bayar di Beranda, jadi statusnya otomatis lunas.")}</p>
        </section>

        {active.length === 0 ? (
          <Empty title={t("Belum ada tagihan rutin")} text={t("Contoh: Listrik tgl 20, Internet tgl 5, SPP tgl 10, cicilan motor tgl 25.")} />
        ) : (
          <BillList bills={active} rows={rows} onEdit={setEdit} />
        )}

        {paused.length > 0 && (
          <section>
            <h2 className="section-title mb-2">{t("Dijeda")}</h2>
            <BillList bills={paused} rows={rows} onEdit={setEdit} />
          </section>
        )}
      </div>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t("Ubah tagihan") : t("Tagihan baru")}>
        {edit && <BillForm key={edit.id || "new"} bill={edit.id ? edit : null} onDone={() => setEdit(null)} />}
      </Sheet>
    </div>
  );
}

function BillList({ bills, rows, onEdit }) {
  const { accountById, t } = useApp();
  return (
    <div className="card p-1">
      {bills.map((b) => {
        const s = billStatus(b, rows);
        return (
          <button key={b.id} onClick={() => onEdit(b)} className="flex min-h-[64px] w-full items-center gap-3 rounded-control px-3 py-2.5 text-left hover:bg-canvas">
            <span className="tabular grid h-10 w-10 flex-none place-items-center rounded-full border border-line text-[14px] font-medium">{b.due_day}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px]">{b.name}</span>
              <span className="block truncate text-[14px] text-ink-soft">
                {accountById[b.account_id]?.name} · {b.active ? (s.state === "paid" ? t("Lunas bulan ini") : t("Jatuh tempo {date}", { date: monthLabel(s.due, { day: "numeric", month: "short" }) })) : t("Dijeda")}
              </span>
            </span>
            <Money value={b.amount} className="flex-none text-[16px] font-medium" dots={5} />
          </button>
        );
      })}
    </div>
  );
}

function BillForm({ bill, onDone }) {
  const { supabase, accounts, categories, notify, refresh, t, canRecord, user } = useApp();
  const writable = accounts.filter(canRecord);
  const [name, setName] = useState(bill?.name || "");
  const [amount, setAmount] = useState(bill ? amountToInput(bill.amount) : "");
  const [dueDay, setDueDay] = useState(bill?.due_day || 1);
  const [accountId, setAccountId] = useState(bill?.account_id || writable[0]?.id || "");
  const [categoryId, setCategoryId] = useState(bill?.category_id || "");
  const [active, setActive] = useState(bill ? bill.active : true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const ownerId = accounts.find((a) => a.id === accountId)?.owner_id || user?.id;
  const cats = categories.filter((c) => c.kind === "expense" && c.owner_id === ownerId);
  const roots = cats.filter((c) => !c.parent_id);
  const valid = name.trim() && parseAmount(amount) > 0 && accountId;

  async function save() {
    if (!valid) return;
    setBusy(true);
    const payload = { name: name.trim(), amount: parseAmount(amount), due_day: Number(dueDay), account_id: accountId, category_id: categoryId || null, active };
    const { error } = bill ? await supabase.from("bills").update(payload).eq("id", bill.id) : await supabase.from("bills").insert(payload);
    setBusy(false);
    if (error) return notify(error.message, "err");
    notify(t("Tagihan disimpan")); refresh(); onDone();
  }
  async function remove() {
    const { error } = await supabase.from("bills").delete().eq("id", bill.id);
    if (error) return notify(error.message, "err");
    notify(t("Tagihan dihapus")); refresh(); onDone();
  }

  return (
    <div className="space-y-5 pb-4">
      <div>
        <label htmlFor="bill-name" className="label">{t("Nama tagihan")}</label>
        <input id="bill-name" className="field" placeholder={t("mis. Listrik PLN")} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
        <div>
          <label htmlFor="bill-amount" className="label">{t("Jumlah per bulan")}</label>
          <AmountInput id="bill-amount" value={amount} onChange={setAmount} />
        </div>
        <div>
          <label htmlFor="bill-day" className="label">{t("Tanggal")}</label>
          <select id="bill-day" className="field" value={dueDay} onChange={(e) => setDueDay(e.target.value)}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <AccountPicker id="bill-account" label={t("Dibayar dari")} accounts={writable} value={accountId} onChange={setAccountId} />
      <div>
        <label htmlFor="bill-cat" className="label">{t("Kategori")}</label>
        <select id="bill-cat" className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">{t("Tanpa kategori")}</option>
          {roots.map((r) => (
            <optgroup key={r.id} label={r.name}>
              <option value={r.id}>{r.name}</option>
              {cats.filter((c) => c.parent_id === r.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <label className="flex items-center justify-between gap-3">
        <span className="text-[16px]">{t("Aktif")}</span>
        <input type="checkbox" className="h-6 w-11 accent-ink" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </label>
      <div className="flex gap-2">
        {bill && (confirm
          ? <button className="btn-danger" onClick={remove}>{t("Yakin hapus?")}</button>
          : <button className="btn-danger w-12 px-0" onClick={() => setConfirm(true)} aria-label={t("Hapus")}><Trash2 className="h-5 w-5" /></button>)}
        <button className="btn-primary flex-1" disabled={!valid || busy} onClick={save}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("Simpan")}</button>
      </div>
    </div>
  );
}
