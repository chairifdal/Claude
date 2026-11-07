"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { parseAmount, formatIDR } from "@/lib/format";
import { Sheet, Money } from "./ui";
import AmountInput from "./AmountInput";

/**
 * Sesuaikan saldo: ketik saldo sebenarnya (sesuai m-banking), aplikasi mencatat satu
 * transaksi penyesuaian sebesar selisihnya. Penyesuaian tidak dihitung di statistik.
 */
export default function ReconcileSheet({ account, open, onClose }) {
  const { t } = useApp();
  return (
    <Sheet open={open} onClose={onClose} title={account?.kind === "investment" ? t("Perbarui nilai investasi") : t("Sesuaikan saldo")}>
      {open && <Form key={account.id} account={account} onDone={onClose} />}
    </Sheet>
  );
}

function Form({ account, onDone }) {
  const { supabase, notify, refresh, t } = useApp();
  const isCredit = account.kind === "credit";
  // Akun investasi: yang diketik adalah nilai portofolio terkini; selisihnya = untung/rugi
  const isInvest = account.kind === "investment";
  const [actual, setActual] = useState("");
  const [busy, setBusy] = useState(false);
  const entered = parseAmount(actual);
  // Kartu kredit: yang diketik adalah tagihan, disimpan sebagai saldo negatif
  const target = isCredit ? -entered : entered;
  const diff = Math.round((target - account.balance) * 100) / 100;
  const ready = actual !== "" && diff !== 0;

  async function save() {
    if (!ready || busy) return;
    setBusy(true);
    const { error } = await supabase.from("transactions").insert({
      account_id: account.id, type: diff > 0 ? "income" : "expense", amount: Math.abs(diff),
      is_adjustment: true, note: isInvest ? t(diff > 0 ? "Kenaikan nilai investasi" : "Penurunan nilai investasi") : t("Penyesuaian saldo"),
    });
    setBusy(false);
    if (error) return notify(error.message.includes("row-level") ? t("Kamu tidak punya akses untuk akun ini") : error.message, "err");
    notify(isInvest ? t("Nilai investasi diperbarui") : t("Saldo disesuaikan"));
    refresh(); onDone();
  }

  return (
    <div className="space-y-5 pb-4">
      <div className="rounded-[14px] bg-surface p-4">
        <p className="text-[14px] text-ink-soft">{isCredit ? t("Tagihan menurut aplikasi") : isInvest ? t("Nilai tercatat sekarang") : t("Saldo menurut aplikasi")}</p>
        <Money value={isCredit ? Math.max(0, -account.balance) : account.balance} className="block text-[24px] font-bold" />
      </div>
      <div>
        <label htmlFor="rec-actual" className="label">{isCredit ? t("Tagihan sebenarnya") : isInvest ? t("Nilai portofolio terkini") : t("Saldo sebenarnya")}</label>
        <AmountInput id="rec-actual" value={actual} onChange={setActual} />
        <p className="mt-2 pl-1 text-[14px] text-ink-soft">{isInvest ? t("Lihat total nilai di aplikasi investasimu (mis. Bibit, Stockbit). Paling pas diperbarui di akhir bulan.") : t("Lihat angka ini di m-banking, e-wallet, atau dompet Anda.")}</p>
      </div>
      {actual !== "" && (
        <div className={`rounded-[14px] p-4 ${diff === 0 ? "bg-income-soft" : "bg-fill"}`}>
          {diff === 0 ? (
            <p className="text-[16px] font-medium text-income-ink">{t("Sudah cocok, tidak perlu penyesuaian.")}</p>
          ) : (
            <>
              <p className="text-[14px] text-ink-soft">{isInvest ? (diff > 0 ? t("Untung yang akan dicatat") : t("Rugi yang akan dicatat")) : t("Selisih yang akan dicatat")}</p>
              <p className={`text-[22px] font-bold ${diff > 0 ? "text-income" : "text-expense"}`}>{formatIDR(diff, { sign: true })}</p>
              <p className="mt-1 text-[13px] text-ink-soft">{isInvest ? t("Masuk ke untung/rugi investasi di Analisis, bukan pemasukan atau pengeluaran.") : t("Dicatat sebagai \"Penyesuaian saldo\" dan tidak dihitung di grafik maupun anggaran.")}</p>
            </>
          )}
        </div>
      )}
      <button className="btn-primary w-full" disabled={!ready || busy} onClick={save}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : isInvest ? t("Perbarui") : t("Sesuaikan")}
      </button>
    </div>
  );
}
