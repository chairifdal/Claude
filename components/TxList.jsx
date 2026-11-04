"use client";
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { dayLabel, timeLabel, firstName } from "@/lib/format";
import { Avatar, CategoryIcon, Empty, Money } from "./ui";

/** Arah transaksi dari sudut pandang akun tertentu (atau semua akun yang terlihat) */
export function txDirection(tx, accountById, perspectiveId) {
  if (tx.type === "income") return "in";
  if (tx.type === "expense") return "out";
  if (perspectiveId) return tx.to_account_id === perspectiveId ? "in" : "out";
  const seeFrom = !!accountById[tx.account_id];
  const seeTo = !!accountById[tx.to_account_id];
  if (seeFrom && seeTo) return "move";
  return seeTo ? "in" : "out";
}

export function TxRow({ tx, perspectiveId }) {
  const { accountById, categoryById, people, user, openTx } = useApp();
  const dir = txDirection(tx, accountById, perspectiveId);
  const cat = tx.category_id ? categoryById[tx.category_id] : null;
  const parent = cat?.parent_id ? categoryById[cat.parent_id] : null;
  const from = accountById[tx.account_id];
  const to = tx.to_account_id ? accountById[tx.to_account_id] : null;
  const fromName = from?.name || tx.account_name || "Akun";
  const toName = to?.name || tx.to_account_name || "Akun";
  const creator = people[tx.created_by];
  const byOther = tx.created_by !== user?.id;
  const canEdit = from && (from.my_role === "owner" || from.my_role === "editor");

  let title, meta, icon;
  if (tx.type === "transfer") {
    title = dir === "in" ? `Dari ${fromName}` : dir === "out" ? `Ke ${toName}` : `${fromName} ke ${toName}`;
    meta = "Transfer";
    const I = dir === "in" ? ArrowDownLeft : dir === "out" ? ArrowUpRight : ArrowLeftRight;
    icon = (
      <span className="grid h-11 w-11 shrink-0 place-items-center text-ink-soft" aria-hidden="true">
        <I style={{ width: 22, height: 22 }} strokeWidth={1.6} />
      </span>
    );
  } else {
    title = cat?.name || (tx.type === "income" ? "Pemasukan" : "Pengeluaran");
    meta = [parent?.name, fromName].filter(Boolean).join(" · ");
    icon = <CategoryIcon category={cat || { color: "#94A3B8" }} size={44} />;
  }

  // Polaritas tenang: masuk hijau dengan +, keluar tinta dengan −
  const amount = dir === "in" ? tx.amount : dir === "out" ? -tx.amount : tx.amount;
  const amountClass = dir === "in" ? "text-income" : "text-ink";

  return (
    <button type="button" disabled={!canEdit} onClick={() => openTx({ tx })}
      className="flex min-h-[72px] w-full items-center gap-3 rounded-control px-3 py-3 text-left transition enabled:hover:bg-canvas">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-medium">{title}</p>
        <p className="flex items-center gap-1.5 truncate text-[14px] text-ink-soft">
          {byOther && creator && <Avatar profile={creator} size={18} />}
          <span className="truncate">{byOther && creator ? `${firstName(creator)} · ` : ""}{tx.note || meta}</span>
        </p>
      </div>
      <div className="flex-none text-right">
        <Money value={amount} sign={dir === "in"} className={`block text-[16px] font-medium ${amountClass}`} dots={5} />
        <p className="tabular text-[14px] text-ink-soft">{timeLabel(tx.occurred_at)}</p>
      </div>
    </button>
  );
}

export function TxGroupedList({ rows, perspectiveId, emptyText = "Belum ada transaksi", emptyHint = "Tekan + untuk mencatat yang pertama." }) {
  if (!rows.length) return <Empty title={emptyText} text={emptyHint} />;
  const groups = [];
  let current = null;
  for (const tx of rows) {
    const key = new Date(tx.occurred_at).toDateString();
    if (!current || current.key !== key) { current = { key, date: tx.occurred_at, items: [] }; groups.push(current); }
    current.items.push(tx);
  }
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="mb-2 text-[14px] font-medium text-ink-soft">{dayLabel(g.date)}</h3>
          <div className="card p-1">
            {g.items.map((tx) => <TxRow key={tx.id} tx={tx} perspectiveId={perspectiveId} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
