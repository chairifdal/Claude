"use client";
import Link from "next/link";
import { Plus, WalletCards, Eye, EyeOff, Archive } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { ACCOUNT_GROUPS, ACCOUNT_KINDS } from "@/lib/constants";
import { Money, PageHeader, Empty, AccountGlyph } from "@/components/ui";
import WalletStack from "@/components/WalletStack";

export default function WalletPage() {
  const { accounts, allAccounts, openAccount, hidden, toggleHidden, user } = useApp();
  const [mine, shared] = [accounts.filter((a) => a.owner_id === user?.id), accounts.filter((a) => a.owner_id !== user?.id)];
  const sum = (list) => list.reduce((s, a) => s + a.balance, 0);
  const groups = ACCOUNT_GROUPS.map((g) => ({ ...g, items: accounts.filter((a) => ACCOUNT_KINDS[a.kind]?.group === g.key) }));
  const archived = allAccounts.filter((a) => a.archived && a.owner_id === user?.id);

  return (
    <div>
      <PageHeader title="Dompet" subtitle="Semua rekening & pocket"
        right={<>
          <button className="icon-btn" onClick={toggleHidden}>{hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
          <button className="icon-btn bg-white shadow-card" onClick={() => openAccount({})} aria-label="Akun baru"><Plus className="h-5 w-5" /></button>
        </>} />

      <section className="relative overflow-hidden rounded-[2rem] bg-ink p-5 text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-brand-500/40 blur-2xl" />
        <p className="relative text-[12px] font-bold uppercase tracking-[.14em] text-white/60">Total kekayaan bersih</p>
        <Money value={sum(accounts)} className="relative mt-1 block text-[32px] font-extrabold tracking-tight" />
        <div className="relative mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-[12px]">
          <div>
            <p className="font-semibold uppercase tracking-wider text-white/50">Milik saya</p>
            <Money value={sum(mine)} compact className="text-[16px] font-extrabold" dots={5} />
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wider text-white/50">Dibagikan ke saya</p>
            <Money value={sum(shared)} compact className="text-[16px] font-extrabold" dots={5} />
          </div>
        </div>
      </section>

      {accounts.length === 0 && (
        <div className="card mt-4">
          <Empty icon={WalletCards} title="Belum ada akun" text="Buat rekening, e-wallet, atau pocket tabungan."
            action={<button className="btn-primary" onClick={() => openAccount({})}>Buat akun</button>} />
        </div>
      )}

      {groups.filter((g) => g.items.length).map((g) => (
        <section key={g.key} className="mt-7">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="section-title">{g.label}</h2>
            <Money value={sum(g.items)} compact className="text-[13px] font-bold text-ink-mute" dots={5} />
          </div>
          <WalletStack accounts={g.items} />
        </section>
      ))}

      {archived.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-ink-mute"><Archive className="h-4 w-4" /> Diarsipkan</h2>
          <div className="card divide-y divide-line">
            {archived.map((a) => (
              <Link key={a.id} href={`/dompet/${a.id}`} className="flex items-center gap-3 p-3 opacity-70">
                <AccountGlyph account={a} size={36} />
                <span className="flex-1 font-semibold">{a.name}</span>
                <Money value={a.balance} compact className="text-sm font-bold" dots={4} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
