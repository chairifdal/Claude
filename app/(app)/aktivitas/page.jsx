"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useApp, useTransactions } from "@/lib/app-data";
import { monthRange } from "@/lib/format";
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
  const { accountById, categoryById, user } = useApp();
  const [month, setMonth] = useState(() => monthRange().start);
  const { start, end } = useMemo(() => monthRange(month), [month]);
  const { rows } = useTransactions({ from: start, to: end, limit: 2000 });
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const list = useMemo(() => rows.filter((t) => {
    if (filter === "partner" && t.created_by === user?.id) return false;
    if (["expense", "income", "transfer"].includes(filter) && t.type !== filter) return false;
    if (q) {
      const hay = [t.note, categoryById[t.category_id]?.name, t.account_name, t.to_account_name].join(" ").toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [rows, filter, q, user, categoryById]);

  const net = list.reduce((s, t) => {
    const d = txDirection(t, accountById);
    return s + (d === "in" ? t.amount : d === "out" ? -t.amount : 0);
  }, 0);

  return (
    <div>
      <PageHeader title="Aktivitas" back="/" />
      <MonthSwitcher value={month} onChange={setMonth} />
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-mute" />
        <input className="field pl-11" placeholder="Cari catatan, kategori, akun…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 no-scrollbar">
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`chip shrink-0 ${filter === f.value ? "bg-ink text-white" : "bg-white text-ink-soft shadow-card"}`}>{f.label}</button>
        ))}
      </div>
      <div className="my-4 flex items-center justify-between px-1 text-[13px]">
        <span className="font-semibold text-ink-mute">{list.length} transaksi</span>
        <span className="font-semibold text-ink-mute">Arus bersih <Money value={net} sign className={`font-extrabold ${net >= 0 ? "text-income" : "text-expense"}`} dots={5} /></span>
      </div>
      <TxGroupedList rows={list} emptyText="Tidak ada transaksi" />
    </div>
  );
}
