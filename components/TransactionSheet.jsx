"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, Check, Loader2, Trash2, Users } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { groupDigits, parseAmount, toLocalInput, formatIDR, firstName } from "@/lib/format";
import { AccountGlyph, CategoryIcon, Money, Segmented, Sheet } from "./ui";

const TYPES = [
  { value: "expense", label: "Pengeluaran", activeClass: "text-expense" },
  { value: "income", label: "Pemasukan", activeClass: "text-income" },
  { value: "transfer", label: "Transfer", activeClass: "text-transfer" },
];

const QUICK = [10000, 20000, 50000, 100000];

export default function TransactionSheet() {
  const { txSheet, closeTx } = useApp();
  return (
    <Sheet open={!!txSheet} onClose={closeTx} title={txSheet?.tx ? "Ubah transaksi" : "Catat transaksi"}>
      {txSheet && <TxForm key={txSheet.tx?.id || txSheet.type || "new"} init={txSheet} />}
    </Sheet>
  );
}

function TxForm({ init }) {
  const { supabase, user, accounts, accountById, categories, people, closeTx, notify, refresh } = useApp();
  const editing = init.tx || null;

  const writable = useMemo(() => accounts.filter((a) => a.my_role === "owner" || a.my_role === "editor"), [accounts]);

  const [type, setType] = useState(editing?.type || init.type || "expense");
  const [amount, setAmount] = useState(editing ? groupDigits(String(editing.amount)) : "");
  const [accountId, setAccountId] = useState(
    editing?.account_id || (writable.some((a) => a.id === init.accountId) ? init.accountId : writable[0]?.id) || ""
  );
  const [toAccountId, setToAccountId] = useState(editing?.to_account_id || init.toAccountId || "");
  const [categoryId, setCategoryId] = useState(editing?.category_id || "");
  const [occurredAt, setOccurredAt] = useState(toLocalInput(editing?.occurred_at || new Date()));
  const [note, setNote] = useState(editing?.note || "");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const from = accountById[accountId];
  const ownerId = from?.owner_id || user?.id;

  // Kategori mengikuti pemilik akun, supaya laporan pemilik tetap rapi
  const kindCats = useMemo(
    () => categories.filter((c) => c.kind === type && c.owner_id === ownerId),
    [categories, type, ownerId]
  );
  const roots = kindCats.filter((c) => !c.parent_id);
  const selected = categories.find((c) => c.id === categoryId);
  const activeRootId = selected ? (selected.parent_id || selected.id) : null;
  const children = kindCats.filter((c) => c.parent_id === activeRootId);

  useEffect(() => {
    if (selected && (selected.kind !== type || selected.owner_id !== ownerId)) setCategoryId("");
  }, [type, ownerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const destinations = accounts.filter((a) => a.id !== accountId);
  const mineDest = destinations.filter((a) => a.owner_id === user?.id);
  const sharedDest = destinations.filter((a) => a.owner_id !== user?.id);

  const value = parseAmount(amount);
  const valid = value > 0 && accountId && (type === "transfer" ? toAccountId && toAccountId !== accountId : true);

  async function save() {
    if (!valid) return;
    setBusy(true);
    const payload = {
      type,
      amount: value,
      account_id: accountId,
      to_account_id: type === "transfer" ? toAccountId : null,
      category_id: type === "transfer" ? null : categoryId || null,
      occurred_at: new Date(occurredAt).toISOString(),
      note: note.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("transactions").update(payload).eq("id", editing.id)
      : await supabase.from("transactions").insert(payload);
    setBusy(false);
    if (error) return notify(error.message.includes("row-level") ? "Kamu tidak punya akses untuk akun ini" : error.message, "err");
    notify(editing ? "Transaksi diperbarui" : "Transaksi tersimpan");
    refresh();
    closeTx();
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("transactions").delete().eq("id", editing.id);
    setBusy(false);
    if (error) return notify(error.message, "err");
    notify("Transaksi dihapus");
    refresh();
    closeTx();
  }

  if (!writable.length) {
    return <p className="py-8 text-center text-sm text-ink-mute">Buat akun dulu (atau minta akses "Bisa catat") sebelum mencatat transaksi.</p>;
  }

  const tone = type === "income" ? "text-income" : type === "transfer" ? "text-transfer" : "text-expense";

  return (
    <div className="space-y-5 pb-2">
      <Segmented value={type} onChange={setType} options={TYPES} />

      {/* Amount */}
      <div className="rounded-3xl bg-canvas px-4 py-5 text-center">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-mute">Jumlah</p>
        <div className={`mt-1 flex items-baseline justify-center gap-1.5 ${tone}`}>
          <span className="text-2xl font-extrabold">Rp</span>
          <input autoFocus={!editing} inputMode="numeric" placeholder="0" value={amount}
            onChange={(e) => setAmount(groupDigits(e.target.value))}
            className="tabular w-full max-w-[240px] bg-transparent text-left text-[40px] font-extrabold leading-none tracking-tight outline-none placeholder:text-ink-mute/40"
            style={{ width: `${Math.max(1, amount.length) * 0.62 + 0.4}em`, fontSize: amount.length > 11 ? 30 : 40 }} />
        </div>
        <div className="mt-3 flex justify-center gap-1.5">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => setAmount(groupDigits(String(value + q)))}
              className="chip bg-white text-ink-soft shadow-card">+{formatIDR(q, { compact: true }).replace("Rp ", "")}</button>
          ))}
        </div>
      </div>

      {/* Accounts */}
      <div>
        <span className="label">{type === "transfer" ? "Dari akun" : "Akun"}</span>
        <AccountScroller list={writable} value={accountId} onChange={setAccountId} people={people} userId={user?.id} />
      </div>

      {type === "transfer" && (
        <div>
          <div className="-mt-2 mb-2 flex justify-center">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-transfer-soft text-transfer"><ArrowDown className="h-4 w-4" /></span>
          </div>
          <span className="label">Ke akun</span>
          {mineDest.length > 0 && <AccountScroller list={mineDest} value={toAccountId} onChange={setToAccountId} people={people} userId={user?.id} />}
          {sharedDest.length > 0 && (
            <>
              <p className="mb-1.5 mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-ink-mute"><Users className="h-3.5 w-3.5" /> Akun pasangan yang dibagikan</p>
              <AccountScroller list={sharedDest} value={toAccountId} onChange={setToAccountId} people={people} userId={user?.id} />
            </>
          )}
          {!destinations.length && <p className="text-sm text-ink-mute">Belum ada akun tujuan.</p>}
        </div>
      )}

      {/* Categories */}
      {type !== "transfer" && (
        <div>
          <span className="label">Kategori {from && from.owner_id !== user?.id && <span className="normal-case tracking-normal">· milik {firstName(people[from.owner_id])}</span>}</span>
          <div className="grid grid-cols-4 gap-2">
            {roots.map((c) => {
              const active = activeRootId === c.id;
              return (
                <button key={c.id} type="button" onClick={() => setCategoryId(c.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl p-2 transition ${active ? "bg-white shadow-card ring-2" : "hover:bg-canvas"}`}
                  style={active ? { "--tw-ring-color": c.color } : undefined}>
                  <CategoryIcon category={c} size={42} />
                  <span className="line-clamp-2 text-center text-[11.5px] font-semibold leading-tight">{c.name}</span>
                </button>
              );
            })}
          </div>
          {children.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 rounded-2xl bg-canvas p-2">
              {children.map((c) => {
                const active = categoryId === c.id;
                return (
                  <button key={c.id} type="button" onClick={() => setCategoryId(active ? c.parent_id : c.id)}
                    className={`chip ${active ? "text-white" : "bg-white text-ink-soft"}`}
                    style={active ? { background: c.color } : undefined}>
                    {active && <Check className="h-3.5 w-3.5" />} {c.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        <div>
          <span className="label">Waktu</span>
          <input type="datetime-local" className="field" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
        </div>
        <div>
          <span className="label">Catatan</span>
          <input className="field" placeholder="Opsional, mis. makan siang bareng" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        {editing && (
          confirmDelete ? (
            <button className="btn-danger" onClick={remove} disabled={busy}>Yakin hapus?</button>
          ) : (
            <button className="btn-danger px-4" onClick={() => setConfirmDelete(true)} aria-label="Hapus"><Trash2 className="h-5 w-5" /></button>
          )
        )}
        <button className="btn-primary flex-1" disabled={!valid || busy} onClick={save}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : editing ? "Simpan perubahan" : "Simpan"}
        </button>
      </div>
    </div>
  );
}

function AccountScroller({ list, value, onChange, people, userId }) {
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
      {list.map((a) => {
        const active = value === a.id;
        const shared = a.owner_id !== userId;
        return (
          <button key={a.id} type="button" onClick={() => onChange(a.id)}
            className={`flex min-w-[150px] items-center gap-2.5 rounded-2xl border-2 p-2.5 pr-3.5 text-left transition ${active ? "border-brand-500 bg-brand-50" : "border-line bg-white"}`}>
            <AccountGlyph account={a} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-bold">{a.name}</span>
              <span className="block truncate text-[11.5px] text-ink-mute">
                {shared ? `Milik ${firstName(people[a.owner_id])}` : <Money value={a.balance} compact dots={4} />}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
