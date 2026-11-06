"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Download, SlidersHorizontal, X, Check } from "lucide-react";
import { useApp, useTransactions } from "@/lib/app-data";
import { periodRange, firstName } from "@/lib/format";
import { toISODate } from "@/lib/analytics";
import { Money, PageHeader, Segmented, Sheet, AccountGlyph } from "@/components/ui";
import { TxGroupedList, txDirection } from "@/components/TxList";
import { PeriodPill } from "@/components/PeriodBar";
import ActivityCalendar from "@/components/ActivityCalendar";

const TYPES = [
  { value: "all", label: "Semua" },
  { value: "expense", label: "Pengeluaran" },
  { value: "income", label: "Pemasukan" },
  { value: "transfer", label: "Transfer" },
];

export default function ActivityPage() {
  const { accountById, categoryById, user, accounts, people, t, cycle, statRows, countsInStats, locale } = useApp();
  const [period, setPeriod] = useState("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [range, setRange] = useState(() => ({ from: toISODate(new Date(Date.now() - 29 * 86400000)), to: toISODate(new Date()) }));
  const [who, setWho] = useState("all");
  // Periode "Bulan" mengikuti siklus saya (gajian / tanggal tetap) saat melihat Semua atau Saya
  const ctx = { cycle: who === "all" || who === user?.id ? cycle : null, range };
  const { start, end } = periodRange(period, anchor, ctx);
  // ?akun=<id> dari halaman detail akun (layout hanya render di client, jadi window aman)
  const [accountId, setAccountId] = useState(() => new URLSearchParams(window.location.search).get("akun") || "");
  const { rows } = useTransactions({ from: start, to: end, limit: 5000, accountId: accountId || undefined });
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [day, setDay] = useState(null);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem("kk-cal-collapsed") === "1"; } catch { return false; } });
  const searchRef = useRef(null);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);
  function toggleCollapsed() {
    setCollapsed((c) => { try { localStorage.setItem("kk-cal-collapsed", c ? "0" : "1"); } catch {} return !c; });
  }

  // Semua filter kecuali tanggal → dipakai kalender; ditambah filter tanggal → daftar
  const base = useMemo(() => rows.filter((tx) => {
    if (who !== "all" && tx.created_by !== who) return false;
    if (filter !== "all" && tx.type !== filter) return false;
    if (q) {
      const hay = [tx.note, categoryById[tx.category_id]?.name, tx.account_name, tx.to_account_name].join(" ").toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [rows, filter, q, who, categoryById]);
  const list = useMemo(() => (day ? base.filter((tx) => toISODate(tx.occurred_at) === day) : base), [base, day]);

  const statsOf = (l) => statRows(l).filter(countsInStats);
  const calRows = useMemo(() => statsOf(base), [base, statRows, countsInStats]); // eslint-disable-line react-hooks/exhaustive-deps
  // Arus kas daftar ini (sama dengan Analisis: tanpa transfer & penyesuaian, biaya transfer = pengeluaran)
  const flow = statsOf(list).reduce((f, r) => {
    if (r.type === "income") f.inc += r.amount; else if (r.type === "expense") f.exp += r.amount;
    return f;
  }, { inc: 0, exp: 0 });
  const net = list.reduce((s, tx) => {
    const d = txDirection(tx, accountById, accountId || undefined);
    return s + (d === "in" ? tx.amount : d === "out" ? -(tx.amount + (tx.fee || 0)) : -(tx.fee || 0));
  }, 0);

  const persons = [{ value: "all", label: t("Semua") }, ...Object.values(people).sort((a, b) => (a.id === user?.id ? -1 : b.id === user?.id ? 1 : 0))
    .map((p) => ({ value: p.id, label: p.id === user?.id ? t("Saya") : firstName(p) }))];

  function changePeriod(p, a) { setPeriod(p); setAnchor(a); setDay(null); }

  // Chip filter aktif (bisa dihapus satu per satu)
  const loc = locale === "en" ? "en-GB" : "id-ID";
  const chips = [
    day && { key: "day", label: new Date(`${day}T00:00:00`).toLocaleDateString(loc, { weekday: "short", day: "numeric", month: "short" }), clear: () => setDay(null) },
    who !== "all" && { key: "who", label: persons.find((p) => p.value === who)?.label, clear: () => setWho("all") },
    filter !== "all" && { key: "type", label: t(TYPES.find((f) => f.value === filter).label), clear: () => setFilter("all") },
    accountId && { key: "acc", label: accountById[accountId]?.name || t("Akun"), clear: () => setAccountId("") },
    q && !searchOpen && { key: "q", label: `“${q}”`, clear: () => setQ("") },
  ].filter(Boolean);
  const sheetCount = (who !== "all") + (filter !== "all") + !!accountId;

  // Ekspor CSV (dibuka di Excel / Google Sheets); angka tanpa format supaya bisa dijumlah
  function exportCsv() {
    const head = [t("Tanggal"), t("Jenis"), t("Kategori"), t("Sub-kategori"), t("Akun"), t("Ke akun"), t("Jumlah"), t("Biaya transfer"), t("Catatan"), t("Dicatat oleh")];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = list.map((tx) => {
      const cat = categoryById[tx.category_id];
      const parent = cat?.parent_id ? categoryById[cat.parent_id] : null;
      return [
        new Date(tx.occurred_at).toISOString().slice(0, 16).replace("T", " "),
        tx.is_adjustment ? t("Penyesuaian saldo") : t(tx.type === "income" ? "Pemasukan" : tx.type === "expense" ? "Pengeluaran" : "Transfer"),
        parent ? parent.name : cat?.name || "",
        parent ? cat.name : "",
        accountById[tx.account_id]?.name || tx.account_name || "",
        tx.to_account_id ? accountById[tx.to_account_id]?.name || tx.to_account_name || "" : "",
        tx.amount,
        tx.fee || 0,
        tx.note || "",
        firstName(people[tx.created_by]),
      ].map(esc).join(",");
    });
    const blob = new Blob(["﻿" + [head.map(esc).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `finance-tracker-${toISODate(start)}_${toISODate(new Date(end - 86400000))}.csv`; // taste-skill-ignore: tanggal di nama file
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const iconBtn = "relative grid h-10 w-10 place-items-center rounded-full bg-fill text-brand-600 active:opacity-60 disabled:opacity-40";

  return (
    <div>
      <PageHeader title={t("Aktivitas")} back="/"
        right={<>
          <button className={iconBtn} onClick={() => setSearchOpen((o) => !o)} aria-label={t("Cari")} aria-expanded={searchOpen}><Search className="h-[18px] w-[18px]" /></button>
          <button className={iconBtn} onClick={() => setSheet(true)} aria-label={t("Filter")}>
            <SlidersHorizontal className="h-[18px] w-[18px]" />
            {sheetCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">{sheetCount}</span>}
          </button>
          <button className={iconBtn} onClick={exportCsv} disabled={!list.length} aria-label={t("Ekspor CSV")}><Download className="h-[18px] w-[18px]" /></button>
        </>} />

      <div className="max-w-[720px]">
        {searchOpen && (
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-soft" />
            <input ref={searchRef} className="field pl-11 pr-11" aria-label={t("Cari")} placeholder={t("Cari catatan, kategori, akun…")} value={q}
              onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)} />
            <button className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink-soft active:bg-fill"
              onClick={() => { setQ(""); setSearchOpen(false); }} aria-label={t("Tutup")}><X className="h-4 w-4" /></button>
          </div>
        )}

        <PeriodPill period={period} anchor={anchor} ctx={ctx} range={range} onRange={(r) => { setRange(r); setDay(null); }} onChange={changePeriod} />

        {chips.length > 0 && (
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 no-scrollbar">
            {chips.map((c) => (
              <button key={c.key} onClick={c.clear} className="chip h-9 bg-brand-50 text-[14px] text-brand-600" aria-label={t("Hapus filter {name}", { name: c.label })}>
                <span className="capitalize">{c.label}</span> <X className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}

        <section className="card mt-3 overflow-hidden">
          {period !== "range" && (
            <ActivityCalendar period={period} start={start} end={end} rows={calRows} selected={day} onSelect={setDay}
              onPickMonth={(d) => changePeriod("month", d)} collapsed={collapsed} onToggle={toggleCollapsed} />
          )}
          <div className={`grid grid-cols-3 gap-2 px-4 py-3 ${period !== "range" ? "border-t border-line" : ""}`}>
            {[[t("Masuk"), flow.inc, "text-income", true], [t("Keluar"), flow.exp, "text-expense", false], [t("Sisa"), flow.inc - flow.exp, flow.inc - flow.exp >= 0 ? "text-[#06B6D4]" : "text-expense", true]].map(([l, v, c, sg]) => (
              <div key={l} className="min-w-0">
                <p className={`text-[12px] font-semibold ${c}`}>{l}</p>
                <Money value={v} compact sign={sg} className="block truncate text-[16px] font-bold tracking-tight" dots={4} />
              </div>
            ))}
          </div>
        </section>

        <div className="my-4 flex items-center justify-between gap-3 text-[14px] text-ink-soft">
          <span>{t("{n} catatan", { n: list.length })}</span>
          <span>{t("Arus bersih")} <Money value={net} sign className={`font-medium ${net >= 0 ? "text-income" : "text-ink"}`} dots={5} /></span>
        </div>
        <TxGroupedList rows={list} perspectiveId={accountId || undefined} emptyText={t("Tidak ada catatan")} />
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title={t("Filter")}
        footer={<div className="flex gap-2">
          <button className="btn-ghost h-12 px-5 text-[16px]" disabled={!sheetCount} onClick={() => { setWho("all"); setFilter("all"); setAccountId(""); }}>{t("Reset")}</button>
          <button className="btn-primary h-12 flex-1 text-[16px]" onClick={() => setSheet(false)}>{t("Selesai")}</button>
        </div>}>
        <div className="space-y-5 pb-4 pt-1">
          {persons.length > 2 && (
            <div>
              <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">{t("Orang")}</p>
              <Segmented value={who} onChange={(v) => { setWho(v); setDay(null); }} className="w-full" options={persons} />
            </div>
          )}
          <div>
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">{t("Jenis")}</p>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((f) => (
                <button key={f.value} onClick={() => setFilter(f.value)} aria-pressed={filter === f.value}
                  className={`chip h-10 border ${filter === f.value ? "border-brand-600 bg-brand-600 text-white" : "border-transparent bg-fill text-ink"}`}>{t(f.label)}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">{t("Akun")}</p>
            <div className="card divide-y divide-line overflow-hidden">
              {[{ id: "", name: t("Semua akun") }, ...accounts].map((a) => (
                <button key={a.id || "all"} onClick={() => setAccountId(a.id)} aria-pressed={accountId === a.id}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fill">
                  {a.id ? <AccountGlyph account={a} size={30} /> : <span className="grid h-[30px] w-[30px] place-items-center rounded-[8px] bg-fill"><SlidersHorizontal className="h-4 w-4 text-ink-soft" /></span>}
                  <span className="min-w-0 flex-1 truncate text-[16px]">{a.name}</span>
                  {accountId === a.id && <Check className="h-5 w-5 text-brand-600" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
