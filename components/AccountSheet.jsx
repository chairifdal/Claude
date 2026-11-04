"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Archive, Trash2 } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { ACCOUNT_COLORS, ACCOUNT_KINDS } from "@/lib/constants";
import { groupDigits, parseAmount } from "@/lib/format";
import { Sheet } from "./ui";
import { BankCard } from "./BankCard";

export default function AccountSheet() {
  const { accountSheet, closeAccount } = useApp();
  return (
    <Sheet open={!!accountSheet} onClose={closeAccount} title={accountSheet?.account ? "Ubah akun" : "Akun baru"}>
      {accountSheet && <AccountForm key={accountSheet.account?.id || "new"} account={accountSheet.account} />}
    </Sheet>
  );
}

function AccountForm({ account }) {
  const router = useRouter();
  const { supabase, user, closeAccount, notify, refresh } = useApp();
  const [name, setName] = useState(account?.name || "");
  const [kind, setKind] = useState(account?.kind || "bank");
  const [color, setColor] = useState(account?.color || ACCOUNT_COLORS[0]);
  const [initial, setInitial] = useState(account ? groupDigits(String(Math.abs(account.initial_balance))) : "");
  const [negative, setNegative] = useState(account ? account.initial_balance < 0 : false);
  const [limit, setLimit] = useState(account?.credit_limit ? groupDigits(String(account.credit_limit)) : "");
  const [number, setNumber] = useState(account?.account_number || "");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const isCredit = kind === "credit";
  const initialValue = parseAmount(initial) * (negative || isCredit ? -1 : 1);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const payload = {
      name: name.trim(), kind, color,
      initial_balance: initialValue,
      credit_limit: isCredit ? parseAmount(limit) || null : null,
      account_number: number.trim() || null,
    };
    const { error } = account
      ? await supabase.from("accounts").update(payload).eq("id", account.id)
      : await supabase.from("accounts").insert({ ...payload, owner_id: user.id });
    setBusy(false);
    if (error) return notify(error.message, "err");
    notify(account ? "Akun diperbarui" : "Akun dibuat");
    refresh();
    closeAccount();
  }

  async function archive() {
    await supabase.from("accounts").update({ archived: !account.archived }).eq("id", account.id);
    notify(account.archived ? "Akun dipulihkan" : "Akun diarsipkan");
    refresh(); closeAccount(); router.push("/dompet");
  }

  async function remove() {
    const { error } = await supabase.from("accounts").delete().eq("id", account.id);
    if (error) return notify(error.message, "err");
    notify("Akun dihapus");
    refresh(); closeAccount(); router.push("/dompet");
  }

  const preview = { name: name || "Nama akun", kind, color, balance: initialValue, account_number: number, my_role: "owner", owner_id: user?.id, member_count: account?.member_count || 0 };

  return (
    <div className="space-y-5 pb-2">
      <div className="pointer-events-none"><BankCard account={preview} /></div>

      <div>
        <span className="label">Nama akun</span>
        <input className="field" placeholder="mis. BCA, Gopay, Dompet harian" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <span className="label">Jenis</span>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(ACCOUNT_KINDS).map(([k, v]) => {
            const Icon = v.icon;
            const active = kind === k;
            return (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3 text-[12px] font-bold transition ${active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line text-ink-soft"}`}>
                <Icon className="h-5 w-5" /> <span className="text-center leading-tight">{v.label.split(" /")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="label">Warna kartu</span>
        <div className="flex flex-wrap gap-2.5">
          {ACCOUNT_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={c}
              className="grid h-9 w-9 place-items-center rounded-full ring-offset-2 transition"
              style={{ background: c, boxShadow: color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : undefined }}>
              {color === c && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <span className="label">{isCredit ? "Tagihan saat ini" : "Saldo awal"}</span>
          <div className="flex gap-2">
            {!isCredit && (
              <button type="button" onClick={() => setNegative((n) => !n)}
                className={`w-12 shrink-0 rounded-2xl border text-lg font-bold ${negative ? "border-expense bg-expense-soft text-expense" : "border-line text-ink-soft"}`}>
                {negative ? "−" : "+"}
              </button>
            )}
            <input className="field tabular" inputMode="numeric" placeholder="0" value={initial} onChange={(e) => setInitial(groupDigits(e.target.value))} />
          </div>
        </div>
        {isCredit && (
          <div>
            <span className="label">Limit kartu</span>
            <input className="field tabular" inputMode="numeric" placeholder="0" value={limit} onChange={(e) => setLimit(groupDigits(e.target.value))} />
          </div>
        )}
        <div>
          <span className="label">4 digit terakhir (opsional)</span>
          <input className="field tabular" inputMode="numeric" maxLength={4} placeholder="1234" value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))} />
        </div>
      </div>

      <button className="btn-primary w-full" onClick={save} disabled={busy || !name.trim()}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : account ? "Simpan perubahan" : "Buat akun"}
      </button>

      {account && (
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={archive}><Archive className="h-4 w-4" /> {account.archived ? "Pulihkan" : "Arsipkan"}</button>
          {confirm
            ? <button className="btn-danger flex-1" onClick={remove}>Hapus + semua transaksi?</button>
            : <button className="btn-danger flex-1" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" /> Hapus</button>}
        </div>
      )}
    </div>
  );
}
