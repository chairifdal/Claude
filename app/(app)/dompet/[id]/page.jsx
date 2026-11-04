"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
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

      <BankCard account={account} className="shadow-lift" />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="card p-3.5">
          <p className="text-[12px] font-semibold text-ink-mute">Masuk bulan ini</p>
          <Money value={month.inn} compact className="text-[17px] font-extrabold text-income" dots={5} />
        </div>
        <div className="card p-3.5">
          <p className="text-[12px] font-semibold text-ink-mute">Keluar bulan ini</p>
          <Money value={month.out} compact className="text-[17px] font-extrabold text-expense" dots={5} />
        </div>
      </div>

      {canWrite ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <ActionBtn icon={Minus} label="Keluar" color="#E5484D" onClick={() => openTx({ type: "expense", accountId: id })} />
          <ActionBtn icon={Plus} label="Masuk" color="#0F9F6E" onClick={() => openTx({ type: "income", accountId: id })} />
          <ActionBtn icon={ArrowLeftRight} label="Transfer" color="#3654F5" onClick={() => openTx({ type: "transfer", accountId: id })} />
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-brand-50 p-3 text-[13px] font-semibold text-brand-700">
          <Eye className="h-4 w-4" /> Kamu hanya bisa melihat akun ini. Kamu tetap bisa transfer ke sini dari akunmu.
        </div>
      )}
      {!canWrite && (
        <button className="btn-ghost mt-2 w-full bg-white shadow-card" onClick={() => openTx({ type: "transfer", toAccountId: id })}>
          <Send className="h-4 w-4" /> Kirim ke {account.name}
        </button>
      )}

      <button onClick={() => setShareOpen(true)} className="card mt-3 flex w-full items-center gap-3 p-4 text-left">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600"><UserPlus className="h-5 w-5" /></span>
        <span className="flex-1">
          <span className="block font-bold">{isOwner ? "Bagikan akun" : "Anggota akun"}</span>
          <span className="block text-[12.5px] text-ink-mute">
            {isOwner ? (account.member_count > 0 ? `${account.member_count} orang punya akses` : "Undang pasangan untuk melihat / mencatat") : `Akses kamu: ${ROLE_LABEL[account.my_role]}`}
          </span>
        </span>
      </button>

      <h2 className="section-title mb-2 mt-6">Riwayat</h2>
      <TxGroupedList rows={rows} perspectiveId={id} />

      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title={isOwner ? "Bagikan akun" : "Anggota akun"}>
        <SharePanel account={account} isOwner={isOwner} onLeft={() => { setShareOpen(false); router.replace("/dompet"); }} />
      </Sheet>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, color, onClick }) {
  return (
    <button onClick={onClick} className="card flex flex-col items-center gap-1.5 py-3 text-[13px] font-bold active:scale-[.97] transition">
      <span className="grid h-10 w-10 place-items-center rounded-full text-white" style={{ background: color }}><Icon className="h-5 w-5" strokeWidth={2.6} /></span>
      {label}
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
        <form onSubmit={invite} className="space-y-3 rounded-3xl bg-canvas p-4">
          <p className="text-[13px] text-ink-soft">Undang lewat email yang dipakai pasanganmu untuk daftar di aplikasi ini.</p>
          <input className="field" type="email" inputMode="email" placeholder="email@pasangan.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Segmented value={role} onChange={setRole} className="bg-white" options={[
            { value: "editor", label: "Bisa catat" },
            { value: "viewer", label: "Hanya lihat" },
          ]} />
          <p className="text-[12px] text-ink-mute">
            {role === "editor" ? "Bisa melihat saldo & riwayat, serta menambah/mengubah transaksi di akun ini." : "Hanya bisa melihat saldo & riwayat. Tetap bisa mengirim transfer ke akun ini."}
          </p>
          <button className="btn-primary w-full" disabled={busy}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-4 w-4" /> Kirim undangan</>}</button>
        </form>
      )}

      <div>
        <span className="label">Punya akses</span>
        <div className="card divide-y divide-line">
          <div className="flex items-center gap-3 p-3">
            <Avatar profile={owner} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{owner?.full_name || "Pemilik"} {owner?.id === user.id && <span className="text-ink-mute">(kamu)</span>}</p>
              <p className="truncate text-[12px] text-ink-mute">{owner?.email}</p>
            </div>
            <span className="chip bg-amber-50 text-amber-700"><Crown className="h-3.5 w-3.5" /> Pemilik</span>
          </div>
          {members.map((m) => {
            const p = people[m.user_id];
            return (
              <div key={m.user_id} className="flex items-center gap-3 p-3">
                <Avatar profile={p} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{p?.full_name || "Anggota"} {m.user_id === user.id && <span className="text-ink-mute">(kamu)</span>}</p>
                  <p className="truncate text-[12px] text-ink-mute">{p?.email}</p>
                </div>
                {isOwner ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => changeRole(m, m.role === "editor" ? "viewer" : "editor")}
                      className={`chip ${m.role === "editor" ? "bg-income-soft text-income" : "bg-brand-50 text-brand-600"}`}>
                      {m.role === "editor" ? <PenLine className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {ROLE_LABEL[m.role]}
                    </button>
                    <button onClick={() => removeMember(m)} className="grid h-8 w-8 place-items-center rounded-full text-ink-mute hover:bg-expense-soft hover:text-expense" aria-label="Cabut akses">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span className="chip bg-canvas text-ink-soft">{ROLE_LABEL[m.role]}</span>
                )}
              </div>
            );
          })}
        </div>
        {isOwner && members.length > 0 && <p className="mt-2 px-1 text-[12px] text-ink-mute">Ketuk label akses untuk mengganti antara "Bisa catat" dan "Hanya lihat".</p>}
      </div>

      {pending.length > 0 && (
        <div>
          <span className="label">Menunggu diterima</span>
          <div className="card divide-y divide-line">
            {pending.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 p-3">
                <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-canvas text-ink-mute"><Clock className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{inv.email}</p>
                  <p className="text-[12px] text-ink-mute">{ROLE_LABEL[inv.role]}</p>
                </div>
                <button onClick={() => cancelInvite(inv)} className="text-[13px] font-bold text-expense">Batalkan</button>
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
