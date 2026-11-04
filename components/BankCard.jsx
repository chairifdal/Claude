"use client";
import { Users, Nfc } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { ACCOUNT_KINDS, ROLE_LABEL } from "@/lib/constants";
import { firstName } from "@/lib/format";
import { Money, shade } from "./ui";

/** Kartu ala Apple Wallet: gradien warna akun, lingkaran halus, chip emas. */
export function BankCard({ account, className = "", concealed = false }) {
  const { people, user, t } = useApp();
  const kind = ACCOUNT_KINDS[account.kind] || ACCOUNT_KINDS.bank;
  const Icon = kind.icon;
  const c = account.color || "#0EA5E9";
  const shared = account.owner_id !== user?.id;
  const isCredit = account.kind === "credit";
  const debt = isCredit ? Math.max(0, -account.balance) : 0;
  const limit = Number(account.credit_limit) || 0;
  const usage = isCredit && limit ? Math.min(1, debt / limit) : 0;

  return (
    <div className={`relative overflow-hidden rounded-[22px] text-white ${className}`}
      style={{ background: `linear-gradient(135deg, ${shade(c, 22)} 0%, ${c} 48%, ${shade(c, -38)} 100%)`, aspectRatio: "1.586" }}>
      <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/[.12]" />
      <div className="pointer-events-none absolute -bottom-20 right-16 h-44 w-44 rounded-full bg-white/[.08]" />
      <div className="relative flex h-full flex-col p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-white/20 ring-1 ring-white/25 backdrop-blur">
            <Icon className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[19px] font-bold tracking-tight">{account.name}</p>
            <p className="truncate text-[13px] font-medium text-white/75">
              {t(kind.label)}{account.include_in_totals === false ? ` · ${t("tidak dihitung")}` : ""}
            </p>
          </div>
          {shared ? (
            <span className="chip bg-white/20 py-1 text-[13px] text-white backdrop-blur">
              <Users className="h-3.5 w-3.5" /> {firstName(people[account.owner_id])} · {t(ROLE_LABEL[account.my_role])}
            </span>
          ) : account.member_count > 0 ? (
            <span className="chip bg-white/20 py-1 text-[13px] text-white backdrop-blur"><Users className="h-3.5 w-3.5" /> {t("Dibagikan")}</span>
          ) : <Nfc className="h-6 w-6 text-white/70" />}
        </div>

        <div className={`mt-auto ${concealed ? "invisible" : ""}`} aria-hidden={concealed || undefined}>
          {isCredit ? (
            <>
              <p className="text-[13px] font-medium text-white/75">{t("Tagihan")}</p>
              <Money value={debt} className="block text-[30px] font-bold leading-tight tracking-tight" />
              {limit > 0 && (
                <div className="mt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
                    {usage > 0 && <div className="h-full rounded-full bg-white" style={{ width: `${usage * 100}%` }} />}
                  </div>
                  <p className="mt-1 flex justify-between text-[13px] text-white/85">
                    <span>{t("Terpakai")} <Money value={debt} compact dots={4} /></span>
                    <span>{t("Limit")} <Money value={limit} compact dots={4} /></span>
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-3 h-7 w-10 rounded-[6px] bg-gradient-to-br from-[#F7E3A1] to-[#C9A13B] shadow-inner" aria-hidden="true" />
              <p className="text-[13px] font-medium text-white/75">{t("Saldo")}</p>
              <Money value={account.balance} className="block text-[30px] font-bold leading-tight tracking-tight" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
