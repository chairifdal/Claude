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
              <p className="text-[18px] font-extrabold">{profile?.full_name}</p>
              <p className="text-[12px] font-semibold text-brand-600">Ubah nama</p>
            </button>
          )}
          <p className="mt-0.5 truncate text-[13px] text-ink-mute">{profile?.email}</p>
        </div>
      </section>

      <section id="undangan" className="mt-5">
        <h2 className="section-title mb-2">Undangan</h2>
        {invites.length === 0 ? (
          <p className="card p-4 text-sm text-ink-mute">Tidak ada undangan. Minta pasanganmu mengundang email <b className="text-ink">{profile?.email}</b> dari halaman akunnya.</p>
        ) : (
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.id} className="card animate-pop-in p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-600"><MailOpen className="h-5 w-5" /></span>
                  <div className="flex-1">
                    <p className="font-bold">{inv.account_name}</p>
                    <p className="text-[13px] text-ink-mute">Dari {inv.inviter_name} · Akses: <b className="text-ink-soft">{ROLE_LABEL[inv.role]}</b></p>
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
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-canvas text-ink-soft">{hidden ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}</span>
          <span className="flex-1 font-semibold">Sembunyikan saldo</span>
          <span className={`relative h-7 w-12 rounded-full transition ${hidden ? "bg-brand-600" : "bg-line"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${hidden ? "left-6" : "left-1"}`} />
          </span>
        </button>
      </section>

      <section className="mt-5 flex gap-3 rounded-3xl bg-brand-50 p-4 text-[13px] text-brand-900">
        <Smartphone className="h-5 w-5 shrink-0 text-brand-600" />
        <p>Pasang di layar utama: buka di Safari → tombol <b>Bagikan</b> → <b>Tambah ke Layar Utama</b>. Di Android: menu Chrome → <b>Instal aplikasi</b>.</p>
      </section>

      <button onClick={logout} className="btn-danger mt-5 w-full"><LogOut className="h-4 w-4" /> Keluar</button>
    </div>
  );
}

function Row({ href, icon: Icon, label }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-canvas text-ink-soft"><Icon className="h-[18px] w-[18px]" /></span>
      <span className="flex-1 font-semibold">{label}</span>
      <ChevronRight className="h-5 w-5 text-ink-mute" />
    </Link>
  );
}
