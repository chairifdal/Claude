"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { dayLabel, timeLabel, dateTimeLabel, firstName, formatIDR, formatGram } from "@/lib/format";
import { Avatar, CategoryIcon, Empty, Money } from "./ui";

/** Arah transaksi dari sudut pandang akun tertentu (atau semua akun yang terlihat) */
export function txDirection(tx, accountById, perspectiveId) {
  if (tx.type === "income") return "in";
  if (tx.type === "expense") return "out";
  if (perspectiveId) return tx.to_account_id === perspectiveId ? "in" : "out";
  const seeFrom = !!accountById[tx.account_id];
  const seeTo = !!accountById[tx.to_account_id];
  if (seeFrom && seeTo) return "move";
  return seeTo ? "in" : "out";
}

export function TxRow({ tx, perspectiveId, showDate = false }) {
  const { accountById, categoryById, people, user, openTx, t, canRecord } = useApp();
  const dir = txDirection(tx, accountById, perspectiveId);
  const cat = tx.category_id ? categoryById[tx.category_id] : null;
  const parent = cat?.parent_id ? categoryById[cat.parent_id] : null;
  const from = accountById[tx.account_id];
  const to = tx.to_account_id ? accountById[tx.to_account_id] : null;
  const fromName = from?.name || tx.account_name || t("Akun");
  const toName = to?.name || tx.to_account_name || t("Akun");
  const creator = people[tx.created_by];
  const byOther = tx.created_by !== user?.id;
  // Peran "Lihat & transfer" hanya boleh mengubah transfer buatannya sendiri
  const canEdit = from && (canRecord(from) || (tx.type === "transfer" && tx.created_by === user?.id));

  let title, meta, icon;
  if (tx.type === "transfer") {
    title = dir === "in" ? t("Dari {name}", { name: fromName }) : dir === "out" ? t("Ke {name}", { name: toName }) : t("{from} ke {to}", { from: fromName, to: toName });
    meta = tx.fee > 0 && dir !== "in" ? t("Transfer · biaya {fee}", { fee: formatIDR(tx.fee) }) : t("Transfer");
    const I = dir === "in" ? ArrowDownLeft : dir === "out" ? ArrowUpRight : ArrowLeftRight;
    icon = (
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-[#7A78FF] to-transfer text-white" aria-hidden="true">
        <I style={{ width: 22, height: 22 }} strokeWidth={2.2} />
      </span>
    );
  } else if (tx.is_adjustment) {
    title = t("Penyesuaian saldo");
    meta = fromName;
    icon = (
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-[#8E8E93] to-[#636366] text-white" aria-hidden="true">
        <SlidersHorizontal style={{ width: 20, height: 20 }} strokeWidth={2.2} />
      </span>
    );
  } else {
    title = cat?.name || (tx.type === "income" ? t("Pemasukan") : t("Pengeluaran"));
    meta = [parent?.name, fromName].filter(Boolean).join(" · ");
    icon = <CategoryIcon category={cat || { color: "#94A3B8" }} size={44} />;
  }

  if (tx.quantity) meta = `${meta} · ${formatGram(tx.quantity)}`;

  // Polaritas tenang: masuk hijau dengan +, keluar tinta dengan −
  const amount = dir === "in" ? tx.amount : dir === "out" ? -(tx.amount + (tx.fee || 0)) : tx.amount;
  const amountClass = dir === "in" ? "text-income" : "text-ink";

  const when = showDate ? dateTimeLabel(tx.occurred_at) : timeLabel(tx.occurred_at);

  return (
    <button type="button" disabled={!canEdit} onClick={() => openTx({ tx })}
      className="flex min-h-[72px] w-full min-w-0 flex-1 items-center gap-3 rounded-control px-3 py-3 text-left transition enabled:hover:bg-canvas">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px]">{title}</p>
        <p className="flex items-center gap-1.5 truncate text-[14px] text-ink-soft">
          {byOther && creator && <Avatar profile={creator} size={18} />}
          <span className="truncate">{byOther && creator ? `${firstName(creator)} · ` : ""}{tx.is_adjustment ? meta : tx.note || meta}{tx.recurring_id ? ` · ${t("otomatis")}` : ""}</span>
        </p>
      </div>
      <div className="flex-none text-right">
        <Money value={amount} sign={dir === "in"} className={`block text-[17px] font-semibold ${amountClass}`} dots={5} />
        <p className="tabular text-[14px] text-ink-soft">{when}</p>
      </div>
    </button>
  );
}

/**
 * Daftar transaksi. Default: dikelompokkan per hari mengikuti urutan `rows`.
 * flat: satu kartu tanpa judul hari (untuk urutan nominal), tanggal tampil di tiap baris.
 * onReorder(items, from, to): bila diisi, catatan bisa ditahan lalu digeser naik/turun di dalam harinya.
 */
export function TxGroupedList({ rows, perspectiveId, emptyText, emptyHint, flat = false, onReorder = null, busy = false }) {
  const { t } = useApp();
  if (!rows.length) return <Empty title={emptyText || t("Belum ada transaksi")} text={emptyHint ?? t("Tekan + untuk mencatat yang pertama.")} />;
  if (flat) {
    return (
      <div className="card p-1">
        {rows.map((tx) => <TxRow key={tx.id} tx={tx} perspectiveId={perspectiveId} showDate />)}
      </div>
    );
  }
  const groups = [];
  let current = null;
  for (const tx of rows) {
    const key = new Date(tx.occurred_at).toDateString();
    if (!current || current.key !== key) { current = { key, date: tx.occurred_at, items: [] }; groups.push(current); }
    current.items.push(tx);
  }
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="mb-1.5 pl-4 text-[13px] font-medium uppercase tracking-wide text-ink-soft">{dayLabel(g.date)}</h3>
          {onReorder && g.items.length > 1
            ? <DraggableDay items={g.items} busy={busy} onReorder={(from, to) => onReorder(g.items, from, to)}
                renderItem={(tx) => <TxRow tx={tx} perspectiveId={perspectiveId} />} />
            : <div className="card p-1">{g.items.map((tx) => <TxRow key={tx.id} tx={tx} perspectiveId={perspectiveId} />)}</div>}
        </section>
      ))}
    </div>
  );
}

const HOLD_MS = 380;   // lama menahan sebelum mulai menggeser
const SLOP_PX = 8;     // bergerak lebih dari ini sebelum aktif = menggulir, bukan menggeser

/** Daftar yang barisnya bisa ditahan lalu digeser (sentuh & mouse). */
export function DraggableDay({ items, busy, onReorder, renderItem }) {
  const box = useRef(null);
  const press = useRef(null);       // { idx, y0, timer, active, rects, dy, target }
  const blockClick = useRef(false);
  const [drag, setDrag] = useState(null); // { idx, dy, target, h }
  const cb = useRef({ onReorder, busy });
  cb.current = { onReorder, busy };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const yOf = (e) => (e.touches ? e.touches[0] : e).clientY;

    function start(e) {
      if (cb.current.busy || (e.button !== undefined && e.button !== 0)) return;
      const row = e.target.closest("[data-idx]");
      if (!row || !el.contains(row)) return;
      const idx = Number(row.dataset.idx);
      const y0 = yOf(e);
      clear();
      press.current = { idx, y0, active: false };
      press.current.timer = setTimeout(() => {
        const rows = [...el.querySelectorAll("[data-idx]")];
        const rects = rows.map((r) => r.getBoundingClientRect());
        Object.assign(press.current, { active: true, rects, dy: 0, target: idx });
        try { navigator.vibrate?.(12); } catch {}
        setDrag({ idx, dy: 0, target: idx, h: rects[idx].height });
      }, HOLD_MS);
    }

    function move(e) {
      const p = press.current;
      if (!p) return;
      const dy = yOf(e) - p.y0;
      if (!p.active) {
        if (Math.abs(dy) > SLOP_PX) clear(); // pengguna sedang menggulir
        return;
      }
      if (e.cancelable) e.preventDefault(); // jangan gulir halaman saat menggeser
      const { rects, idx } = p;
      const center = rects[idx].top + rects[idx].height / 2 + dy;
      let target = 0;
      rects.forEach((r, i) => { if (center > r.top + r.height / 2) target = i; });
      if (center < rects[0].top + rects[0].height / 2) target = 0;
      p.dy = dy; p.target = target;
      setDrag({ idx, dy, target, h: rects[idx].height });
    }

    function end() {
      const p = press.current;
      clear();
      if (!p?.active) return;
      blockClick.current = true; // lepas tahan tidak membuka form ubah
      setTimeout(() => { blockClick.current = false; }, 400);
      setDrag(null);
      if (p.target !== p.idx) cb.current.onReorder(p.idx, p.target);
    }

    function clear() {
      if (press.current?.timer) clearTimeout(press.current.timer);
      press.current = null;
    }
    const onClick = (e) => { if (blockClick.current) { e.preventDefault(); e.stopPropagation(); } };
    const onMenu = (e) => { if (press.current) e.preventDefault(); };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("mousedown", start);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    el.addEventListener("click", onClick, true);
    el.addEventListener("contextmenu", onMenu);
    return () => {
      clear();
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
      el.removeEventListener("mousedown", start);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("contextmenu", onMenu);
    };
  }, []);

  // Geser baris lain untuk memberi tempat bagi baris yang sedang dipindah
  const offset = (i) => {
    if (!drag) return 0;
    if (i === drag.idx) return drag.dy;
    if (drag.idx < drag.target && i > drag.idx && i <= drag.target) return -drag.h;
    if (drag.idx > drag.target && i >= drag.target && i < drag.idx) return drag.h;
    return 0;
  };

  return (
    <div ref={box} className={`card p-1 ${busy ? "opacity-60" : ""}`} style={{ WebkitTouchCallout: "none", userSelect: "none", WebkitUserSelect: "none" }}>
      {items.map((tx, i) => {
        const active = drag?.idx === i;
        return (
          <div key={tx.id} data-idx={i}
            className={`relative rounded-control ${active ? "z-10 bg-surface shadow-float" : drag ? "transition-transform duration-150" : ""}`}
            style={{ transform: offset(i) ? `translateY(${offset(i)}px)` : undefined }}>
            {renderItem(tx)}
          </div>
        );
      })}
    </div>
  );
}
