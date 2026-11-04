"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shapes, LogOut, ChevronRight, MailOpen, Check, X, Eye, EyeOff, ReceiptText, Smartphone } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { ROLE_LABEL } from "@/lib/constants";
import { Avatar, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const router = useRouter();
  const { supabase, profile, invites, notify, refresh, hidden, toggleHidden } = useApp();
  const [name, setName] = useState(null);

  async function respond(inv, accept) {
    const { error } = await supabase.rpc("respond_invite", { invite_id: inv.id, accept });
    if (error) return notify(error.message, "err");
    notify(accept ? `Kamu bergabung ke ${inv.account_name}` : "Undangan ditolak");
    refresh();
  }

  async function saveName() {
    if (!name?.trim()) return setName(null);
    await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", profile.id);
    setName(null); notify("Nama diperbarui"); refresh();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div>
      <PageHeader title="Pengaturan" back="/" />

      <section className="card flex items-center gap-4 p-4">
        <Avatar profile={profile} size={56} />
        <div className="min-w-0 flex-1">
          {name !== null ? (
            <input autoFocus className="field py-2" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && saveName()} />
          ) : (
            <button onClick={() => setName(profile?.full_name || "")} className="text-left">
              <p className="text-[20px] font-medium">{profile?.full_name}</p>
              <p className="text-[14px] font-medium text-brand-700">Ubah nama</p>
            </button>
          )}
          <p className="mt-0.5 truncate text-[14px] text-ink-mute">{profile?.email}</p>
        </div>
      </section>

      <section id="undangan" className="mt-5">
        <h2 className="section-title mb-2">Undangan</h2>
        {invites.length === 0 ? (
          <p className="card p-5 text-[16px] text-ink-soft">Tidak ada undangan. Minta pasanganmu mengundang email <b className="text-ink">{profile?.email}</b> dari halaman akunnya.</p>
        ) : (
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.id} className="card animate-pop-in p-4">
                <div className="flex items-start gap-3">
                  <MailOpen className="mt-0.5 h-5 w-5 flex-none text-ink-soft" />
                  <div className="flex-1">
                    <p className="text-[16px] font-medium">{inv.account_name}</p>
                    <p className="text-[14px] text-ink-mute">Dari {inv.inviter_name} · Akses: <b className="text-ink-soft">{ROLE_LABEL[inv.role]}</b></p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="btn-ghost py-2.5" onClick={() => respond(inv, false)}><X className="h-4 w-4" /> Tolak</button>
                  <button className="btn-primary py-2.5" onClick={() => respond(inv, true)}><Check className="h-4 w-4" /> Terima</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card mt-5 divide-y divide-line">
        <Row href="/kategori" icon={Shapes} label="Kategori & sub-kategori" />
        <Row href="/aktivitas" icon={ReceiptText} label="Semua transaksi" />
        <button onClick={toggleHidden} className="flex w-full items-center gap-3 p-4 text-left">
          {hidden ? <EyeOff className="h-5 w-5 text-ink-soft" /> : <Eye className="h-5 w-5 text-ink-soft" />}
          <span className="flex-1 text-[16px]">Sembunyikan saldo</span>
          <span className={`relative h-7 w-12 rounded-full transition ${hidden ? "bg-ink" : "bg-control"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full border border-control bg-white transition-[left] ${hidden ? "left-6" : "left-1"}`} />
          </span>
        </button>
      </section>

      <section className="card mt-5 flex gap-3 p-5 text-[14px] text-ink-soft">
        <Smartphone className="h-5 w-5 shrink-0 text-ink-soft" />
        <p>Pasang di layar utama: buka di Safari → tombol <b>Bagikan</b> → <b>Tambah ke Layar Utama</b>. Di Android: menu Chrome → <b>Instal aplikasi</b>.</p>
      </section>

      <button onClick={logout} className="btn-danger mt-5 w-full"><LogOut className="h-4 w-4" /> Keluar</button>
    </div>
  );
}

function Row({ href, icon: Icon, label }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-4">
      <Icon className="h-5 w-5 text-ink-soft" />
      <span className="flex-1 text-[16px]">{label}</span>
      <ChevronRight className="h-5 w-5 text-ink-mute" />
    </Link>
  );
}
