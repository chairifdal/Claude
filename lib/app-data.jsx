"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "./supabase";
import { useI18n } from "./i18n";

const Ctx = createContext(null);
const PERSON_HUES = [212, 338, 150, 32];
export const FEE_CATEGORY = "__fee";

/**
 * Baris untuk statistik: transfer yang punya biaya ditambah satu baris pengeluaran semu
 * (kategori "Biaya transfer") di akun asal. Daftar transaksi tetap memakai baris asli.
 */
export function statRows(rows) {
  const out = [];
  for (const r of rows) {
    out.push(r);
    if (r.type === "transfer" && Number(r.fee) > 0) {
      out.push({ ...r, id: `${r.id}-fee`, type: "expense", amount: Number(r.fee), to_account_id: null, category_id: FEE_CATEGORY, isFee: true });
    }
  }
  return out;
}

export function AppDataProvider({ children }) {
  const supabase = getSupabase();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [people, setPeople] = useState({});
  const [invites, setInvites] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [bills, setBills] = useState([]);
  const { locale, setLocale, t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [txSheet, setTxSheet] = useState(null);       // { type, accountId, toAccountId, tx }
  const [accountSheet, setAccountSheet] = useState(null); // { account } | {}
  const [toast, setToast] = useState(null);
  const userRef = useRef(null);
  const ranRecurring = useRef(false);

  useEffect(() => {
    try { setHidden(localStorage.getItem("kk-hidden") === "1"); } catch {}
  }, []);

  const toggleHidden = useCallback(() => {
    setHidden((h) => {
      try { localStorage.setItem("kk-hidden", h ? "0" : "1"); } catch {}
      return !h;
    });
  }, []);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    userRef.current = user;
    setUser(user);
    const [acc, cats, profs, inv, bud, bil] = await Promise.all([
      supabase.from("account_balances").select("*").order("sort_order").order("created_at"),
      supabase.from("categories").select("*").order("sort_order").order("name"),
      supabase.from("profiles").select("*"),
      supabase.from("account_invites").select("*").eq("status", "pending").eq("email", (user.email || "").toLowerCase()),
      supabase.from("budgets").select("*"),
      supabase.from("bills").select("*").eq("active", true).order("due_day"),
    ]);
    setAccounts((acc.data || []).map((a) => ({ ...a, balance: Number(a.balance), initial_balance: Number(a.initial_balance) })));
    setCategories(cats.data || []);
    const map = {};
    (profs.data || []).forEach((p) => { map[p.id] = p; });
    setPeople(map);
    setProfile(map[user.id] || { id: user.id, email: user.email, full_name: user.email });
    setInvites(inv.data || []);
    setBudgets((bud.data || []).map((b) => ({ ...b, amount: Number(b.amount) })));
    setBills((bil.data || []).map((b) => ({ ...b, amount: Number(b.amount) })));
    // Bahasa ikut profil, kecuali HP ini sudah memilih sendiri
    const mine = map[user.id];
    let saved = null;
    try { saved = localStorage.getItem("kk-locale"); } catch {}
    if (mine?.locale && !saved) setLocale(mine.locale);
    setLoading(false);
    // Cadangan untuk jadwal harian di server: catat transaksi berulang yang sudah jatuh tempo
    if (!ranRecurring.current) {
      ranRecurring.current = true;
      const { data: n } = await supabase.rpc("run_my_recurring");
      if (n > 0) { setVersion((v) => v + 1); load(); }
    }
  }, [supabase, setLocale]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced refresh for realtime bursts
  const timer = useRef(null);
  const refresh = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { load(); setVersion((v) => v + 1); }, 250);
  }, [load]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("kk-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "account_members" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "account_invites" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "bills" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "recurring" }, refresh)
      .subscribe();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [supabase, refresh]);

  const notify = useCallback((message, tone = "ok") => {
    setToast({ message, tone, id: Date.now() });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const value = useMemo(() => {
    const active = accounts.filter((a) => !a.archived);
    const byId = Object.fromEntries(accounts.map((a) => [a.id, a]));
    const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
    // Kategori semu untuk biaya transfer (mis. BI-FAST), supaya terlihat di analisis
    catById[FEE_CATEGORY] = { id: FEE_CATEGORY, name: t("Biaya transfer"), icon: "landmark", kind: "expense", color: "#64748B", parent_id: null };
    // Hue tetap per orang (urutan id stabil di kedua HP), minimal 60° berjauhan
    const order = Object.keys(people).sort();
    const personHue = (id) => PERSON_HUES[Math.max(0, order.indexOf(id)) % PERSON_HUES.length];
    // Poin 5: akun dengan include_in_totals = false tidak ikut statistik pemasukan/pengeluaran,
    // tetapi saldonya tetap masuk total aset.
    const countsInStats = (tx) => tx.type !== "transfer" && byId[tx.account_id]?.include_in_totals !== false;
    const canRecord = (a) => a && (a.my_role === "owner" || a.my_role === "editor");
    return {
      statRows, personHue, countsInStats, canRecord, bills, t, locale, setLocale,
      lastAccountId: () => { try { return localStorage.getItem("kk-last-account"); } catch { return null; } },
      rememberAccount: (id) => { try { localStorage.setItem("kk-last-account", id); } catch {} },
      supabase, user, profile, people, accounts: active, allAccounts: accounts, accountById: byId,
      categories, categoryById: catById, invites, budgets, loading, version,
      hidden, toggleHidden, refresh, notify, toast,
      txSheet, openTx: (o = {}) => setTxSheet(o), closeTx: () => setTxSheet(null),
      accountSheet, openAccount: (o = {}) => setAccountSheet(o), closeAccount: () => setAccountSheet(null),
    };
  }, [supabase, user, profile, people, accounts, categories, invites, budgets, bills, t, locale, setLocale, loading, version,
      hidden, toggleHidden, refresh, notify, toast, txSheet, accountSheet]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppDataProvider");
  return ctx;
}

/**
 * Ambil transaksi yang terlihat oleh user (RLS) dengan filter opsional.
 * Otomatis refetch saat ada perubahan realtime.
 */
export function useTransactions({ accountId, from, to, limit = 500 } = {}) {
  const { supabase, version, user } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const fromKey = from ? new Date(from).toISOString() : "";
  const toKey = to ? new Date(to).toISOString() : "";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      let q = supabase.from("transactions").select("*").order("occurred_at", { ascending: false }).limit(limit);
      if (accountId) q = q.or(`account_id.eq.${accountId},to_account_id.eq.${accountId}`);
      if (fromKey) q = q.gte("occurred_at", fromKey);
      if (toKey) q = q.lt("occurred_at", toKey);
      const { data } = await q;
      if (!cancelled) {
        setRows((data || []).map((t) => ({ ...t, amount: Number(t.amount), fee: Number(t.fee) || 0 })));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, user, accountId, fromKey, toKey, limit, version]);

  return { rows, loading };
}

/** Kategori induk (root) dari sebuah kategori */
export function rootCategory(cat, catById) {
  let c = cat;
  let guard = 0;
  while (c?.parent_id && catById[c.parent_id] && guard++ < 5) c = catById[c.parent_id];
  return c;
}
