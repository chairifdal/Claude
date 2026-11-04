"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Archive, Trash2 } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { ACCOUNT_COLORS, ACCOUNT_KINDS } from "@/lib/constants";
import { amountToInput, parseAmount } from "@/lib/format";
import { Sheet, Switch } from "./ui";
import { BankCard } from "./BankCard";
import AmountInput from "./AmountInput";

export default function AccountSheet() {
  const { accountSheet, closeAccount, t } = useApp();
  return (
    <Sheet open={!!accountSheet} onClose={closeAccount} title={accountSheet?.account ? t("Ubah akun") : t("Akun baru")} full>
      {accountSheet && <AccountForm key={accountSheet.account?.id || "new"} account={accountSheet.account} />}
    </Sheet>
  );
}

function AccountForm({ account }) {
  const router = useRouter();
  const { supabase, user, closeAccount, notify, refresh, t } = useApp();
  const [name, setName] = useState(account?.name || "");
  const [kind, setKind] = useState(account?.kind || "bank");
  const [color, setColor] = useState(account?.color || ACCOUNT_COLORS[0]);
  const [initial, setInitial] = useState(account ? amountToInput(Math.abs(account.initial_balance)) : "");
  const [negative, setNegative] = useState(account ? account.initial_balance < 0 : false);
  const [limit, setLimit] = useState(account?.credit_limit ? amountToInput(account.credit_limit) : "");
  const [include, setInclude] = useState(account ? account.include_in_totals !== false : true);
  const [goal, setGoal] = useState(account?.goal_amount ? amountToInput(account.goal_amount) : "");
  const [goalDate, setGoalDate] = useState(account?.goal_date || "");
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
      include_in_totals: include,
      goal_amount: !isCredit && parseAmount(goal) > 0 ? parseAmount(goal) : null,
      goal_date: !isCredit && parseAmount(goal) > 0 && goalDate ? goalDate : null,
    };
    const { error } = account
      ? await supabase.from("accounts").update(payload).eq("id", account.id)
      : await supabase.from("accounts").insert({ ...payload, owner_id: user.id });
    setBusy(false);
    if (error) return notify(error.message, "err");
    notify(account ? t("Akun diperbarui") : t("Akun dibuat"));
    refresh();
    closeAccount();
  }

  async function archive() {
    await supabase.from("accounts").update({ archived: !account.archived }).eq("id", account.id);
    notify(account.archived ? t("Akun dipulihkan") : t("Akun diarsipkan"));
    refresh(); closeAccount(); router.push("/dompet");
  }

  async function remove() {
    const { error } = await supabase.from("accounts").delete().eq("id", account.id);
    if (error) return notify(error.message, "err");
    notify(t("Akun dihapus"));
    refresh(); closeAccount(); router.push("/dompet");
  }

  const preview = { name: name || t("Nama akun"), kind, color, balance: initialValue, credit_limit: parseAmount(limit), my_role: "owner", owner_id: user?.id, member_count: account?.member_count || 0 };

  return (
    <div className="space-y-6 pb-6">
      <div className="pointer-events-none mx-auto max-w-[340px]"><BankCard account={preview} /></div>

      <div>
        <label htmlFor="acc-name" className="label">{t("Nama akun")}</label>
        <input id="acc-name" className="field" placeholder={t("mis. BCA, Gopay, Dompet harian, Dana darurat")} value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <p className="label">{t("Jenis")}</p>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(ACCOUNT_KINDS).map(([k, v]) => {
            const Icon = v.icon;
            const active = kind === k;
            return (
              <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={active}
                className={`flex flex-col items-center gap-1 rounded-control border px-2 py-3 text-[14px] font-medium transition ${active ? "border-brand-600 bg-brand-50 text-brand-600 ring-1 ring-brand-600" : "border-line text-ink-soft"}`}>
                <Icon className="h-5 w-5" /> <span className="text-center leading-tight">{t(v.label.split(" /")[0])}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="label">{t("Warna kartu")}</p>
        <div className="flex flex-wrap gap-2.5">
          {ACCOUNT_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c}
              className="grid h-10 w-10 place-items-center rounded-full"
              style={{ background: c, outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}>
              {color === c && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="acc-initial" className="label">{isCredit ? t("Tagihan saat ini") : t("Saldo awal")}</label>
        <div className="flex gap-2">
          {!isCredit && (
            <button type="button" onClick={() => setNegative((n) => !n)} aria-label={negative ? t("Saldo minus") : t("Saldo plus")}
              className={`h-12 w-12 shrink-0 rounded-control border text-lg font-semibold ${negative ? "border-expense bg-expense-soft text-expense" : "border-control text-ink-soft"}`}>
              {negative ? "−" : "+"}
            </button>
          )}
          <AmountInput id="acc-initial" value={initial} onChange={setInitial} className="flex-1" />
        </div>
      </div>
      {isCredit && (
        <div>
          <label htmlFor="acc-limit" className="label">{t("Limit kartu")}</label>
          <AmountInput id="acc-limit" value={limit} onChange={setLimit} />
        </div>
      )}

      <Switch id="acc-include" checked={include} onChange={setInclude} label={t("Masuk hitungan")}
        description={t("Kalau dimatikan, transaksi akun ini tidak dihitung di grafik pemasukan/pengeluaran dan anggaran, tetapi saldonya tetap masuk total aset. Cocok untuk dana darurat, titipan, atau rekening usaha.")} />

      {!isCredit && (
        <div className="rounded-card bg-raised p-4">
          <p className="text-[16px] font-medium">{t("Target tabungan")} <span className="font-normal text-ink-soft">({t("opsional")})</span></p>
          <p className="mt-1 text-[14px] text-ink-soft">{t("Isi kalau akun ini untuk menabung, mis. dana darurat, liburan, atau DP rumah.")}</p>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_150px] gap-2">
            <AmountInput id="acc-goal" aria-label={t("Target")} value={goal} onChange={setGoal} />
            <input type="date" aria-label={t("Tanggal target")} className="field px-3" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} />
          </div>
        </div>
      )}

      <button className="btn-primary w-full" onClick={save} disabled={busy || !name.trim()}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : account ? t("Simpan perubahan") : t("Buat akun")}
      </button>

      {account && (
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={archive}><Archive className="h-4 w-4" /> {account.archived ? t("Pulihkan") : t("Arsipkan")}</button>
          {confirm
            ? <button className="btn-danger flex-1" onClick={remove}>{t("Hapus + semua transaksi?")}</button>
            : <button className="btn-danger flex-1" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" /> {t("Hapus")}</button>}
        </div>
      )}
    </div>
  );
}
