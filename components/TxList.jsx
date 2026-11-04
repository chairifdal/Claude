"use client";
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight, ReceiptText } from "lucide-react";
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

  let title, sub, icon;
  if (tx.type === "transfer") {
    title = dir === "in" ? `Dari ${fromName}` : dir === "out" ? `Ke ${toName}` : "Transfer";
    sub = `${fromName} → ${toName}`;
    const I = dir === "in" ? ArrowDownLeft : dir === "out" ? ArrowUpRight : ArrowLeftRight;
    icon = (
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-transfer-soft text-transfer">
        <I className="h-5 w-5" strokeWidth={2.4} />
      </span>
    );
  } else {
    title = cat?.name || (tx.type === "income" ? "Pemasukan" : "Pengeluaran");
    sub = [parent?.name, fromName].filter(Boolean).join(" · ");
    icon = <CategoryIcon category={cat || { color: tx.type === "income" ? "#0F9F6E" : "#E5484D" }} size={44} />;
  }

  const amountClass = dir === "in" ? "text-income" : dir === "out" ? "text-ink" : "text-transfer";

  return (
    <button type="button" disabled={!canEdit} onClick={() => openTx({ tx })}
      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition enabled:hover:bg-canvas enabled:active:scale-[.99]">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold">{title}</p>
        <p className="flex items-center gap-1.5 truncate text-[12.5px] text-ink-mute">
          {byOther && creator && <Avatar profile={creator} size={16} />}
          <span className="truncate">
            {byOther && creator ? `${firstName(creator)} · ` : ""}{tx.note || sub}
          </span>
        </p>
      </div>
      <div className="text-right">
        <Money value={dir === "in" ? tx.amount : dir === "out" ? -tx.amount : tx.amount} sign={dir === "in"}
          className={`text-[15px] font-extrabold ${amountClass}`} dots={5} />
        <p className="text-[11.5px] text-ink-mute">{timeLabel(tx.occurred_at)}</p>
      </div>
    </button>
  );
}

export function TxGroupedList({ rows, perspectiveId, emptyText = "Belum ada transaksi" }) {
  if (!rows.length) {
    return <Empty icon={ReceiptText} title={emptyText} text="Tekan tombol + untuk mencatat transaksi pertama." />;
  }
  const groups = [];
  let current = null;
  for (const tx of rows) {
    const key = new Date(tx.occurred_at).toDateString();
    if (!current || current.key !== key) { current = { key, date: tx.occurred_at, items: [] }; groups.push(current); }
    current.items.push(tx);
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="mb-1 px-2 text-[12px] font-bold uppercase tracking-wider text-ink-mute">{dayLabel(g.date)}</h3>
          <div className="card p-1.5">
            {g.items.map((tx) => <TxRow key={tx.id} tx={tx} perspectiveId={perspectiveId} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
