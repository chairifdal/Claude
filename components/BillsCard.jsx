"use client";
import Link from "next/link";
import { useApp } from "@/lib/app-data";
import { billStatus, cardBills } from "@/lib/bills";
import { monthLabel } from "@/lib/format";
import { Money, Empty, AccountGlyph } from "./ui";

/** Tagihan rutin bulan ini: yang telat dan yang dekat jatuh tempo di atas, satu tombol Bayar per baris. */
export default function BillsCard({ monthRows, limit = 5 }) {
  const { bills, accounts, accountById, openTx, t, canRecord } = useApp();
  const cards = cardBills(accounts).sort((x, y) => (x.s.days ?? 99) - (y.s.days ?? 99));
  const items = bills
    .filter((b) => accountById[b.account_id])
    .map((b) => ({ b, s: billStatus(b, monthRows) }))
    .sort((x, y) => (x.s.state === "paid") - (y.s.state === "paid") || x.s.days - y.s.days);
  const unpaid = items.filter((x) => x.s.state !== "paid");
  const unpaidTotal = unpaid.reduce((s, x) => s + x.b.amount, 0) + cards.reduce((s, c) => s + c.amount, 0);
  const unpaidCount = unpaid.length + cards.length;

  return (
    <section className="card p-5" aria-labelledby="bills-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="bills-title" className="section-title">{t("Tagihan bulan ini")}</h2>
        <Link href="/tagihan" className="text-[14px] font-medium text-brand-600">{t("Atur")}</Link>
      </div>
      {items.length === 0 && cards.length === 0 ? (
        <div className="mt-3"><Empty title={t("Belum ada tagihan rutin")} text={t("Tambahkan listrik, internet, SPP, atau cicilan supaya tidak ada yang terlewat.")}
          action={<Link href="/tagihan" className="btn-ghost h-10 text-[14px]">{t("Tambah tagihan")}</Link>} /></div>
      ) : (
        <>
          <p className="mt-1 text-[14px] text-ink-soft">
            {unpaidCount ? <>{t("{n} belum dibayar", { n: unpaidCount })} · <Money value={unpaidTotal} dots={5} /></> : t("Semua sudah lunas")}
          </p>
          <ul className="mt-3">
            {/* Kartu kredit / paylater yang masih punya tagihan */}
            {cards.map(({ account: a, amount, s }) => (
              <li key={`card-${a.id}`} className="flex min-h-[60px] items-center gap-3 py-2">
                <AccountGlyph account={a} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px]">{a.name}</p>
                  <p className="truncate text-[14px] text-ink-soft">
                    {s.due ? t("Jatuh tempo {date}", { date: monthLabel(s.due, { day: "numeric", month: "short" }) }) : t("Atur tanggal jatuh tempo di akun")}
                  </p>
                </div>
                <div className="flex-none text-right">
                  <Money value={amount} className="block text-[16px] font-medium" dots={5} />
                  {s.due && <StatusPill s={s} t={t} />}
                </div>
                <div className="w-[68px] flex-none text-right">
                  <button className="h-8 rounded-full bg-brand-600 px-3.5 text-[14px] font-semibold text-white active:opacity-70"
                    onClick={() => openTx({ type: "transfer", toAccountId: a.id, amount, note: t("Bayar tagihan {name}", { name: a.name }) })}>
                    {t("Bayar")}
                  </button>
                </div>
              </li>
            ))}
            {items.slice(0, limit).map(({ b, s }) => {
              const acc = accountById[b.account_id];
              return (
                <li key={b.id} className="flex min-h-[60px] items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px]">{b.name}</p>
                    <p className="truncate text-[14px] text-ink-soft">
                      {s.state === "paid" ? t("Lunas") : t("Jatuh tempo {date}", { date: monthLabel(s.due, { day: "numeric", month: "short" }) })} · {acc.name}
                    </p>
                  </div>
                  <div className="flex-none text-right">
                    <Money value={b.amount} className="block text-[16px] font-medium" dots={5} />
                    <StatusPill s={s} t={t} />
                  </div>
                  <div className="w-[68px] flex-none text-right">
                    {s.state !== "paid" && canRecord(acc) && (
                      <button className="h-8 rounded-full bg-brand-600 px-3.5 text-[14px] font-semibold text-white active:opacity-70"
                        onClick={() => openTx({ type: "expense", accountId: b.account_id, amount: b.amount, categoryId: b.category_id, note: b.name, billId: b.id })}>
                        {t("Bayar")}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function StatusPill({ s, t }) {
  if (s.state === "paid") return <span className="inline-block rounded-full bg-income-soft px-2 text-[12px] font-medium text-income-ink">{t("Lunas")}</span>;
  if (s.state === "late") return <span className="inline-block rounded-full bg-expense-soft px-2 text-[12px] font-medium text-expense-ink">{t("Telat {n} hari", { n: -s.days })}</span>;
  if (s.state === "soon") return <span className="inline-block rounded-full bg-warn-soft px-2 text-[12px] font-medium text-warn-ink">{s.days === 0 ? t("Hari ini") : t("{n} hari lagi", { n: s.days })}</span>;
  return <span className="text-[12px] text-ink-soft">{t("{n} hari lagi", { n: s.days })}</span>;
}
