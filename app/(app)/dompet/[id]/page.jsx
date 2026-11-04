"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, UserPlus, Send, Plus, Minus, ArrowLeftRight, Crown, X, LogOut, Clock, Eye, PenLine, Loader2 } from "lucide-react";
import { useApp, useTransactions } from "@/lib/app-data";
import { monthRange, firstName } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/constants";
import { Avatar, Money, PageHeader, Sheet, Segmented } from "@/components/ui";
import { BankCard } from "@/components/BankCard";
import { TxGroupedList } from "@/components/TxList";

export default function AccountDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { allAccounts, loading, user, openTx, openAccount } = useApp();
  const account = allAccounts.find((a) => a.id === id);
  const { rows } = useTransactions({ accountId: id });
  const [shareOpen, setShareOpen] = useState(false);

  const month = useMemo(() => {
    const { start, end } = monthRange();
    let inn = 0, out = 0;
    for (const t of rows) {
      const d = new Date(t.occurred_at);
      if (d < start || d >= end) continue;
      const incoming = t.type === "income" || (t.type === "transfer" && t.to_account_id === id);
      if (incoming) inn += t.amount; else out += t.amount;
    }
    return { inn, out };
  }, [rows, id]);

  useEffect(() => {
    if (!loading && !account) router.replace("/dompet");
  }, [loading, account, router]);

  if (!account) return <PageHeader title="…" back="/dompet" />;

  const isOwner = account.owner_id === user?.id;
  const canWrite = isOwner || account.my_role === "editor";

  return (
    <div>
      <PageHeader title={account.name} subtitle={isOwner ? "Akun saya" : "Akun bersama"} back="/dompet"
        right={isOwner && <button className="icon-btn" onClick={() => openAccount({ account })} aria-label="Ubah"><Pencil className="h-5 w-5" /></button>} />

      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4">
          <BankCard account={account} />

          <div className="card grid grid-cols-2 divide-x divide-line p-5">
            <div className="pr-4">
              <p className="text-[14px] text-ink-soft">Masuk bulan ini</p>
              <Money value={month.inn} sign className="block text-[20px] font-medium text-income" dots={5} />
            </div>
            <div className="pl-4">
              <p className="text-[14px] text-ink-soft">Keluar bulan ini</p>
              <Money value={month.out} className="block text-[20px] font-medium" dots={5} />
            </div>
          </div>

          {canWrite ? (
            <div className="grid grid-cols-3 gap-3">
              <ActionTile icon={Minus} label="Keluar" bg="#eef1f4" ink="#1b1d1f" onClick={() => openTx({ type: "expense", accountId: id })} />
              <ActionTile icon={Plus} label="Masuk" bg="#dcfae5" ink="#04250e" onClick={() => openTx({ type: "income", accountId: id })} />
              <ActionTile icon={ArrowLeftRight} label="Transfer" bg="#dcf1ff" ink="#0a3a80" onClick={() => openTx({ type: "transfer", accountId: id })} />
            </div>
          ) : (
            <div className="card p-5">
              <p className="flex items-center gap-2 text-[16px]"><Eye className="h-4 w-4 text-ink-soft" /> Kamu hanya bisa melihat akun ini</p>
              <p className="mt-1 text-[14px] text-ink-soft">Kamu tetap bisa mengirim uang ke sini dari akunmu sendiri.</p>
              <button className="btn-primary mt-4 w-full" onClick={() => openTx({ type: "transfer", toAccountId: id })}>
                <Send className="h-4 w-4" /> Kirim ke {account.name}
              </button>
            </div>
          )}

          <button onClick={() => setShareOpen(true)} className="card flex w-full items-center gap-3 p-5 text-left hover:bg-raised">
            <UserPlus className="h-5 w-5 flex-none text-ink-soft" />
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-medium">{isOwner ? "Bagikan akun" : "Anggota akun"}</span>
              <span className="block text-[14px] text-ink-soft">
                {isOwner ? (account.member_count > 0 ? `${account.member_count} orang punya akses` : "Undang pasangan untuk melihat atau mencatat") : `Akses kamu: ${ROLE_LABEL[account.my_role]}`}
              </span>
            </span>
            <span className="flex-none text-[14px] font-medium text-brand-700">{isOwner ? "Atur" : "Lihat"}</span>
          </button>
        </div>

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="section-title">Riwayat</h2>
            {rows.length > 8 && <Link href={`/aktivitas?akun=${id}`} className="text-[14px] font-medium text-brand-700">Semua {rows.length}</Link>}
          </div>
          <TxGroupedList rows={rows.slice(0, 8)} perspectiveId={id} emptyText="Belum ada transaksi di akun ini" />
        </section>
      </div>

      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title={isOwner ? "Bagikan akun" : "Anggota akun"}>
        <SharePanel account={account} isOwner={isOwner} onLeft={() => { setShareOpen(false); router.replace("/dompet"); }} />
      </Sheet>
    </div>
  );
}

function ActionTile({ icon: Icon, label, onClick, bg, ink }) {
  return (
    <button onClick={onClick} className="flex h-[84px] flex-col items-center justify-center gap-1.5 rounded-card transition active:scale-[.97]" style={{ background: bg, color: ink }}>
      <Icon className="h-6 w-6" strokeWidth={1.75} />
      <span className="text-[14px] font-medium">{label}</span>
    </button>
  );
}

function SharePanel({ account, isOwner, onLeft }) {
  const { supabase, people, user, notify, refresh, version } = useApp();
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([
      supabase.from("account_members").select("*").eq("account_id", account.id),
      isOwner ? supabase.from("account_invites").select("*").eq("account_id", account.id).eq("status", "pending") : Promise.resolve({ data: [] }),
    ]);
    setMembers(m.data || []);
    setPending(i.data || []);
  }, [supabase, account.id, isOwner]);

  useEffect(() => { load(); }, [load, version]);

  async function invite(e) {
    e.preventDefault();
    const target = email.trim().toLowerCase();
    if (!target) return;
    if (target === user.email?.toLowerCase()) return notify("Itu email kamu sendiri", "err");
    setBusy(true);
    const { error } = await supabase.from("account_invites").insert({ account_id: account.id, email: target, role, invited_by: user.id });
    setBusy(false);
    if (error) return notify(error.code === "23505" ? "Email ini sudah diundang" : error.message, "err");
    setEmail("");
    notify("Undangan terkirim");
    load();
  }

  async function changeRole(m, r) {
    const { error } = await supabase.from("account_members").update({ role: r }).eq("account_id", account.id).eq("user_id", m.user_id);
    if (error) return notify(error.message, "err");
    notify("Akses diperbarui"); load(); refresh();
  }
  async function removeMember(m) {
    await supabase.from("account_members").delete().eq("account_id", account.id).eq("user_id", m.user_id);
    notify("Akses dicabut"); load(); refresh();
  }
  async function cancelInvite(inv) {
    await supabase.from("account_invites").delete().eq("id", inv.id);
    load();
  }
  async function leave() {
    await supabase.from("account_members").delete().eq("account_id", account.id).eq("user_id", user.id);
    notify("Kamu keluar dari akun ini"); refresh(); onLeft();
  }

  const owner = people[account.owner_id];

  return (
    <div className="space-y-5 pb-3">
      {isOwner && (
        <form onSubmit={invite} className="space-y-3 rounded-card bg-raised p-4">
          <p className="text-[14px] text-ink-soft">Undang lewat email yang dipakai pasanganmu untuk daftar di aplikasi ini.</p>
          <input className="field" type="email" inputMode="email" placeholder="email@pasangan.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Segmented value={role} onChange={setRole} options={[
            { value: "editor", label: "Bisa catat" },
            { value: "viewer", label: "Hanya lihat" },
          ]} />
          <p className="text-[14px] text-ink-soft">
            {role === "editor" ? "Bisa melihat saldo & riwayat, serta menambah/mengubah transaksi di akun ini." : "Hanya bisa melihat saldo & riwayat. Tetap bisa mengirim transfer ke akun ini."}
          </p>
          <button className="btn-primary w-full" disabled={busy}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-4 w-4" /> Kirim undangan</>}</button>
        </form>
      )}

      <div>
        <span className="label">Punya akses</span>
        <div className="card p-1">
          <div className="flex min-h-[64px] items-center gap-3 px-3 py-2">
            <Avatar profile={owner} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-medium">{owner?.full_name || "Pemilik"} {owner?.id === user.id && <span className="text-ink-mute">(kamu)</span>}</p>
              <p className="truncate text-[14px] text-ink-soft">{owner?.email}</p>
            </div>
            <span className="chip bg-[#eef1f4] py-1 text-[#3a3d40]"><Crown className="h-3.5 w-3.5" /> Pemilik</span>
          </div>
          {members.map((m) => {
            const p = people[m.user_id];
            return (
              <div key={m.user_id} className="flex min-h-[64px] items-center gap-3 px-3 py-2">
                <Avatar profile={p} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-medium">{p?.full_name || "Anggota"} {m.user_id === user.id && <span className="text-ink-mute">(kamu)</span>}</p>
                  <p className="truncate text-[14px] text-ink-soft">{p?.email}</p>
                </div>
                {isOwner ? (
                  <div className="flex flex-none items-center gap-1">
                    <select aria-label={`Akses ${p?.full_name || "anggota"}`} value={m.role} onChange={(e) => changeRole(m, e.target.value)}
                      className="h-10 rounded-control border border-control bg-white px-3 text-[14px] font-medium">
                      <option value="editor">Bisa catat</option>
                      <option value="viewer">Hanya lihat</option>
                    </select>
                    <button onClick={() => removeMember(m)} className="grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-expense-soft hover:text-expense" aria-label={`Cabut akses ${p?.full_name || "anggota"}`}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span className="chip bg-[#eef1f4] py-1 text-[#3a3d40]">{ROLE_LABEL[m.role]}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {pending.length > 0 && (
        <div>
          <span className="label">Menunggu diterima</span>
          <div className="card p-1">
            {pending.map((inv) => (
              <div key={inv.id} className="flex min-h-[64px] items-center gap-3 px-3 py-2">
                <Clock className="mx-2.5 h-5 w-5 flex-none text-ink-soft" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-medium">{inv.email}</p>
                  <p className="text-[14px] text-ink-soft">{ROLE_LABEL[inv.role]}</p>
                </div>
                <button onClick={() => cancelInvite(inv)} className="h-10 px-2 text-[14px] font-medium text-expense">Batalkan</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isOwner && (
        <button className="btn-danger w-full" onClick={leave}><LogOut className="h-4 w-4" /> Keluar dari akun {firstName(owner)}</button>
      )}
    </div>
  );
}
