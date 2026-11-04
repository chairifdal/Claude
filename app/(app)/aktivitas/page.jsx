"use client";
import { useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { useApp, useTransactions } from "@/lib/app-data";
import { monthRange, monthLabel, firstName } from "@/lib/format";
import { Money, PageHeader } from "@/components/ui";
import { TxGroupedList, txDirection } from "@/components/TxList";
import MonthSwitcher from "@/components/MonthSwitcher";

const FILTERS = [
  { value: "all", label: "Semua" },
  { value: "expense", label: "Pengeluaran" },
  { value: "income", label: "Pemasukan" },
  { value: "transfer", label: "Transfer" },
  { value: "partner", label: "Oleh pasangan" },
];

export default function ActivityPage() {
  const { accountById, categoryById, user, accounts, people, t } = useApp();
  const [month, setMonth] = useState(() => monthRange().start);
  const { start, end } = useMemo(() => monthRange(month), [month]);
  // ?akun=<id> dari halaman detail akun (layout hanya render di client, jadi window aman)
  const [accountId, setAccountId] = useState(() => new URLSearchParams(window.location.search).get("akun") || "");
  const { rows } = useTransactions({ from: start, to: end, limit: 5000, accountId: accountId || undefined });
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const list = useMemo(() => rows.filter((tx) => {
    if (filter === "partner" && tx.created_by === user?.id) return false;
    if (["expense", "income", "transfer"].includes(filter) && tx.type !== filter) return false;
    if (q) {
      const hay = [tx.note, categoryById[tx.category_id]?.name, tx.account_name, tx.to_account_name].join(" ").toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [rows, filter, q, user, categoryById]);

  const net = list.reduce((s, tx) => {
    const d = txDirection(tx, accountById, accountId || undefined);
    return s + (d === "in" ? tx.amount : d === "out" ? -(tx.amount + (tx.fee || 0)) : -(tx.fee || 0));
  }, 0);

  // Ekspor CSV (dibuka di Excel / Google Sheets); angka tanpa format supaya bisa dijumlah
  function exportCsv() {
    const head = [t("Tanggal"), t("Jenis"), t("Kategori"), t("Sub-kategori"), t("Akun"), t("Ke akun"), t("Jumlah"), t("Biaya transfer"), t("Catatan"), t("Dicatat oleh")];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = list.map((tx) => {
      const cat = categoryById[tx.category_id];
      const parent = cat?.parent_id ? categoryById[cat.parent_id] : null;
      return [
        new Date(tx.occurred_at).toISOString().slice(0, 16).replace("T", " "),
        tx.is_adjustment ? t("Penyesuaian saldo") : t(tx.type === "income" ? "Pemasukan" : tx.type === "expense" ? "Pengeluaran" : "Transfer"),
        parent ? parent.name : cat?.name || "",
        parent ? cat.name : "",
        accountById[tx.account_id]?.name || tx.account_name || "",
        tx.to_account_id ? accountById[tx.to_account_id]?.name || tx.to_account_name || "" : "",
        tx.amount,
        tx.fee || 0,
        tx.note || "",
        firstName(people[tx.created_by]),
      ].map(esc).join(",");
    });
    const blob = new Blob(["﻿" + [head.map(esc).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kantong-kita-${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}.csv`; // taste-skill-ignore: tanggal di nama file
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <PageHeader title={t("Aktivitas")} subtitle={monthLabel(month)} back="/"
        right={<button className="btn-ghost h-10 px-4 text-[14px]" onClick={exportCsv} disabled={!list.length}><Download className="h-4 w-4" /> CSV</button>} />
      <div className="max-w-[720px]">
        <MonthSwitcher value={month} onChange={setMonth} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-soft" />
            <input className="field pl-11" aria-label={t("Cari")} placeholder={t("Cari catatan, kategori, akun…")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select aria-label={t("Akun")} value={accountId} onChange={(e) => setAccountId(e.target.value)}
            className="h-12 w-full rounded-control border-0 bg-fill px-4 text-[17px]">
            <option value="">{t("Semua akun")}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)} aria-pressed={filter === f.value}
              className={`chip h-10 shrink-0 border ${filter === f.value ? "border-brand-600 bg-brand-600 text-white" : "border-transparent bg-fill text-ink"}`}>{t(f.label)}</button>
          ))}
        </div>
        <div className="my-4 flex items-center justify-between gap-3 text-[14px] text-ink-soft">
          <span>{t("{n} catatan", { n: list.length })}</span>
          <span>{t("Arus bersih")} <Money value={net} sign className={`font-medium ${net >= 0 ? "text-income" : "text-ink"}`} dots={5} /></span>
        </div>
        <TxGroupedList rows={list} perspectiveId={accountId || undefined} emptyText={t("Tidak ada catatan")} />
      </div>
    </div>
  );
}
