"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Eye, EyeOff, Settings, ChevronRight, UserPlus } from "lucide-react";
import { useApp, useTransactions, rootCategory } from "@/lib/app-data";
import { monthRange, firstName, formatIDR } from "@/lib/format";
import { billStatus } from "@/lib/bills";
import { AccountGlyph, Avatar, Money, Empty } from "@/components/ui";
import { TxGroupedList } from "@/components/TxList";
import { Mark } from "@/components/AppChrome";
import QuickEntry from "@/components/QuickEntry";
import BillsCard from "@/components/BillsCard";
import GoalsCard from "@/components/GoalsCard";

export default function HomePage() {
  const { profile, people, accounts, hidden, toggleHidden, openAccount, categoryById, invites, user, loading, budgets, bills, accountById,
    supabase, notify, refresh, t, countsInStats, statRows } = useApp();
  const { start, end } = useMemo(() => monthRange(), []);
  const { rows: monthRows } = useTransactions({ from: start, to: end, limit: 3000 });
  const { rows: recent } = useTransactions({ limit: 5 });

  const partner = Object.values(people).find((p) => p.id !== user?.id);
  const liquid = accounts.filter((a) => ["cash", "bank", "ewallet"].includes(a.kind));
  const totalLiquid = liquid.reduce((s, a) => s + a.balance, 0);
  const isShared = (a) => a && (a.owner_id !== user?.id || a.member_count > 0);
  const unpaidBills = bills.filter((b) => accountById[b.account_id] && billStatus(b, monthRows).state !== "paid").reduce((s, b) => s + b.amount, 0);

  const m = useMemo(() => {
    let income = 0, expense = 0, mine = 0, shared = 0, partnerSpent = 0;
    const byPersonShared = {};
    const byRoot = {};
    for (const tx of statRows(monthRows)) {
      if (!countsInStats(tx)) continue;
      if (tx.type === "income") income += tx.amount;
      if (tx.type !== "expense") continue;
      expense += tx.amount;
      const acc = accountById[tx.account_id];
      if (isShared(acc)) {
        shared += tx.amount;
        byPersonShared[tx.created_by] = (byPersonShared[tx.created_by] || 0) + tx.amount;
      } else mine += tx.amount;
      if (tx.created_by !== user?.id) partnerSpent += tx.amount;
      const root = rootCategory(categoryById[tx.category_id], categoryById);
      const key = root?.id || "none";
      byRoot[key] = byRoot[key] || { id: key, name: root?.name || t("Tanpa kategori"), total: 0 };
      byRoot[key].total += tx.amount;
    }
    return { income, expense, mine, shared, partnerSpent, byPersonShared, roots: Object.values(byRoot).sort((a, b) => b.total - a.total) };
  }, [monthRows, accountById, categoryById, user, countsInStats, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const daysLeft = new Date(end - 1).getDate() - new Date().getDate() + 1;
  const finding = useMemo(() => {
    const worst = budgets
      .map((b) => ({ b, cat: categoryById[b.category_id], spent: m.roots.find((r) => r.id === b.category_id)?.total || 0 }))
      .filter((x) => x.cat).map((x) => ({ ...x, ratio: x.spent / x.b.amount })).sort((a, b) => b.ratio - a.ratio)[0];
    if (worst && worst.ratio >= 1) return t("{cat} lewat {amount} dari anggaran, {n} hari lagi bulan ini", { cat: worst.cat.name, amount: hidden ? "" : formatIDR(worst.spent - worst.b.amount), n: daysLeft });
    if (worst && worst.ratio >= 0.8) return t("{cat} sudah {pct}% dari anggaran, {n} hari lagi bulan ini", { cat: worst.cat.name, pct: Math.round(worst.ratio * 100), n: daysLeft });
    if (m.roots[0]) return t("Terbesar bulan ini: {cat}, {pct}% dari pengeluaran", { cat: m.roots[0].name, pct: Math.round((m.roots[0].total / m.expense) * 100) });
    return t("Belum ada pengeluaran bulan ini");
  }, [budgets, categoryById, m, daysLeft, hidden, t]);

  async function respond(inv, accept) {
    const { error } = await supabase.rpc("respond_invite", { invite_id: inv.id, accept });
    if (error) return notify(error.message, "err");
    notify(accept ? t("Kamu bergabung ke {name}", { name: inv.account_name }) : t("Undangan ditolak"));
    refresh();
  }

  const topRoots = m.roots.slice(0, 5);
  const maxRoot = topRoots[0]?.total || 1;

  return (
    <div className="pt-safe">
      <div className="flex h-14 items-center gap-2.5 lg:hidden">
        <Mark size={28} />
        <span className="text-[16px] font-semibold">Kantong Kita</span>
        <span className="ml-1 flex -space-x-1.5">
          <Avatar profile={profile} size={24} />
          {partner && <Avatar profile={partner} size={24} />}
        </span>
        <span className="flex-1" />
        <button className="icon-btn" onClick={toggleHidden} aria-label={hidden ? t("Tampilkan saldo") : t("Sembunyikan saldo")}>
          {hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
        <Link href="/pengaturan" className="icon-btn relative -mr-2" aria-label={t("Pengaturan")}>
          <Settings className="h-5 w-5" />
          {invites.length > 0 && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-expense" />}
        </Link>
      </div>

      <header className="mb-5 mt-2 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] font-semibold leading-tight">{t("Beranda")}</h1>
          <p className="mt-1 text-[16px] text-ink-soft">{loading ? t("Memuat…") : finding}</p>
        </div>
        <button className="icon-btn hidden lg:grid" onClick={toggleHidden} aria-label={hidden ? t("Tampilkan saldo") : t("Sembunyikan saldo")}>
          {hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </header>

      {invites.map((inv) => (
        <div key={inv.id} className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-warn-line bg-warn-soft p-4">
          <p className="min-w-0 flex-1 text-[16px] text-warn-ink">
            {t("{who} mengundang kamu ke {account}", { who: inv.inviter_name, account: inv.account_name })}
          </p>
          <div className="flex gap-2">
            <button className="h-10 rounded-full px-4 text-[14px] font-medium text-warn-ink" onClick={() => respond(inv, false)}>{t("Tolak")}</button>
            <button className="h-10 rounded-full bg-ink px-4 text-[14px] font-semibold text-white" onClick={() => respond(inv, true)}>{t("Terima")}</button>
          </div>
        </div>
      ))}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section className="card p-6">
            <p className="text-[16px] text-ink-soft">{t("Saldo tersedia di {n} akun lancar", { n: liquid.length })}</p>
            <Money value={totalLiquid} className="mt-1 block text-[34px] font-semibold leading-tight" />
            <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">
              {t("Bulan ini")} <Money value={m.income} sign className="font-medium text-income" dots={5} /> {t("masuk")}, <Money value={m.expense} className="font-medium text-ink" dots={5} /> {t("keluar")}
            </p>
            {unpaidBills > 0 && (
              <p className="mt-1 text-[16px] text-ink-soft">
                {t("Setelah tagihan bulan ini")}: <Money value={totalLiquid - unpaidBills} className="font-medium text-ink" dots={5} />
              </p>
            )}
          </section>

          <QuickEntry />
          <BillsCard monthRows={monthRows} />

          <section className="card p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="section-title">{t("Kita bulan ini")}</h2>
              <span className="text-[14px] text-ink-soft">{t("pengeluaran")}</span>
            </div>
            <div className="mt-3 grid grid-cols-1 divide-y divide-rule sm:mt-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-line">
              <Lane label={t("Pribadi saya")} value={m.mine} person={profile} />
              <Lane label={t("Akun bersama")} value={m.shared} />
              {partner ? <Lane label={t("Dicatat {name}", { name: firstName(partner) })} value={m.partnerSpent} person={partner} /> : <Lane label={t("Pasangan")} value={null} />}
            </div>
            {partner && m.shared > 0 && (
              <div className="mt-5">
                <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
                  {Object.entries(m.byPersonShared).sort().map(([pid, v]) => <SharePart key={pid} pid={pid} ratio={v / m.shared} />)}
                </div>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-ink-soft">
                  {Object.entries(m.byPersonShared).sort().map(([pid, v]) => (
                    <span key={pid} className="flex items-center gap-1.5"><Avatar profile={people[pid]} size={18} /> {firstName(people[pid])} {Math.round((v / m.shared) * 100)}%</span>
                  ))}
                  <span>{t("dari akun bersama")}</span>
                </p>
              </div>
            )}
            {!partner && (
              <Link href="/dompet" className="mt-4 inline-flex items-center gap-2 text-[16px] font-medium text-brand-700">
                <UserPlus className="h-4 w-4" /> {t("Bagikan akun ke pasangan")}
              </Link>
            )}
          </section>

          <section className="card p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="section-title">{t("Ke mana uangnya")}</h2>
              <Link href="/analisis" className="text-[14px] font-medium text-brand-700">{t("Analisis")}</Link>
            </div>
            {topRoots.length ? (
              <ul className="mt-4 space-y-1">
                {topRoots.map((r, i) => (
                  <li key={r.id}>
                    <Link href={r.id === "none" ? "/analisis" : `/analisis/kategori/${r.id}`} className="block rounded-control py-1.5 hover:bg-raised">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[16px]">{r.name}</span>
                        <span className="flex-none text-right">
                          <Money value={r.total} className="text-[16px] font-medium" dots={5} />
                          <span className="tabular ml-2 inline-block w-10 text-[14px] text-ink-soft">{Math.round((r.total / m.expense) * 100)}%</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-rule">
                        <div className={`h-full rounded-full ${i === 0 ? "bg-brand-600" : "bg-[#b9c2cc]"}`} style={{ width: `${(r.total / maxRoot) * 100}%` }} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4"><Empty title={t("Belum ada pengeluaran bulan ini")} text={t("Catatan pertama akan muncul di sini, dikelompokkan per kategori.")} /></div>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="section-title">{t("Akun")}</h2>
              <Link href="/dompet" className="flex items-center text-[14px] font-medium text-brand-700">{t("Dompet")} <ChevronRight className="h-4 w-4" /></Link>
            </div>
            <div className="card p-1">
              {accounts.slice(0, 5).map((a) => (
                <Link key={a.id} href={`/dompet/${a.id}`} className="flex min-h-[64px] items-center gap-3 rounded-control px-3 py-2.5 hover:bg-canvas">
                  <AccountGlyph account={a} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium">{a.name}</span>
                    <span className="block truncate text-[14px] text-ink-soft">
                      {a.owner_id !== user?.id ? t("Milik {name}", { name: firstName(people[a.owner_id]) }) : a.member_count > 0 ? t("Bersama") : t("Pribadi")}
                      {a.include_in_totals === false ? ` · ${t("tidak dihitung")}` : ""}
                    </span>
                  </span>
                  <Money value={a.balance} className="flex-none text-[16px] font-medium" dots={5} />
                </Link>
              ))}
              {!loading && accounts.length === 0 && (
                <div className="p-3"><Empty title={t("Belum ada akun")} text={t("Tambahkan rekening, e-wallet, atau dompet tunai.")}
                  action={<button className="btn-primary h-10 text-[14px]" onClick={() => openAccount({})}>{t("Buat akun")}</button>} /></div>
              )}
              {accounts.length > 5 && <Link href="/dompet" className="block px-3 py-3 text-[14px] font-medium text-brand-700">{t("Lihat {n} akun", { n: accounts.length })}</Link>}
            </div>
          </section>

          <GoalsCard />

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="section-title">{t("Terakhir dicatat")}</h2>
              <Link href="/aktivitas" className="flex items-center text-[14px] font-medium text-brand-700">{t("Semua")} <ChevronRight className="h-4 w-4" /></Link>
            </div>
            <TxGroupedList rows={recent} />
          </section>
        </div>
      </div>
    </div>
  );
}

function Lane({ label, value, person }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 py-2.5 sm:block sm:px-4 sm:py-0 sm:first:pl-0">
      <p className="flex min-w-0 items-center gap-1.5 text-[16px] text-ink-soft sm:text-[14px]">
        {person && <Avatar profile={person} size={20} />}<span className="truncate">{label}</span>
      </p>
      {value === null
        ? <span className="text-[16px] text-ink-mute sm:block sm:text-[20px]">—</span>
        : <Money value={value} compact className="text-[16px] font-medium sm:block sm:text-[20px]" dots={4} />}
    </div>
  );
}

function SharePart({ pid, ratio }) {
  const { personHue } = useApp();
  return <div style={{ width: `${ratio * 100}%`, background: `hsl(${personHue(pid)} 70% 72%)` }} />;
}
