"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Eye, EyeOff, Settings, ChevronRight, UserPlus, ArrowUpRight, ArrowDownLeft, Plus, Sparkles } from "lucide-react";
import { useApp, useTransactions, rootCategory } from "@/lib/app-data";
import { monthRange, firstName, formatIDR } from "@/lib/format";
import { daysBetween } from "@/lib/period";
import { billStatus, cardBills } from "@/lib/bills";
import { AccountGlyph, Avatar, Money, Empty, CategoryIcon } from "@/components/ui";
import { TxGroupedList } from "@/components/TxList";
import QuickEntry from "@/components/QuickEntry";
import BillsCard from "@/components/BillsCard";
import GoalsCard from "@/components/GoalsCard";

export default function HomePage() {
  const { profile, people, accounts, hidden, toggleHidden, openAccount, openTx, categoryById, invites, user, loading, budgets, bills, accountById,
    supabase, notify, refresh, t, countsInStats, statRows, cycle, salaryRoot, homeHidden } = useApp();
  const show = (key) => !homeHidden.includes(key);
  // Tagihan memakai bulan kalender; ringkasan memakai periode keuangan (kalender / gajian / tanggal tetap)
  const cal = useMemo(() => monthRange(), []);
  const per = cycle.rangeOf(new Date());
  const qFrom = per.start < cal.start ? per.start : cal.start;
  const qTo = per.end > cal.end ? per.end : cal.end;
  const { rows: windowRows } = useTransactions({ from: qFrom, to: qTo, limit: 5000 });
  const inRange = (r, a, b) => { const d = new Date(r.occurred_at); return d >= a && d < b; };
  const monthRows = useMemo(() => windowRows.filter((r) => inRange(r, cal.start, cal.end)), [windowRows, cal]);
  const perKey = `${per.start.getTime()}-${per.end.getTime()}`;
  const periodRows = useMemo(() => windowRows.filter((r) => inRange(r, per.start, per.end)), [windowRows, perKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const { rows: recent } = useTransactions({ limit: 5 });

  const partner = Object.values(people).find((p) => p.id !== user?.id);
  const liquid = accounts.filter((a) => ["cash", "bank", "ewallet"].includes(a.kind));
  const totalLiquid = liquid.reduce((s, a) => s + a.balance, 0);
  const isShared = (a) => a && (a.owner_id !== user?.id || a.member_count > 0);
  const unpaidBills = bills.filter((b) => accountById[b.account_id] && billStatus(b, monthRows).state !== "paid").reduce((s, b) => s + b.amount, 0)
    + cardBills(accounts).reduce((s, c) => s + c.amount, 0);

  const m = useMemo(() => {
    let income = 0, expense = 0, mine = 0, shared = 0, partnerSpent = 0;
    const byPersonShared = {};
    const byRoot = {};
    for (const tx of statRows(periodRows)) {
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
      byRoot[key] = byRoot[key] || { id: key, cat: root || { name: t("Tanpa kategori"), color: "#8E8E93", icon: "circle" }, total: 0 };
      byRoot[key].total += tx.amount;
    }
    return { income, expense, mine, shared, partnerSpent, byPersonShared, roots: Object.values(byRoot).sort((a, b) => b.total - a.total) };
  }, [periodRows, accountById, categoryById, user, countsInStats, statRows, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const daysLeft = Math.max(1, daysBetween(new Date(), per.end));
  const finding = useMemo(() => {
    const worst = budgets.filter((b) => (b.period || "monthly") === "monthly")
      .map((b) => ({ b, cat: categoryById[b.category_id], spent: m.roots.find((r) => r.id === b.category_id)?.total || 0 }))
      .filter((x) => x.cat).map((x) => ({ ...x, ratio: x.spent / x.b.amount })).sort((a, b) => b.ratio - a.ratio)[0];
    if (worst && worst.ratio >= 1) return { tone: "bad", text: t("{cat} lewat {amount} dari anggaran, {n} hari lagi", { cat: worst.cat.name, amount: hidden ? "" : formatIDR(worst.spent - worst.b.amount), n: daysLeft }) };
    if (worst && worst.ratio >= 0.8) return { tone: "warn", text: t("{cat} sudah {pct}% dari anggaran, {n} hari lagi", { cat: worst.cat.name, pct: Math.round(worst.ratio * 100), n: daysLeft }) };
    if (m.roots[0]) return { tone: "ok", text: t("Terbesar bulan ini: {cat}, {pct}% dari pengeluaran", { cat: m.roots[0].cat.name, pct: Math.round((m.roots[0].total / m.expense) * 100) }) };
    return null;
  }, [budgets, categoryById, m, daysLeft, hidden, t]);

  async function respond(inv, accept) {
    const { error } = await supabase.rpc("respond_invite", { invite_id: inv.id, accept });
    if (error) return notify(error.message, "err");
    notify(accept ? t("Kamu bergabung ke {name}", { name: inv.account_name }) : t("Undangan ditolak"));
    refresh();
  }

  const topRoots = m.roots.slice(0, 5);
  const maxRoot = topRoots[0]?.total || 1;
  const hour = new Date().getHours();
  const greet = hour < 11 ? t("Selamat pagi") : hour < 15 ? t("Selamat siang") : hour < 18 ? t("Selamat sore") : t("Selamat malam");

  return (
    <div className="pt-safe">
      {/* Kepala halaman */}
      <header className="flex items-center gap-3 pb-4 pt-3">
        <div className="flex -space-x-2">
          <Avatar profile={profile} size={44} />
          {partner && <Avatar profile={partner} size={44} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-ink-soft">{greet},</p>
          <h1 className="truncate text-[24px] font-bold leading-tight tracking-tight">{firstName(profile) || "…"}{partner ? ` & ${firstName(partner)}` : ""}</h1>
        </div>
        <button className="icon-btn" onClick={toggleHidden} aria-label={hidden ? t("Tampilkan saldo") : t("Sembunyikan saldo")}>
          {hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
        <Link href="/pengaturan" className="icon-btn relative lg:hidden" aria-label={t("Pengaturan")}>
          <Settings className="h-5 w-5" />
          {invites.length > 0 && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-expense ring-2 ring-canvas" />}
        </Link>
      </header>

      {invites.map((inv) => (
        <div key={inv.id} className="mb-4 flex animate-pop-in flex-wrap items-center gap-3 rounded-card bg-gradient-to-r from-[#FFB340] to-[#FF9500] p-4 text-white shadow-card">
          <p className="min-w-0 flex-1 text-[16px] font-medium">
            {t("{who} mengundang kamu ke {account}", { who: inv.inviter_name, account: inv.account_name })}
          </p>
          <div className="flex gap-2">
            <button className="h-9 rounded-full bg-white/25 px-4 text-[15px] font-semibold" onClick={() => respond(inv, false)}>{t("Tolak")}</button>
            <button className="h-9 rounded-full bg-white px-4 text-[15px] font-semibold text-[#C76E00]" onClick={() => respond(inv, true)}>{t("Terima")}</button>
          </div>
        </div>
      ))}

      {per.late && (
        <button onClick={() => openTx({ type: "income", categoryId: salaryRoot?.id })}
          className="mb-4 flex w-full items-center gap-3 rounded-card bg-surface p-4 text-left shadow-card">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-gradient-to-br from-[#34C759] to-[#00C7BE] text-[18px] text-white">Rp</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold">{t("Gaji sudah masuk?")}</span>
            <span className="block text-[14px] text-ink-soft">{t("Periode baru dimulai saat gaji dicatat. Ketuk untuk mencatat.")}</span>
          </span>
          <ChevronRight className="h-5 w-5 flex-none text-ink-mute" />
        </button>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0 space-y-5">
          {/* Kartu saldo bergradien */}
          <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#2563EB] via-[#1E40AF] to-[#172554] p-5 text-white shadow-lift">
            <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-white/[.12]" />
            <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-white/[.07]" />
            <p className="relative text-[15px] font-medium text-white/80">{t("Saldo tersedia di {n} akun lancar", { n: liquid.length })}</p>
            <Money value={totalLiquid} className="relative mt-1 block text-[36px] font-bold leading-tight tracking-tight" />
            {unpaidBills > 0 && (
              <p className="relative text-[14px] text-white/80">{t("Setelah tagihan bulan ini")}: <Money value={totalLiquid - unpaidBills} className="font-semibold text-white" dots={5} /></p>
            )}

            <div className="relative mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[16px] bg-white/15 p-3 backdrop-blur">
                <p className="flex items-center gap-1 text-[13px] text-white/80"><ArrowDownLeft className="h-3.5 w-3.5" /> {t("Pemasukan")}</p>
                <Money value={m.income} compact className="mt-0.5 block text-[19px] font-bold" dots={5} />
              </div>
              <div className="rounded-[16px] bg-white/15 p-3 backdrop-blur">
                <p className="flex items-center gap-1 text-[13px] text-white/80"><ArrowUpRight className="h-3.5 w-3.5" /> {t("Pengeluaran")}</p>
                <Money value={m.expense} compact className="mt-0.5 block text-[19px] font-bold" dots={5} />
              </div>
            </div>
          </section>

          {show("insight") && finding && (
            <div className={`flex items-start gap-3 rounded-card p-4 shadow-card ${finding.tone === "bad" ? "bg-expense-soft" : finding.tone === "warn" ? "bg-warn-soft" : "bg-surface"}`}>
              <span className={`grid h-9 w-9 flex-none place-items-center rounded-[10px] text-white ${finding.tone === "bad" ? "bg-expense" : finding.tone === "warn" ? "bg-warn" : "bg-gradient-to-br from-[#34C759] to-[#00C7BE]"}`}>
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">{t("Insight bulan ini")}</p>
                <p className="text-[16px] leading-snug">{finding.text}</p>
              </div>
            </div>
          )}

          {show("quick") && <QuickEntry />}
          {show("bills") && <BillsCard monthRows={monthRows} />}

{show("couple") && (<>
          {/* Kita berdua */}
          <section className="card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="section-title">{cycle.isCalendar ? t("Kita bulan ini") : t("Kita periode ini")}</h2>
              <span className="text-[14px] text-ink-soft">{t("pengeluaran")}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Lane label={t("Pribadi saya")} value={m.mine} color="#06B6D4" />
              <Lane label={t("Akun bersama")} value={m.shared} color="#AF52DE" />
              <Lane label={partner ? firstName(partner) : t("Pasangan")} value={partner ? m.partnerSpent : null} color="#FF2D55" />
            </div>
            {partner && m.shared > 0 && (
              <div className="mt-4">
                <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                  {Object.entries(m.byPersonShared).sort().map(([pid, v]) => <SharePart key={pid} pid={pid} ratio={v / m.shared} />)}
                </div>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-ink-soft">
                  {Object.entries(m.byPersonShared).sort().map(([pid, v]) => (
                    <span key={pid} className="flex items-center gap-1.5"><Avatar profile={people[pid]} size={20} /> {firstName(people[pid])} {Math.round((v / m.shared) * 100)}%</span>
                  ))}
                  <span>{t("dari akun bersama")}</span>
                </p>
              </div>
            )}
            {!partner && (
              <Link href="/dompet" className="mt-4 inline-flex items-center gap-2 text-[16px] font-medium text-brand-600">
                <UserPlus className="h-4 w-4" /> {t("Bagikan akun ke pasangan")}
              </Link>
            )}
          </section>
          </>)}

{show("spending") && (<>
          {/* Komposisi pengeluaran */}
          <section className="card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="section-title">{t("Ke mana uangnya")}</h2>
              <Link href="/analisis" className="link text-[15px]">{t("Analisis")}</Link>
            </div>
            <p className="text-[14px] capitalize text-ink-soft">{cycle.label(new Date(), !cycle.isCalendar)}</p>
            {topRoots.length ? (
              <>
                <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full">
                  {m.roots.map((r) => <div key={r.id} style={{ width: `${(r.total / m.expense) * 100}%`, background: r.cat.color || "#8E8E93" }} className="min-w-[4px]" />)}
                </div>
                <ul className="mt-3">
                  {topRoots.map((r) => (
                    <li key={r.id}>
                      <Link href={r.id === "none" ? "/analisis" : `/analisis/kategori/${r.id}`} className="flex items-center gap-3 rounded-[12px] py-2 active:bg-fill">
                        <CategoryIcon category={r.cat} size={34} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-[16px]">{r.cat.name}</span>
                            <Money value={r.total} className="flex-none text-[16px] font-semibold" dots={5} />
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-rule">
                            <div className="h-full rounded-full" style={{ width: `${(r.total / maxRoot) * 100}%`, background: r.cat.color || "#8E8E93" }} />
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="mt-3"><Empty title={t("Belum ada pengeluaran bulan ini")} text={t("Catatan pertama akan muncul di sini, dikelompokkan per kategori.")} /></div>
            )}
          </section>
          </>)}

        </div>

        <div className="min-w-0 space-y-5">
{show("accounts") && (<>
          {/* Akun: kartu kecil yang bisa digeser */}
          <section>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="section-title">{t("Akun")}</h2>
              <Link href="/dompet" className="link flex items-center text-[15px]">{t("Dompet")} <ChevronRight className="h-4 w-4" /></Link>
            </div>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar lg:mx-0 lg:grid lg:grid-cols-2 lg:px-0">
              {accounts.map((a) => (
                <Link key={a.id} href={`/dompet/${a.id}`} className="card flex w-[152px] flex-none flex-col p-4 transition active:scale-[.97] lg:w-auto">
                  <div className="flex items-start justify-between">
                    <AccountGlyph account={a} size={40} />
                    {a.owner_id !== user?.id && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-600">{t("Bersama")}</span>}
                  </div>
                  <p className="mt-3 truncate text-[15px] font-medium text-ink-soft">{a.name}</p>
                  <Money value={a.balance} compact className="text-[18px] font-bold tracking-tight" dots={5} />
                </Link>
              ))}
              <button onClick={() => openAccount({})}
                className="flex w-[120px] flex-none flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-control text-[15px] font-medium text-ink-soft lg:w-auto lg:py-6">
                <Plus className="h-6 w-6" /> {t("Tambah")}
              </button>
            </div>
            {!loading && accounts.length === 0 && (
              <div className="mt-2"><Empty title={t("Belum ada akun")} text={t("Tambahkan rekening, e-wallet, atau dompet tunai.")}
                action={<button className="btn-primary h-11 text-[16px]" onClick={() => openAccount({})}>{t("Buat akun")}</button>} /></div>
            )}
          </section>
          </>)}

          {show("goals") && <GoalsCard />}

          {show("recent") && (
          <section>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="section-title">{t("Terakhir dicatat")}</h2>
              <Link href="/aktivitas" className="link flex items-center text-[15px]">{t("Semua")} <ChevronRight className="h-4 w-4" /></Link>
            </div>
            <TxGroupedList rows={recent} />
          </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Lane({ label, value, color }) {
  return (
    <div className="min-w-0 rounded-[16px] p-3" style={{ background: `${color}14` }}>
      <p className="truncate text-[13px] font-semibold" style={{ color }}>{label}</p>
      {value === null
        ? <span className="block text-[18px] font-bold text-ink-mute">—</span>
        : <Money value={value} compact className="block text-[18px] font-bold tracking-tight" dots={4} />}
    </div>
  );
}

function SharePart({ pid, ratio }) {
  const { personHue } = useApp();
  return <div style={{ width: `${ratio * 100}%`, background: `hsl(${personHue(pid)} 85% 58%)` }} />;
}
