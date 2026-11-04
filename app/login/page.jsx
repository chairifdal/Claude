"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Mail, Lock, User } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = getSupabase();
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ tone: "err", text: error.message === "Invalid login credentials" ? t("Email atau password salah.") : error.message });
      else { router.replace("/"); router.refresh(); }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setMsg({ tone: "err", text: error.message });
      else if (data.session) { router.replace("/"); router.refresh(); }
      else setMsg({ tone: "ok", text: t("Cek email kamu untuk konfirmasi, lalu masuk.") });
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4">
      <div className="relative -mx-4 overflow-hidden rounded-b-[36px] bg-gradient-to-br from-[#2E8BFF] via-[#3A5BFF] to-[#8B4DFF] px-5 pb-14 pt-safe text-white">
        <div className="pointer-events-none absolute -right-16 -top-10 h-64 w-64 rounded-full bg-white/[.12]" />
        <div className="pointer-events-none absolute -bottom-24 -left-12 h-60 w-60 rounded-full bg-white/[.07]" />
        <div className="relative flex h-16 items-center gap-2.5">
          <img src="/icons/icon.svg" alt="" width={36} height={36} className="rounded-[9px] ring-1 ring-white/30" />
          <span className="flex-1 text-[17px] font-semibold">Kantong Kita</span>
          <button type="button" onClick={() => setLocale(locale === "id" ? "en" : "id")} className="h-9 rounded-full bg-white/20 px-4 text-[14px] font-semibold backdrop-blur" aria-label={t("Ganti bahasa")}>
            {locale === "id" ? "English" : "Bahasa Indonesia"}
          </button>
        </div>
        <h1 className="relative mt-10 text-[34px] font-bold leading-[1.1] tracking-tight">{t("Keuangan berdua, satu kantong")}</h1>
        <p className="relative mt-3 text-[17px] leading-relaxed text-white/85">
          {t("Bagikan rekening dan pocket ke pasangan, catat bareng, dan lihat setiap catatan muncul di HP masing-masing saat itu juga.")}
        </p>
      </div>

      <div className="card relative -mt-8 p-5">
        <div role="tablist" className="grid grid-cols-2 gap-0.5 rounded-[10px] bg-fill p-[2px]">
          {[["login", t("Masuk")], ["signup", t("Daftar")]].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => { setMode(k); setMsg(null); }}
              className={`h-9 rounded-[8px] text-[15px] transition ${mode === k ? "bg-white font-semibold text-ink shadow-seg" : "font-medium text-ink"}`}>
              {l}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === "signup" && (
            <div>
              <label htmlFor="name" className="label">{t("Nama panggilan")}</label>
              <Field icon={User}><input id="name" className="field pl-11" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            </div>
          )}
          <div>
            <label htmlFor="email" className="label">{t("Email")}</label>
            <Field icon={Mail}>
              <input id="email" className="field pl-11" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
          </div>
          <div>
            <label htmlFor="password" className="label">{t("Password")}</label>
            <Field icon={Lock}>
              <input id="password" aria-describedby="pw-hint" className="field pl-11" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            {mode === "signup" && <p id="pw-hint" className="mt-1.5 text-[14px] text-ink-soft">{t("Minimal 6 karakter")}</p>}
          </div>

          {msg && (
            <p role="alert" className={`rounded-control border px-3 py-2.5 text-[14px] ${msg.tone === "err" ? "border-[#f5c2bd] bg-expense-soft text-expense-ink" : "border-[#b7e9c6] bg-income-soft text-income-ink"}`}>
              {msg.text}
            </p>
          )}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{mode === "login" ? t("Masuk") : t("Buat akun")} <ArrowRight className="h-5 w-5" /></>}
          </button>
        </form>
      </div>
      <p className="mt-5 text-[14px] text-ink-soft">{t("Pasanganmu daftar dengan emailnya sendiri, lalu kamu undang dari halaman akun.")}</p>
    </main>
  );
}

function Field({ icon: Icon, children }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-soft" />
      {children}
    </div>
  );
}
