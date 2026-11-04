"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shapes, LogOut, ChevronRight, MailOpen, Check, X, ReceiptText, Smartphone, CalendarClock, Languages, Repeat, Moon } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { useTheme } from "@/lib/theme";
import PeriodSettings from "@/components/PeriodSettings";
import { ROLE_LABEL } from "@/lib/constants";
import { Avatar, PageHeader, Segmented, Switch } from "@/components/ui";

export default function SettingsPage() {
  const router = useRouter();
  const { supabase, profile, invites, notify, refresh, hidden, toggleHidden, t, locale, setLocale } = useApp();
  const [name, setName] = useState(null);
  const { pref, setPref } = useTheme();

  async function respond(inv, accept) {
    const { error } = await supabase.rpc("respond_invite", { invite_id: inv.id, accept });
    if (error) return notify(error.message, "err");
    notify(accept ? t("Kamu bergabung ke {name}", { name: inv.account_name }) : t("Undangan ditolak"));
    refresh();
  }

  async function saveName() {
    if (!name?.trim()) return setName(null);
    await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", profile.id);
    setName(null); notify(t("Nama diperbarui")); refresh();
  }

  async function changeLocale(l) {
    setLocale(l);
    await supabase.from("profiles").update({ locale: l }).eq("id", profile.id);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div>
      <PageHeader title={t("Pengaturan")} back="/" />

      <div className="max-w-[640px] space-y-6">
        <section className="card flex items-center gap-4 p-5">
          <Avatar profile={profile} size={56} />
          <div className="min-w-0 flex-1">
            {name !== null ? (
              <input autoFocus aria-label={t("Nama")} className="field" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName}
                onKeyDown={(e) => e.key === "Enter" && saveName()} />
            ) : (
              <button onClick={() => setName(profile?.full_name || "")} className="text-left">
                <p className="text-[20px] font-medium">{profile?.full_name}</p>
                <p className="text-[14px] font-medium text-brand-600">{t("Ubah nama")}</p>
              </button>
            )}
            <p className="mt-0.5 truncate text-[14px] text-ink-soft">{profile?.email}</p>
          </div>
        </section>

        <section id="undangan">
          <h2 className="section-title mb-2">{t("Undangan")}</h2>
          {invites.length === 0 ? (
            <p className="card p-5 text-[16px] text-ink-soft">{t("Tidak ada undangan. Minta pasanganmu mengundang email {email} dari halaman akunnya.", { email: profile?.email || "" })}</p>
          ) : (
            <div className="space-y-2">
              {invites.map((inv) => (
                <div key={inv.id} className="card animate-pop-in p-5">
                  <div className="flex items-start gap-3">
                    <MailOpen className="mt-0.5 h-5 w-5 flex-none text-ink-soft" />
                    <div className="flex-1">
                      <p className="text-[16px] font-medium">{inv.account_name}</p>
                      <p className="text-[14px] text-ink-soft">{t("Dari {name}", { name: inv.inviter_name })} · {t("Akses")}: {t(ROLE_LABEL[inv.role])}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="btn-ghost h-11" onClick={() => respond(inv, false)}><X className="h-4 w-4" /> {t("Tolak")}</button>
                    <button className="btn-primary h-11" onClick={() => respond(inv, true)}><Check className="h-4 w-4" /> {t("Terima")}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-5">
          <p className="flex items-center gap-3 text-[17px]"><span className="grid h-[30px] w-[30px] place-items-center rounded-[8px] bg-[#30B0C7] text-white"><Languages className="h-[18px] w-[18px]" /></span> {t("Bahasa")}</p>
          <Segmented value={locale} onChange={changeLocale} className="mt-3" options={[
            { value: "id", label: "Bahasa Indonesia" },
            { value: "en", label: "English" },
          ]} />
        </section>

        <PeriodSettings />

        <section className="card p-5">
          <p className="flex items-center gap-3 text-[17px]"><span className="grid h-[30px] w-[30px] place-items-center rounded-[8px] bg-[#5856D6] text-white"><Moon className="h-[18px] w-[18px]" /></span> {t("Tampilan")}</p>
          <Segmented value={pref} onChange={setPref} className="mt-3" options={[
            { value: "system", label: t("Otomatis") },
            { value: "light", label: t("Terang") },
            { value: "dark", label: t("Gelap") },
          ]} />
          <p className="mt-2 text-[14px] text-ink-soft">{t("Otomatis mengikuti pengaturan terang/gelap di HP.")}</p>
        </section>

        <section className="card p-5">
          <Switch id="hide-balance" checked={hidden} onChange={toggleHidden} label={t("Sembunyikan saldo")}
            description={t("Angka diganti titik-titik, berguna saat membuka aplikasi di tempat umum.")} />
        </section>

        <section className="card p-1">
          <Row href="/kategori" icon={Shapes} label={t("Kategori & sub-kategori")} color="#FF9500" />
          <Row href="/tagihan" icon={CalendarClock} label={t("Tagihan rutin")} color="#FF3B30" />
          <Row href="/berulang" icon={Repeat} label={t("Transaksi berulang")} color="#34C759" />
          <Row href="/aktivitas" icon={ReceiptText} label={t("Semua transaksi & ekspor CSV")} color="#5856D6" />
        </section>

        <section className="card flex gap-3 p-5 text-[14px] text-ink-soft">
          <Smartphone className="h-5 w-5 shrink-0 text-ink-soft" />
          <p>{t("Pasang di layar utama: buka di Safari, ketuk Bagikan, lalu Tambah ke Layar Utama. Di Android: menu Chrome, lalu Instal aplikasi.")}</p>
        </section>

        <button onClick={logout} className="btn-danger w-full"><LogOut className="h-4 w-4" /> {t("Keluar")}</button>
      </div>
    </div>
  );
}

function Row({ href, icon: Icon, label, color = "#007AFF" }) {
  return (
    <Link href={href} className="flex min-h-[52px] items-center gap-3 rounded-[14px] px-4 py-2.5 active:bg-fill">
      <span className="grid h-[30px] w-[30px] place-items-center rounded-[8px] text-white" style={{ background: color }}><Icon className="h-[18px] w-[18px]" strokeWidth={2.2} /></span>
      <span className="flex-1 text-[17px]">{label}</span>
      <ChevronRight className="h-5 w-5 text-ink-mute" />
    </Link>
  );
}
