"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Mail, Lock, User } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
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
      if (error) setMsg({ tone: "err", text: error.message === "Invalid login credentials" ? "Email atau password salah." : error.message });
      else { router.replace("/"); router.refresh(); }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setMsg({ tone: "err", text: error.message });
      else if (data.session) { router.replace("/"); router.refresh(); }
      else setMsg({ tone: "ok", text: "Cek email kamu untuk konfirmasi, lalu masuk." });
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pt-safe">
      <div className="flex h-16 items-center gap-2.5">
        <img src="/icons/icon.svg" alt="" width={32} height={32} className="rounded-[9px]" />
        <span className="text-[16px] font-semibold">Kantong Kita</span>
      </div>

      <h1 className="mt-10 text-[32px] font-semibold leading-[1.15]">Keuangan berdua, satu kantong</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
        Bagikan rekening dan pocket ke pasangan, catat bareng, dan lihat setiap catatan muncul di HP masing-masing saat itu juga.
      </p>

      <div className="card mt-8 p-5">
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-full bg-[#eef1f4] p-1">
          {[["login", "Masuk"], ["signup", "Daftar"]].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => { setMode(k); setMsg(null); }}
              className={`h-10 rounded-full text-[14px] font-medium transition ${mode === k ? "border border-line bg-white text-ink" : "text-ink-soft"}`}>
              {l}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === "signup" && (
            <div>
              <label htmlFor="name" className="label">Nama panggilan</label>
              <Field icon={User}><input id="name" className="field pl-11" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            </div>
          )}
          <div>
            <label htmlFor="email" className="label">Email</label>
            <Field icon={Mail}>
              <input id="email" className="field pl-11" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <Field icon={Lock}>
              <input id="password" aria-describedby="pw-hint" className="field pl-11" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            {mode === "signup" && <p id="pw-hint" className="mt-1.5 text-[14px] text-ink-soft">Minimal 6 karakter</p>}
          </div>

          {msg && (
            <p role="alert" className={`rounded-control border px-3 py-2.5 text-[14px] ${msg.tone === "err" ? "border-[#f5c2bd] bg-expense-soft text-expense-ink" : "border-[#b7e9c6] bg-income-soft text-income-ink"}`}>
              {msg.text}
            </p>
          )}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{mode === "login" ? "Masuk" : "Buat akun"} <ArrowRight className="h-5 w-5" /></>}
          </button>
        </form>
      </div>
      <p className="mt-5 text-[14px] text-ink-soft">Pasanganmu daftar dengan emailnya sendiri, lalu kamu undang dari halaman akun.</p>
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
