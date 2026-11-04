"use client";
import { Users } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { ACCOUNT_KINDS, ROLE_LABEL } from "@/lib/constants";
import { firstName } from "@/lib/format";
import { Money } from "./ui";

/** Kartu fisik akun: warna flat milik akun, rasio kartu asli (85.6 × 54 mm). */
export function BankCard({ account, className = "", concealed = false }) {
  const { people, user, t } = useApp();
  const kind = ACCOUNT_KINDS[account.kind] || ACCOUNT_KINDS.bank;
  const Icon = kind.icon;
  const shared = account.owner_id !== user?.id;
  const isCredit = account.kind === "credit";
  const debt = isCredit ? Math.max(0, -account.balance) : 0;
  const limit = Number(account.credit_limit) || 0;
  const usage = isCredit && limit ? Math.min(1, debt / limit) : 0;

  return (
    <div className={`relative overflow-hidden rounded-card text-white ${className}`}
      style={{ background: account.color || "#1d5fd6", aspectRatio: "1.586" }}>
      <div className="flex h-full flex-col p-5">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 shrink-0 opacity-90" strokeWidth={1.75} />
          <p className="min-w-0 flex-1 truncate text-[18px] font-semibold">{account.name}</p>
          {shared ? (
            <span className="chip bg-white/20 py-1 text-[14px] text-white">
              <Users className="h-3.5 w-3.5" /> {firstName(people[account.owner_id])} · {t(ROLE_LABEL[account.my_role])}
            </span>
          ) : account.member_count > 0 ? (
            <span className="chip bg-white/20 py-1 text-[14px] text-white"><Users className="h-3.5 w-3.5" /> {t("Dibagikan")}</span>
          ) : null}
        </div>
        <p className="mt-1 text-[14px] text-white/80">
          {t(kind.label)}{account.include_in_totals === false ? ` · ${t("tidak dihitung")}` : ""}
        </p>

        <div className={`mt-auto ${concealed ? "invisible" : ""}`} aria-hidden={concealed || undefined}>
          {isCredit ? (
            <>
              <p className="text-[14px] text-white/80">{t("Tagihan")}</p>
              <Money value={debt} className="block text-[30px] font-semibold leading-tight" />
              {limit > 0 && (
                <div className="mt-2">
                  <div className="h-2 overflow-hidden rounded-full bg-white/25">
                    {usage > 0 && <div className="h-full rounded-full bg-white" style={{ width: `${usage * 100}%` }} />}
                  </div>
                  <p className="mt-1 flex justify-between text-[14px] text-white/85">
                    <span>{t("Terpakai")} <Money value={debt} compact dots={4} /></span>
                    <span>{t("Limit")} <Money value={limit} compact dots={4} /></span>
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-3 h-7 w-10 rounded-[5px] bg-[#e8c770]" aria-hidden="true" />
              <p className="text-[14px] text-white/80">{t("Saldo")}</p>
              <Money value={account.balance} className="block text-[30px] font-semibold leading-tight" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
