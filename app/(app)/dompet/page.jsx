"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Eye, EyeOff } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { ACCOUNT_GROUPS, ACCOUNT_KINDS } from "@/lib/constants";
import { firstName } from "@/lib/format";
import { Money, PageHeader, Empty, AccountGlyph } from "@/components/ui";
import WalletStack from "@/components/WalletStack";

export default function WalletPage() {
  const { accounts, allAccounts, openAccount, hidden, toggleHidden, user, people, t } = useApp();
  const sum = (list) => list.reduce((s, a) => s + a.balance, 0);
  const mine = accounts.filter((a) => a.owner_id === user?.id);
  const shared = accounts.filter((a) => a.owner_id !== user?.id);
  const groups = ACCOUNT_GROUPS.map((g) => ({ ...g, items: accounts.filter((a) => ACCOUNT_KINDS[a.kind]?.group === g.key) })).filter((g) => g.items.length);
  const [tab, setTab] = useState(null);
  const current = groups.find((g) => g.key === tab) || groups[0];
  const archived = allAccounts.filter((a) => a.archived && a.owner_id === user?.id);

  return (
    <div>
      <PageHeader title={t("Dompet")} subtitle={t("{n} akun · {m} dibagikan ke kamu", { n: accounts.length, m: shared.length })}
        right={<>
          <button className="icon-btn" onClick={toggleHidden} aria-label={hidden ? t("Tampilkan saldo") : t("Sembunyikan saldo")}>{hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
          <button className="btn-primary h-10 px-4 text-[14px]" onClick={() => openAccount({})}><Plus className="h-4 w-4" /> {t("Akun")}</button>
        </>} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[440px_minmax(0,1fr)] lg:items-start">
        <div>
          <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#1C1C1E] via-[#2C2C54] to-[#5856D6] p-5 text-white shadow-float">
            <div className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full bg-[#AF52DE]/40 blur-2xl" />
            <p className="relative text-[15px] font-medium text-white/75">{t("Kekayaan bersih, semua akun yang kamu lihat")}</p>
            <Money value={sum(accounts)} className="relative mt-1 block text-[34px] font-bold leading-tight tracking-tight" />
            <div className="relative mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[16px] bg-white/10 p-3">
                <p className="text-[13px] text-white/70">{t("milik kamu")}</p>
                <Money value={sum(mine)} compact className="text-[18px] font-bold" dots={5} />
              </div>
              <div className="rounded-[16px] bg-white/10 p-3">
                <p className="text-[13px] text-white/70">{t("dibagikan")}</p>
                <Money value={sum(shared)} compact className="text-[18px] font-bold" dots={5} />
              </div>
            </div>
          </section>

          {accounts.length === 0 ? (
            <div className="mt-6"><Empty title={t("Belum ada akun")} text={t("Buat rekening, e-wallet, atau pocket tabungan.")}
              action={<button className="btn-primary h-10 text-[14px]" onClick={() => openAccount({})}>{t("Buat akun")}</button>} /></div>
          ) : (
            <>
              <div role="tablist" className="mt-6 flex gap-6 overflow-x-auto border-b border-line no-scrollbar">
                {groups.map((g) => {
                  const active = g.key === current?.key;
                  return (
                    <button key={g.key} role="tab" aria-selected={active} onClick={() => setTab(g.key)}
                      className={`-mb-px flex-none border-b-2 pb-2.5 text-[16px] ${active ? "border-brand-600 font-semibold text-brand-600" : "border-transparent text-ink-soft"}`}>
                      {t(g.label)} <span className="tabular text-ink-mute">{g.items.length}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-right text-[14px] text-ink-soft">{t("Total")} <Money value={sum(current.items)} className="font-medium text-ink" dots={5} /></p>
              <div className="mt-2"><WalletStack key={current.key} accounts={current.items} /></div>
            </>
          )}
        </div>

        {/* Desktop: tabel akun di kolom kedua */}
        {accounts.length > 0 && (
          <section className="hidden lg:block">
            <h2 className="section-title mb-2">{t("Semua akun")}</h2>
            <div className="card p-1">
              {groups.map((g) => (
                <div key={g.key}>
                  <p className="px-3 pb-1 pt-3 text-[14px] text-ink-soft">{t(g.label)}</p>
                  {g.items.map((a) => <AccountRow key={a.id} a={a} user={user} people={people} />)}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {archived.length > 0 && (
        <section className="mt-8 lg:max-w-[440px]">
          <h2 className="section-title mb-2">{t("Diarsipkan")}</h2>
          <div className="card p-1">
            {archived.map((a) => <AccountRow key={a.id} a={a} user={user} people={people} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function AccountRow({ a, user, people }) {
  const { t } = useApp();
  const meta = a.owner_id !== user?.id ? t("Milik {name}", { name: firstName(people[a.owner_id]) }) : a.member_count > 0 ? t("Bersama") : t("Pribadi");
  return (
    <Link href={`/dompet/${a.id}`} className="flex min-h-[64px] items-center gap-3 rounded-control px-3 py-2.5 hover:bg-canvas">
      <AccountGlyph account={a} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-medium">{a.name}</span>
        <span className="block truncate text-[14px] text-ink-soft">{t(ACCOUNT_KINDS[a.kind]?.label)} · {meta}{a.include_in_totals === false ? ` · ${t("tidak dihitung")}` : ""}</span>
      </span>
      <Money value={a.balance} className="flex-none text-[16px] font-medium" dots={5} />
    </Link>
  );
}
