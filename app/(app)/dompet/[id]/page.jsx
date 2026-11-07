"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, UserPlus, Send, Plus, Minus, ArrowLeftRight, Crown, X, LogOut, Clock, Loader2, SlidersHorizontal, ChevronRight, Coins } from "lucide-react";
import { useApp, useTransactions } from "@/lib/app-data";
import { monthRange, firstName, monthLabel, formatGram } from "@/lib/format";
import { ROLE_LABEL, ROLE_HINT, isGram } from "@/lib/constants";
import { Avatar, Money, PageHeader, Sheet } from "@/components/ui";
import { BankCard } from "@/components/BankCard";
import ReconcileSheet from "@/components/ReconcileSheet";
import { TxGroupedList } from "@/components/TxList";
import { goalProgress, GoalBar } from "@/components/GoalsCard";

export default function AccountDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { allAccounts, loading, user, openTx, openAccount, t, cycle } = useApp();
  const account = allAccounts.find((a) => a.id === id);
  const { rows } = useTransactions({ accountId: id });
  const [shareOpen, setShareOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);

  const month = useMemo(() => {
    const { start, end } = cycle.rangeOf(new Date());
    let inn = 0, out = 0;
    for (const tx of rows) {
      const d = new Date(tx.occurred_at);
      if (d < start || d >= end) continue;
      const incoming = tx.type === "income" || (tx.type === "transfer" && tx.to_account_id === id);
      if (incoming) inn += tx.amount; else out += tx.amount + (tx.fee || 0);
    }
    return { inn, out };
  }, [rows, id, cycle]);

  useEffect(() => {
    if (!loading && !account) router.replace("/dompet");
  }, [loading, account, router]);

  if (!account) return <PageHeader title="…" back="/dompet" />;

  const isOwner = account.owner_id === user?.id;
  const canWrite = isOwner || account.my_role === "editor";
  const goal = goalProgress(account);

  return (
    <div>
      <PageHeader title={account.name} subtitle={isOwner ? t("Akun saya") : t("Akun bersama")} back="/dompet"
        right={isOwner && <button className="icon-btn" onClick={() => openAccount({ account })} aria-label={t("Ubah")}><Pencil className="h-5 w-5" /></button>} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4">
          <BankCard account={account} />
          {isGram(account) ? (
            <>
              <div className="card grid grid-cols-2 divide-x divide-line p-5">
                <div className="pr-4">
                  <p className="text-[14px] text-ink-soft">{t("Total emas")}</p>
                  <p className="tabular text-[20px] font-semibold">{formatGram(account.qty_balance)}</p>
                </div>
                <div className="pl-4">
                  <p className="text-[14px] text-ink-soft">{t("Modal")}</p>
                  <Money value={account.cost_balance ?? account.balance} className="block text-[20px] font-semibold" dots={5} />
                  {account.cost_balance != null && (
                    <Money value={account.balance - account.cost_balance} sign compact dots={3}
                      className={`text-[13px] font-medium ${account.balance >= account.cost_balance ? "text-income" : "text-expense"}`} />
                  )}
                </div>
              </div>
              {isOwner && (
                <button onClick={() => openAccount({ account })} className="card flex w-full items-center gap-3 px-4 py-3 text-left active:bg-fill">
                  <span className="grid h-[30px] w-[30px] place-items-center rounded-[8px] bg-[#D4A017] text-white"><Coins className="h-[17px] w-[17px]" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px]">{t("Perbarui harga per gram")}</span>
                    <span className="block text-[13px] text-ink-soft">{t("Supaya nilai emas mengikuti harga terkini")}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-ink-mute" />
                </button>
              )}
            </>
          ) : canWrite && (
            <button onClick={() => setReconcileOpen(true)} className="card flex w-full items-center gap-3 px-4 py-3 text-left active:bg-fill">
              <span className="grid h-[30px] w-[30px] place-items-center rounded-[8px] bg-[#5856D6] text-white"><SlidersHorizontal className="h-[17px] w-[17px]" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px]">{t("Sesuaikan saldo")}</span>
                <span className="block text-[13px] text-ink-soft">{t("Samakan dengan saldo di m-banking")}</span>
              </span>
              <ChevronRight className="h-5 w-5 text-ink-mute" />
            </button>
          )}

          <div className="card grid grid-cols-2 divide-x divide-line p-5">
            <div className="pr-4">
              <p className="text-[14px] text-ink-soft">{cycle.isCalendar ? t("Masuk bulan ini") : t("Masuk periode ini")}</p>
              <Money value={month.inn} sign className="block text-[20px] font-medium text-income" dots={5} />
            </div>
            <div className="pl-4">
              <p className="text-[14px] text-ink-soft">{cycle.isCalendar ? t("Keluar bulan ini") : t("Keluar periode ini")}</p>
              <Money value={month.out} className="block text-[20px] font-medium" dots={5} />
            </div>
          </div>
          {account.include_in_totals === false && (
            <p className="px-1 text-[14px] text-ink-soft">{t("Akun ini tidak masuk hitungan grafik dan anggaran, tetapi saldonya tetap dihitung di total aset.")}</p>
          )}

          {goal && (
            <div className="card p-5">
              <div className="flex items-baseline justify-between">
                <p className="text-[16px] font-medium">{t("Target tabungan")}</p>
                <span className="tabular text-[14px] text-ink-soft">{Math.round(goal.ratio * 100)}%</span>
              </div>
              <div className="mt-3"><GoalBar p={goal} /></div>
              <p className="mt-2 text-[14px] text-ink-soft">
                <Money value={goal.saved} dots={4} className="text-ink" /> {t("dari")} <Money value={goal.goal} dots={4} />
                {goal.left > 0 ? <> · {t("kurang")} <Money value={goal.left} dots={4} className="text-ink" /></> : <> · {t("Tercapai")}</>}
              </p>
              {goal.perMonth ? (
                <p className="text-[14px] text-ink-soft">{t("Perlu")} <Money value={goal.perMonth} dots={4} className="font-medium text-ink" /> {t("per bulan sampai {date}", { date: monthLabel(goal.date, { month: "long", year: "numeric" }) })}</p>
              ) : null}
            </div>
          )}

          {canWrite ? (
            <div className="grid grid-cols-3 gap-3">
              <ActionTile icon={Minus} label={t("Keluar")} bg="linear-gradient(150deg,#FF6961,#FF3B30)" ink="#fff" onClick={() => openTx({ type: "expense", accountId: id })} />
              <ActionTile icon={Plus} label={t("Masuk")} bg="linear-gradient(150deg,#5DDB7E,#28A745)" ink="#fff" onClick={() => openTx({ type: "income", accountId: id })} />
              <ActionTile icon={ArrowLeftRight} label={t("Transfer")} bg="linear-gradient(150deg,#22D3EE,#1E40AF)" ink="#fff" onClick={() => openTx({ type: "transfer", accountId: id })} />
            </div>
          ) : (
            <div className="card p-5">
              <p className="text-[16px] font-medium">{t("Akses kamu: {role}", { role: t(ROLE_LABEL.viewer) })}</p>
              <p className="mt-1 text-[14px] text-ink-soft">{t("Kamu bisa memindahkan uang dari atau ke akun ini, tapi tidak mencatat pemasukan atau pengeluaran.")}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className="btn-ghost h-11 px-3 text-[14px]" onClick={() => openTx({ type: "transfer", accountId: id })}>
                  <ArrowLeftRight className="h-4 w-4" /> {t("Pindahkan dari sini")}
                </button>
                <button className="btn-primary h-11 px-3 text-[14px]" onClick={() => openTx({ type: "transfer", toAccountId: id })}>
                  <Send className="h-4 w-4" /> {t("Kirim ke sini")}
                </button>
              </div>
            </div>
          )}

          <button onClick={() => setShareOpen(true)} className="card flex w-full items-center gap-3 p-5 text-left hover:bg-raised">
            <UserPlus className="h-5 w-5 flex-none text-ink-soft" />
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-medium">{isOwner ? t("Bagikan akun") : t("Anggota akun")}</span>
              <span className="block text-[14px] text-ink-soft">
                {isOwner ? (account.member_count > 0 ? t("{n} orang punya akses", { n: account.member_count }) : t("Undang pasangan untuk melihat atau mencatat")) : t("Akses kamu: {role}", { role: t(ROLE_LABEL[account.my_role]) })}
              </span>
            </span>
            <span className="flex-none text-[14px] font-medium text-brand-600">{isOwner ? t("Atur") : t("Lihat")}</span>
          </button>
        </div>

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="section-title">{t("Riwayat")}</h2>
            {rows.length > 8 && <Link href={`/aktivitas?akun=${id}`} className="text-[14px] font-medium text-brand-600">{t("Semua {n}", { n: rows.length })}</Link>}
          </div>
          <TxGroupedList rows={rows.slice(0, 8)} perspectiveId={id} emptyText={t("Belum ada transaksi di akun ini")} />
        </section>
      </div>

      <ReconcileSheet account={account} open={reconcileOpen} onClose={() => setReconcileOpen(false)} />

      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title={isOwner ? t("Bagikan akun") : t("Anggota akun")}>
        <SharePanel account={account} isOwner={isOwner} onLeft={() => { setShareOpen(false); router.replace("/dompet"); }} />
      </Sheet>
    </div>
  );
}

function ActionTile({ icon: Icon, label, onClick, bg, ink }) {
  return (
    <button onClick={onClick} className="flex h-[84px] flex-col items-center justify-center gap-1.5 rounded-card shadow-card transition active:scale-[.95]" style={{ background: bg, color: ink }}>
      <Icon className="h-6 w-6" strokeWidth={1.75} />
      <span className="text-[15px] font-semibold">{label}</span>
    </button>
  );
}

function RoleOption({ value, current, onPick, t }) {
  const active = value === current;
  return (
    <button type="button" role="radio" aria-checked={active} onClick={() => onPick(value)}
      className={`w-full rounded-control border p-3 text-left ${active ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-line bg-surface"}`}>
      <span className="block text-[16px] font-medium">{t(ROLE_LABEL[value])}</span>
      <span className="mt-0.5 block text-[14px] text-ink-soft">{t(ROLE_HINT[value])}</span>
    </button>
  );
}

function SharePanel({ account, isOwner, onLeft }) {
  const { supabase, people, user, notify, refresh, version, t } = useApp();
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState([]);
  const [email, setEmail] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [m, i, c] = await Promise.all([
      supabase.from("account_members").select("*").eq("account_id", account.id),
      isOwner ? supabase.from("account_invites").select("*").eq("account_id", account.id).eq("status", "pending") : Promise.resolve({ data: [] }),
      isOwner ? supabase.rpc("list_invitable_users", { p_account_id: account.id }) : Promise.resolve({ data: [] }),
    ]);
    setCandidates(c.data || []);
    setMembers(m.data || []);
    setPending(i.data || []);
  }, [supabase, account.id, isOwner]);

  useEffect(() => { load(); }, [load, version]);

  async function invite(e) {
    e.preventDefault();
    const target = email.trim().toLowerCase();
    if (!target) return;
    if (target === user.email?.toLowerCase()) return notify(t("Itu email kamu sendiri"), "err");
    setBusy(true);
    const { error } = await supabase.from("account_invites").insert({ account_id: account.id, email: target, role, invited_by: user.id });
    setBusy(false);
    if (error) return notify(error.code === "23505" ? t("Email ini sudah diundang") : error.message, "err");
    setEmail("");
    notify(t("Undangan terkirim"));
    load();
  }

  async function changeRole(m, r) {
    const { error } = await supabase.from("account_members").update({ role: r }).eq("account_id", account.id).eq("user_id", m.user_id);
    if (error) return notify(error.message, "err");
    notify(t("Akses diperbarui")); load(); refresh();
  }
  async function removeMember(m) {
    await supabase.from("account_members").delete().eq("account_id", account.id).eq("user_id", m.user_id);
    notify(t("Akses dicabut")); load(); refresh();
  }
  async function cancelInvite(inv) {
    await supabase.from("account_invites").delete().eq("id", inv.id);
    load();
  }
  async function leave() {
    await supabase.from("account_members").delete().eq("account_id", account.id).eq("user_id", user.id);
    notify(t("Kamu keluar dari akun ini")); refresh(); onLeft();
  }

  const owner = people[account.owner_id];

  return (
    <div className="space-y-5 pb-3">
      {isOwner && (
        <form onSubmit={invite} className="space-y-3 rounded-card bg-raised p-4">
          <label htmlFor="invite-email" className="label">{t("Pasangan")}</label>
          <select id="invite-email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!candidates.length}>
            <option value="">{candidates.length ? t("Pilih pasangan") : t("Belum ada pengguna lain")}</option>
            {candidates.map((c) => <option key={c.id} value={c.email}>{c.full_name || c.email}</option>)}
          </select>
          <p className="text-[14px] text-ink-soft">{candidates.length ? t("Pilih dari pengguna yang sudah mendaftar di aplikasi ini.") : t("Minta pasanganmu mendaftar di aplikasi ini dulu, lalu dia akan muncul di daftar.")}</p>
          <div role="radiogroup" aria-label={t("Jenis akses")} className="space-y-2">
            <RoleOption value="editor" current={role} onPick={setRole} t={t} />
            <RoleOption value="viewer" current={role} onPick={setRole} t={t} />
          </div>
          <button className="btn-primary w-full" disabled={busy || !email}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-4 w-4" /> {t("Kirim undangan")}</>}</button>
        </form>
      )}

      <div>
        <p className="label">{t("Punya akses")}</p>
        <div className="card p-1">
          <div className="flex min-h-[64px] items-center gap-3 px-3 py-2">
            <Avatar profile={owner} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-medium">{owner?.full_name || t("Pemilik")} {owner?.id === user.id && <span className="text-ink-mute">({t("kamu")})</span>}</p>
              <p className="truncate text-[14px] text-ink-soft">{owner?.email}</p>
            </div>
            <span className="chip bg-fill py-1 text-ink-soft"><Crown className="h-3.5 w-3.5" /> {t("Pemilik")}</span>
          </div>
          {members.map((m) => {
            const p = people[m.user_id];
            return (
              <div key={m.user_id} className="flex min-h-[64px] flex-wrap items-center gap-3 px-3 py-2">
                <Avatar profile={p} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-medium">{p?.full_name || t("Anggota")} {m.user_id === user.id && <span className="text-ink-mute">({t("kamu")})</span>}</p>
                  <p className="truncate text-[14px] text-ink-soft">{p?.email}</p>
                </div>
                {isOwner ? (
                  <div className="flex flex-none items-center gap-1">
                    <select aria-label={t("Akses {name}", { name: p?.full_name || "" })} value={m.role} onChange={(e) => changeRole(m, e.target.value)}
                      className="h-10 max-w-[180px] rounded-control border border-control bg-surface px-3 text-[14px] font-medium">
                      <option value="editor">{t(ROLE_LABEL.editor)}</option>
                      <option value="viewer">{t(ROLE_LABEL.viewer)}</option>
                    </select>
                    <button onClick={() => removeMember(m)} className="grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-expense-soft hover:text-expense" aria-label={t("Cabut akses {name}", { name: p?.full_name || "" })}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span className="chip bg-fill py-1 text-ink-soft">{t(ROLE_LABEL[m.role])}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {pending.length > 0 && (
        <div>
          <p className="label">{t("Menunggu diterima")}</p>
          <div className="card p-1">
            {pending.map((inv) => (
              <div key={inv.id} className="flex min-h-[64px] items-center gap-3 px-3 py-2">
                <Clock className="mx-2.5 h-5 w-5 flex-none text-ink-soft" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-medium">{inv.email}</p>
                  <p className="text-[14px] text-ink-soft">{t(ROLE_LABEL[inv.role])}</p>
                </div>
                <button onClick={() => cancelInvite(inv)} className="h-10 px-2 text-[14px] font-medium text-expense">{t("Batalkan")}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isOwner && (
        <button className="btn-danger w-full" onClick={leave}><LogOut className="h-4 w-4" /> {t("Keluar dari akun {name}", { name: firstName(owner) })}</button>
      )}
    </div>
  );
}
