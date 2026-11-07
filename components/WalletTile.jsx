"use client";
import Link from "next/link";
import { Users } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { ACCOUNT_KINDS, INSTRUMENTS, isGram } from "@/lib/constants";
import { firstName, formatGram } from "@/lib/format";
import { Money, shade, BrandTile } from "./ui";
import { parseIcon } from "@/lib/brands";
import { goalProgress } from "./GoalsCard";

/** Kartu kecil bergradien untuk grid Dompet (tanpa animasi geser). */
export default function WalletTile({ account: a }) {
  const { user, people, t } = useApp();
  const kind = ACCOUNT_KINDS[a.kind] || ACCOUNT_KINDS.bank;
  const Icon = kind.icon;
  const c = a.color || "#06B6D4";
  const shared = a.owner_id !== user?.id;
  const isCredit = a.kind === "credit";
  const debt = isCredit ? Math.max(0, -a.balance) : 0;
  const limit = Number(a.credit_limit) || 0;
  const goal = goalProgress(a);
  const bar = isCredit && limit ? Math.min(1, debt / limit) : goal ? goal.ratio : null;

  return (
    <Link href={`/dompet/${a.id}`}
      className="relative flex min-h-[148px] flex-col overflow-hidden rounded-[20px] p-4 text-white shadow-card transition active:scale-[.97]"
      style={{ background: `linear-gradient(140deg, ${shade(c, 20)} 0%, ${c} 55%, ${shade(c, -30)} 100%)` }}>
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/[.13]" />
      <div className="relative flex items-start justify-between">
        {parseIcon(a.icon) ? <BrandTile icon={a.icon} size={36} className="ring-1 ring-white/40" /> : (
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-white/20 ring-1 ring-white/25">
            <Icon className="h-[18px] w-[18px]" strokeWidth={2.3} />
          </span>
        )}
        {(shared || a.member_count > 0) && (
          <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">
            <Users className="h-3 w-3" /> {shared ? firstName(people[a.owner_id]) : t("Bersama")}
          </span>
        )}
      </div>
      <p className="relative mt-3 truncate text-[15px] font-semibold text-white/90">{a.name}</p>
      <Money value={isCredit ? -debt : a.balance} compact className="relative text-[21px] font-bold leading-tight tracking-tight" dots={5} />
      <div className="relative mt-auto pt-2">
        {bar !== null ? (
          <>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
              {bar > 0 && <div className="h-full rounded-full bg-white" style={{ width: `${bar * 100}%` }} />}
            </div>
            <p className="mt-1 truncate text-[12px] font-medium text-white/80">
              {isCredit ? t("{pct}% dari limit", { pct: Math.round(bar * 100) }) : t("{pct}% dari target", { pct: Math.round(bar * 100) })}
            </p>
          </>
        ) : (
          <p className="truncate text-[12px] font-medium text-white/75">
            {isGram(a) ? formatGram(a.qty_balance) : t(INSTRUMENTS[a.instrument]?.label || kind.label.split(" /")[0])}{a.include_in_totals === false ? ` · ${t("tidak dihitung")}` : ""}
          </p>
        )}
      </div>
    </Link>
  );
}
