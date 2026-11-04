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
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pt-safe">
      <div className="relative -mx-5 overflow-hidden rounded-b-[2.5rem] bg-gradient-to-br from-brand-500 via-brand-600 to-brand-900 px-6 pb-12 pt-16 text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-white/5" />
        <img src="/icons/icon.svg" alt="" className="h-14 w-14 rounded-2xl shadow-lg ring-1 ring-white/30" />
        <h1 className="mt-6 text-[32px] font-extrabold leading-[1.1] tracking-tight">
          Keuangan berdua,<br />satu kantong.
        </h1>
        <p className="mt-3 max-w-[18rem] text-[15px] text-white/75">
          Bagikan rekening & pocket ke pasangan, catat bareng, dan lihat perubahannya seketika.
        </p>
      </div>

      <div className="-mt-6 card relative p-2">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-canvas p-1">
          {[["login", "Masuk"], ["signup", "Daftar"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => { setMode(k); setMsg(null); }}
              className={`rounded-xl py-2.5 text-sm font-bold transition ${mode === k ? "bg-white text-ink shadow-card" : "text-ink-mute"}`}>
              {l}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3 p-3 pt-4">
          {mode === "signup" && (
            <Field icon={User}>
              <input className="field pl-11" placeholder="Nama panggilan" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
          )}
          <Field icon={Mail}>
            <input className="field pl-11" type="email" inputMode="email" autoComplete="email" placeholder="Email"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field icon={Lock}>
            <input className="field pl-11" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="Password (min. 6 karakter)" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>

          {msg && (
            <p className={`rounded-xl px-3 py-2.5 text-sm font-medium ${msg.tone === "err" ? "bg-expense-soft text-expense" : "bg-income-soft text-income"}`}>
              {msg.text}
            </p>
          )}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{mode === "login" ? "Masuk" : "Buat akun"} <ArrowRight className="h-5 w-5" /></>}
          </button>
        </form>
      </div>
      <p className="mt-6 text-center text-xs text-ink-mute">Pasangan kamu daftar dengan emailnya sendiri, lalu kamu undang dari halaman akun.</p>
    </main>
  );
}

function Field({ icon: Icon, children }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-mute" />
      {children}
    </div>
  );
}
