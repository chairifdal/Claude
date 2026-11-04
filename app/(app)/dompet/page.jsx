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
  const { accounts, allAccounts, openAccount, hidden, toggleHidden, user, people } = useApp();
  const sum = (list) => list.reduce((s, a) => s + a.balance, 0);
  const mine = accounts.filter((a) => a.owner_id === user?.id);
  const shared = accounts.filter((a) => a.owner_id !== user?.id);
  const groups = ACCOUNT_GROUPS.map((g) => ({ ...g, items: accounts.filter((a) => ACCOUNT_KINDS[a.kind]?.group === g.key) })).filter((g) => g.items.length);
  const [tab, setTab] = useState(null);
  const current = groups.find((g) => g.key === tab) || groups[0];
  const archived = allAccounts.filter((a) => a.archived && a.owner_id === user?.id);

  return (
    <div>
      <PageHeader title="Dompet" subtitle={`${accounts.length} akun · ${shared.length} dibagikan ke kamu`}
        right={<>
          <button className="icon-btn" onClick={toggleHidden} aria-label={hidden ? "Tampilkan saldo" : "Sembunyikan saldo"}>{hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
          <button className="btn-primary h-10 px-4 text-[14px]" onClick={() => openAccount({})}><Plus className="h-4 w-4" /> Akun</button>
        </>} />

      <div className="grid gap-6 lg:grid-cols-[440px_minmax(0,1fr)] lg:items-start">
        <div>
          <section className="card p-5 lg:p-6">
            <p className="text-[16px] text-ink-soft">Kekayaan bersih, semua akun yang kamu lihat</p>
            <Money value={sum(accounts)} className="mt-1 block text-[34px] font-semibold leading-tight" />
            <p className="mt-2 text-[16px] text-ink-soft">
              <Money value={sum(mine)} compact className="font-medium text-ink" dots={5} /> milik kamu · <Money value={sum(shared)} compact className="font-medium text-ink" dots={5} /> dibagikan
            </p>
          </section>

          {accounts.length === 0 ? (
            <div className="mt-6"><Empty title="Belum ada akun" text="Buat rekening, e-wallet, atau pocket tabungan."
              action={<button className="btn-primary h-10 text-[14px]" onClick={() => openAccount({})}>Buat akun</button>} /></div>
          ) : (
            <>
              <div role="tablist" className="mt-6 flex gap-6 overflow-x-auto border-b border-line no-scrollbar">
                {groups.map((g) => {
                  const active = g.key === current?.key;
                  return (
                    <button key={g.key} role="tab" aria-selected={active} onClick={() => setTab(g.key)}
                      className={`-mb-px flex-none border-b-2 pb-2.5 text-[16px] ${active ? "border-ink font-medium text-ink" : "border-transparent text-ink-soft"}`}>
                      {g.label} <span className="tabular text-ink-mute">{g.items.length}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-right text-[14px] text-ink-soft">Total <Money value={sum(current.items)} className="font-medium text-ink" dots={5} /></p>
              <div className="mt-2"><WalletStack key={current.key} accounts={current.items} /></div>
            </>
          )}
        </div>

        {/* Desktop: tabel akun di kolom kedua */}
        {accounts.length > 0 && (
          <section className="hidden lg:block">
            <h2 className="section-title mb-2">Semua akun</h2>
            <div className="card p-1">
              {groups.map((g) => (
                <div key={g.key}>
                  <p className="px-3 pb-1 pt-3 text-[14px] text-ink-soft">{g.label}</p>
                  {g.items.map((a) => <AccountRow key={a.id} a={a} user={user} people={people} />)}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {archived.length > 0 && (
        <section className="mt-8 lg:max-w-[440px]">
          <h2 className="section-title mb-2">Diarsipkan</h2>
          <div className="card p-1">
            {archived.map((a) => <AccountRow key={a.id} a={a} user={user} people={people} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function AccountRow({ a, user, people }) {
  const meta = a.owner_id !== user?.id ? `Milik ${firstName(people[a.owner_id])}` : a.member_count > 0 ? "Bersama" : "Pribadi";
  return (
    <Link href={`/dompet/${a.id}`} className="flex min-h-[64px] items-center gap-3 rounded-control px-3 py-2.5 hover:bg-canvas">
      <AccountGlyph account={a} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-medium">{a.name}</span>
        <span className="block truncate text-[14px] text-ink-soft">{ACCOUNT_KINDS[a.kind]?.label} · {meta}</span>
      </span>
      <Money value={a.balance} className="flex-none text-[16px] font-medium" dots={5} />
    </Link>
  );
}
