"use client";
import Link from "next/link";
import { useApp } from "@/lib/app-data";
import { monthLabel } from "@/lib/format";
import { Money } from "./ui";

/** Hitung progres target tabungan sebuah akun/pocket. */
export function goalProgress(a, now = new Date()) {
  const goal = Number(a.goal_amount) || 0;
  if (!goal) return null;
  const saved = Math.max(0, a.balance);
  const left = Math.max(0, goal - saved);
  let perMonth = null;
  if (a.goal_date && left > 0) {
    const d = new Date(a.goal_date);
    const months = Math.max(1, (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth());
    perMonth = Math.ceil(left / months);
  }
  return { goal, saved, left, ratio: Math.min(1, saved / goal), perMonth, date: a.goal_date };
}

export function GoalBar({ p }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-rule">
      {p.ratio > 0 && <div className="h-full rounded-full bg-brand-600" style={{ width: `${p.ratio * 100}%` }} />}
    </div>
  );
}

export default function GoalsCard() {
  const { accounts, t } = useApp();
  const goals = accounts.map((a) => ({ a, p: goalProgress(a) })).filter((x) => x.p);
  if (!goals.length) return null;
  return (
    <section aria-labelledby="goals-title">
      <h2 id="goals-title" className="section-title mb-2">{t("Target tabungan")}</h2>
      <div className="card p-1">
        {goals.map(({ a, p }) => (
          <Link key={a.id} href={`/dompet/${a.id}`} className="block rounded-control px-4 py-3 hover:bg-canvas">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[16px] font-medium">{a.name}</span>
              <span className="tabular flex-none text-[14px] text-ink-soft">{Math.round(p.ratio * 100)}%</span>
            </div>
            <div className="mt-2"><GoalBar p={p} /></div>
            <p className="mt-1.5 text-[14px] text-ink-soft">
              <Money value={p.saved} dots={4} className="text-ink" /> {t("dari")} <Money value={p.goal} dots={4} />
              {p.left === 0 && <> · {t("Tercapai")}</>}
            </p>
            {p.perMonth ? (
              <p className="text-[14px] text-ink-soft">
                {t("Perlu")} <Money value={p.perMonth} dots={4} className="font-medium text-ink" /> {t("per bulan sampai {date}", { date: monthLabel(p.date, { month: "long", year: "numeric" }) })}
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
