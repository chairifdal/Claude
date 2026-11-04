"use client";
import Link from "next/link";
import { Plus, Eye, EyeOff } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { ACCOUNT_GROUPS, ACCOUNT_KINDS } from "@/lib/constants";
import { firstName } from "@/lib/format";
import { Money, PageHeader, Empty, AccountGlyph } from "@/components/ui";
import WalletTile from "@/components/WalletTile";

// Warna per kelompok untuk bar alokasi
const GROUP_COLOR = { liquid: "#0A84FF", investment: "#AF52DE", credit: "#FF453A" };

export default function WalletPage() {
  const { accounts, allAccounts, openAccount, hidden, toggleHidden, user, people, t } = useApp();
  const sum = (list) => list.reduce((s, a) => s + a.balance, 0);
  const mine = accounts.filter((a) => a.owner_id === user?.id);
  const shared = accounts.filter((a) => a.owner_id !== user?.id);
  const groups = ACCOUNT_GROUPS.map((g) => ({ ...g, items: accounts.filter((a) => ACCOUNT_KINDS[a.kind]?.group === g.key) })).filter((g) => g.items.length);
  const archived = allAccounts.filter((a) => a.archived && a.owner_id === user?.id);

  // Alokasi: aset positif per kelompok + utang kartu kredit
  const parts = groups.map((g) => ({ key: g.key, label: g.label, value: Math.abs(sum(g.items)), color: GROUP_COLOR[g.key] })).filter((p) => p.value > 0);
  const partsTotal = parts.reduce((s, p) => s + p.value, 0) || 1;

  return (
    <div>
      <PageHeader title={t("Dompet")} subtitle={t("{n} akun · {m} dibagikan ke kamu", { n: accounts.length, m: shared.length })}
        right={<>
          <button className="icon-btn" onClick={toggleHidden} aria-label={hidden ? t("Tampilkan saldo") : t("Sembunyikan saldo")}>{hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
          <button className="icon-btn" onClick={() => openAccount({})} aria-label={t("Akun baru")}><Plus className="h-5 w-5" strokeWidth={2.4} /></button>
        </>} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
        <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#1C1C1E] via-[#2C2C54] to-[#5856D6] p-5 text-white shadow-float lg:sticky lg:top-6">
          <div className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full bg-[#AF52DE]/40 blur-2xl" />
          <p className="relative text-[15px] font-medium text-white/75">{t("Kekayaan bersih, semua akun yang kamu lihat")}</p>
          <Money value={sum(accounts)} className="relative mt-1 block text-[34px] font-bold leading-tight tracking-tight" />

          {parts.length > 0 && (
            <div className="relative mt-4">
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-white/10">
                {parts.map((p) => <div key={p.key} style={{ width: `${(p.value / partsTotal) * 100}%`, background: p.color }} />)}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                {parts.map((p) => (
                  <span key={p.key} className="flex items-center gap-1.5 text-[13px] text-white/80">
                    <i className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                    {t(p.label)} <Money value={p.key === "credit" ? -p.value : p.value} compact className="font-semibold text-white" dots={3} />
                  </span>
                ))}
              </div>
            </div>
          )}

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

        <div className="space-y-7">
          {accounts.length === 0 && (
            <Empty title={t("Belum ada akun")} text={t("Buat rekening, e-wallet, atau pocket tabungan.")}
              action={<button className="btn-primary h-11 text-[16px]" onClick={() => openAccount({})}>{t("Buat akun")}</button>} />
          )}

          {groups.map((g, gi) => (
            <section key={g.key}>
              <div className="mb-2.5 flex items-baseline justify-between px-1">
                <h2 className="section-title">{t(g.label)}</h2>
                <Money value={sum(g.items)} compact className="text-[15px] font-semibold text-ink-soft" dots={5} />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {g.items.map((a) => <WalletTile key={a.id} account={a} />)}
                {gi === 0 && (
                  <button onClick={() => openAccount({})}
                    className="flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-control text-[15px] font-medium text-ink-soft active:scale-[.97]">
                    <Plus className="h-6 w-6" /> {t("Akun / pocket baru")}
                  </button>
                )}
              </div>
            </section>
          ))}

          {archived.length > 0 && (
            <section>
              <h2 className="section-title mb-2 px-1">{t("Diarsipkan")}</h2>
              <div className="card p-1">
                {archived.map((a) => <AccountRow key={a.id} a={a} user={user} people={people} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountRow({ a, user, people }) {
  const { t } = useApp();
  const meta = a.owner_id !== user?.id ? t("Milik {name}", { name: firstName(people[a.owner_id]) }) : a.member_count > 0 ? t("Bersama") : t("Pribadi");
  return (
    <Link href={`/dompet/${a.id}`} className="flex min-h-[60px] items-center gap-3 rounded-[14px] px-3 py-2.5 opacity-70 active:bg-fill">
      <AccountGlyph account={a} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px]">{a.name}</span>
        <span className="block truncate text-[14px] text-ink-soft">{t(ACCOUNT_KINDS[a.kind]?.label)} · {meta}</span>
      </span>
      <Money value={a.balance} className="flex-none text-[16px] font-semibold" dots={5} />
    </Link>
  );
}
