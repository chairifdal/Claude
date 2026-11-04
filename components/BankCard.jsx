"use client";
import { Users, Nfc } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { ACCOUNT_KINDS, ROLE_LABEL } from "@/lib/constants";
import { firstName } from "@/lib/format";
import { Money, shade } from "./ui";

/** Kartu ala dompet digital. `compact` = hanya strip header (untuk tumpukan). */
export function BankCard({ account, compact = false, className = "" }) {
  const { people, user } = useApp();
  const kind = ACCOUNT_KINDS[account.kind] || ACCOUNT_KINDS.bank;
  const Icon = kind.icon;
  const c = account.color || "#2440DE";
  const shared = account.owner_id !== user?.id;
  const isCredit = account.kind === "credit";
  const debt = isCredit ? Math.max(0, -account.balance) : 0;
  const usage = isCredit && account.credit_limit ? Math.min(1, debt / Number(account.credit_limit)) : 0;

  return (
    <div className={`relative overflow-hidden rounded-[1.6rem] text-white ${className}`}
      style={{ background: `linear-gradient(135deg, ${shade(c, 12)} 0%, ${c} 45%, ${shade(c, -35)} 100%)`, aspectRatio: compact ? undefined : "1.62" }}>
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-20 right-10 h-44 w-44 rounded-full bg-white/[.07]" />

      <div className="relative flex h-full flex-col p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-extrabold tracking-tight">{account.name}</p>
            <p className="truncate text-[11.5px] font-semibold uppercase tracking-wider text-white/70">
              {kind.label}{account.account_number ? ` · •••• ${account.account_number}` : ""}
            </p>
          </div>
          {shared ? (
            <span className="chip bg-white/15 py-1 text-[11px] text-white ring-1 ring-white/25">
              <Users className="h-3 w-3" /> {firstName(people[account.owner_id])} · {ROLE_LABEL[account.my_role]}
            </span>
          ) : account.member_count > 0 ? (
            <span className="chip bg-white/15 py-1 text-[11px] text-white ring-1 ring-white/25"><Users className="h-3 w-3" /> Dibagikan</span>
          ) : (
            <Nfc className="h-5 w-5 text-white/70" />
          )}
        </div>

        {!compact && (
          <>
            <div className="mt-auto">
              {isCredit ? (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-[.14em] text-white/70">Tagihan</p>
                  <Money value={debt} className="text-[28px] font-extrabold tracking-tight" />
                  {account.credit_limit && (
                    <div className="mt-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                        <div className="h-full rounded-full bg-white" style={{ width: `${usage * 100}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-white/70">Sisa limit <Money value={Number(account.credit_limit) - debt} compact dots={4} /></p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="mb-3 h-7 w-10 rounded-md bg-gradient-to-br from-amber-200 to-amber-500 opacity-90 shadow-inner" />
                  <p className="text-[11px] font-bold uppercase tracking-[.14em] text-white/70">Saldo</p>
                  <Money value={account.balance} className="text-[28px] font-extrabold tracking-tight" />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
