"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, Trash2, Repeat } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { amountToInput, parseAmount, formatIDR, monthLabel, firstName } from "@/lib/format";
import { Money, PageHeader, Sheet, Empty, Segmented, Switch } from "@/components/ui";
import AmountInput from "@/components/AmountInput";
import AccountPicker from "@/components/AccountPicker";
import { nextRun } from "@/lib/recurring";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; // taste-skill-ignore: tanggal

export default function RecurringPage() {
  const { supabase, accountById, version, t } = useApp();
  const [all, setAll] = useState([]);
  const [edit, setEdit] = useState(null);

  useEffect(() => {
    supabase.from("recurring").select("*").order("day_of_month")
      .then(({ data }) => setAll((data || []).map((r) => ({ ...r, amount: Number(r.amount), fee: Number(r.fee) || 0 }))));
  }, [supabase, version]);

  const visible = all.filter((r) => accountById[r.account_id] || (r.to_account_id && accountById[r.to_account_id]));
  const active = visible.filter((r) => r.active);
  const paused = visible.filter((r) => !r.active);
  const monthlyOut = active.filter((r) => r.type !== "income").reduce((s, r) => s + r.amount + r.fee, 0);
  const monthlyIn = active.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <PageHeader title={t("Transaksi berulang")} subtitle={t("{n} jadwal aktif", { n: active.length })} back="/pengaturan"
        right={<button className="btn-primary h-10 w-10 px-0 text-[14px] sm:w-auto sm:px-4" onClick={() => setEdit({})} aria-label={t("Tambah jadwal")}><Plus className="h-4 w-4" /> <span className="hidden sm:inline">{t("Jadwal")}</span></button>} />

      <div className="max-w-[640px] space-y-6">
        <section className="card p-6">
          <div className="grid grid-cols-2 divide-x divide-line">
            <div className="pr-4">
              <p className="text-[14px] text-ink-soft">{t("Masuk otomatis / bulan")}</p>
              <Money value={monthlyIn} sign className="block text-[22px] font-medium text-income" dots={5} />
            </div>
            <div className="pl-4">
              <p className="text-[14px] text-ink-soft">{t("Keluar otomatis / bulan")}</p>
              <Money value={monthlyOut} className="block text-[22px] font-medium" dots={5} />
            </div>
          </div>
          <p className="mt-3 text-[14px] text-ink-soft">{t("Dicatat otomatis setiap hari pukul 00.05 WIB, atau saat aplikasi dibuka. Bulan yang terlewat ikut dicatat.")}</p>
        </section>

        {active.length === 0 ? (
          <Empty title={t("Belum ada transaksi berulang")} text={t("Contoh: gaji tiap tgl 25, uang belanja ke pasangan tiap tgl 1, iuran RT tiap tgl 5.")}
            action={<button className="btn-ghost h-10 text-[14px]" onClick={() => setEdit({})}><Plus className="h-4 w-4" /> {t("Tambah jadwal")}</button>} />
        ) : (
          <List items={active} onEdit={setEdit} />
        )}
        {paused.length > 0 && (
          <section>
            <h2 className="section-title mb-2">{t("Dijeda")}</h2>
            <List items={paused} onEdit={setEdit} />
          </section>
        )}
      </div>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t("Ubah jadwal") : t("Jadwal baru")} full>
        {edit && <RecurringForm key={edit.id || "new"} item={edit.id ? edit : null} onDone={() => setEdit(null)} />}
      </Sheet>
    </div>
  );
}

function List({ items, onEdit }) {
  const { accountById, categoryById, people, user, t } = useApp();
  return (
    <div className="card p-1">
      {items.map((r) => {
        const from = accountById[r.account_id];
        const to = r.to_account_id ? accountById[r.to_account_id] : null;
        const cat = r.category_id ? categoryById[r.category_id] : null;
        const title = r.note || (r.type === "transfer" ? t("{from} ke {to}", { from: from?.name || "…", to: to?.name || "…" }) : cat?.name || t(r.type === "income" ? "Pemasukan" : "Pengeluaran"));
        const nx = r.active ? nextRun(r) : null;
        return (
          <button key={r.id} onClick={() => onEdit(r)} className="flex min-h-[68px] w-full items-center gap-3 rounded-control px-3 py-2.5 text-left hover:bg-canvas">
            <span className="tabular grid h-10 w-10 flex-none place-items-center rounded-full border border-line text-[14px] font-medium">{r.day_of_month}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px]">{title}</span>
              <span className="block truncate text-[14px] text-ink-soft">
                {r.type === "transfer" ? t("Transfer") : from?.name}
                {nx ? ` · ${t("berikutnya {date}", { date: monthLabel(nx, { day: "numeric", month: "short" }) })}` : r.active ? ` · ${t("selesai")}` : ""}
                {r.created_by !== user?.id && people[r.created_by] ? ` · ${firstName(people[r.created_by])}` : ""}
              </span>
            </span>
            <Money value={r.type === "income" ? r.amount : -(r.amount + r.fee)} sign={r.type === "income"}
              className={`flex-none text-[16px] font-medium ${r.type === "income" ? "text-income" : ""}`} dots={5} />
          </button>
        );
      })}
    </div>
  );
}

function RecurringForm({ item, onDone }) {
  const { supabase, accounts, categories, notify, refresh, t, canRecord, user, lastAccountId } = useApp();
  const [type, setType] = useState(item?.type || "expense");
  const sources = useMemo(() => (type === "transfer" ? accounts : accounts.filter(canRecord)), [accounts, type, canRecord]);
  const [amount, setAmount] = useState(item ? amountToInput(item.amount) : "");
  const [fee, setFee] = useState(item?.fee ? amountToInput(item.fee) : "");
  const [accountId, setAccountId] = useState(item?.account_id || (sources.some((a) => a.id === lastAccountId()) ? lastAccountId() : sources[0]?.id) || "");
  const [toAccountId, setToAccountId] = useState(item?.to_account_id || "");
  const [categoryId, setCategoryId] = useState(item?.category_id || "");
  const [day, setDay] = useState(item?.day_of_month || new Date().getDate());
  const [startDate, setStartDate] = useState(item?.start_date || iso(new Date()));
  const [endDate, setEndDate] = useState(item?.end_date || "");
  const [note, setNote] = useState(item?.note || "");
  const [active, setActive] = useState(item ? item.active : true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => { if (!sources.some((a) => a.id === accountId)) setAccountId(sources[0]?.id || ""); }, [sources]); // eslint-disable-line react-hooks/exhaustive-deps

  const ownerId = accounts.find((a) => a.id === accountId)?.owner_id || user?.id;
  const cats = categories.filter((c) => c.kind === type && c.owner_id === ownerId);
  const roots = cats.filter((c) => !c.parent_id);
  const value = parseAmount(amount);
  const feeValue = type === "transfer" ? parseAmount(fee) : 0;
  const valid = value > 0 && accountId && (type !== "transfer" || (toAccountId && toAccountId !== accountId));

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    const payload = {
      type, amount: value, fee: feeValue, account_id: accountId,
      to_account_id: type === "transfer" ? toAccountId : null,
      category_id: type === "transfer" ? null : categoryId || null,
      day_of_month: Number(day), start_date: startDate, end_date: endDate || null, note: note.trim() || null, active,
    };
    const { error } = item ? await supabase.from("recurring").update(payload).eq("id", item.id) : await supabase.from("recurring").insert(payload);
    if (error) { setBusy(false); return notify(error.message.includes("row-level") ? t("Kamu tidak punya akses untuk akun ini") : error.message, "err"); }
    // Kalau tanggalnya sudah lewat bulan ini, langsung dicatat
    const { data: n } = await supabase.rpc("run_my_recurring");
    setBusy(false);
    notify(n > 0 ? t("Jadwal disimpan, {n} catatan dibuat", { n }) : t("Jadwal disimpan"));
    refresh(); onDone();
  }
  async function remove() {
    const { error } = await supabase.from("recurring").delete().eq("id", item.id);
    if (error) return notify(error.message, "err");
    notify(t("Jadwal dihapus")); refresh(); onDone();
  }

  return (
    <div className="space-y-6 pb-6">
      <Segmented value={type} onChange={setType} options={[
        { value: "expense", label: t("Pengeluaran") },
        { value: "income", label: t("Pemasukan") },
        { value: "transfer", label: t("Transfer") },
      ]} />
      <div>
        <label htmlFor="rec-amount" className="label">{t("Jumlah")}</label>
        <AmountInput id="rec-amount" value={amount} onChange={setAmount} />
      </div>
      <AccountPicker id="rec-from" label={type === "transfer" ? t("Dari akun") : t("Akun")} accounts={sources} value={accountId} onChange={setAccountId} />
      {type === "transfer" && (
        <>
          <AccountPicker id="rec-to" label={t("Ke akun")} accounts={accounts.filter((a) => a.id !== accountId)} value={toAccountId} onChange={setToAccountId} placeholder={t("Pilih akun tujuan")} />
          <div>
            <label htmlFor="rec-fee" className="label">{t("Biaya transfer")} <span className="font-normal text-ink-soft">({t("opsional")})</span></label>
            <AmountInput id="rec-fee" value={fee} onChange={setFee} />
          </div>
        </>
      )}
      {type !== "transfer" && (
        <div>
          <label htmlFor="rec-cat" className="label">{t("Kategori")}</label>
          <select id="rec-cat" className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{t("Tanpa kategori")}</option>
            {roots.map((r) => (
              <optgroup key={r.id} label={r.name}>
                <option value={r.id}>{r.name}</option>
                {cats.filter((c) => c.parent_id === r.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
        <div>
          <label htmlFor="rec-day" className="label">{t("Tanggal")}</label>
          <select id="rec-day" className="field" value={day} onChange={(e) => setDay(e.target.value)}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="rec-note" className="label">{t("Catatan")}</label>
          <input id="rec-note" className="field" placeholder={t("mis. Uang belanja bulanan")} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <p className="-mt-3 text-[14px] text-ink-soft">{t("Tanggal 29–31 otomatis jatuh di hari terakhir untuk bulan yang lebih pendek.")}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="rec-start" className="label">{t("Mulai")}</label>
          <input id="rec-start" type="date" className="field px-3" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="rec-end" className="label">{t("Sampai")} <span className="font-normal text-ink-soft">({t("opsional")})</span></label>
          <input id="rec-end" type="date" className="field px-3" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      {item && <Switch id="rec-active" checked={active} onChange={setActive} label={t("Aktif")} description={t("Matikan untuk menjeda tanpa menghapus jadwal.")} />}
      <div className="flex gap-2">
        {item && (confirm
          ? <button className="btn-danger" onClick={remove}>{t("Yakin hapus?")}</button>
          : <button className="btn-danger w-12 px-0" onClick={() => setConfirm(true)} aria-label={t("Hapus")}><Trash2 className="h-5 w-5" /></button>)}
        <button className="btn-primary flex-1" disabled={!valid || busy} onClick={save}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Repeat className="h-4 w-4" /> {t("Simpan jadwal")} · {formatIDR(value + feeValue)}</>}
        </button>
      </div>
    </div>
  );
}
