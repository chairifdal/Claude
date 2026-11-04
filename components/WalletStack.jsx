"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BankCard } from "./BankCard";
import { useApp } from "@/lib/app-data";

const PEEK = 48;
// Maksimal 4 kartu di belakang supaya kartu depan tetap utuh di layar HP; sisanya lewat titik navigasi
const MAX_BACK = 4;

/** Tumpukan kartu: ketuk kartu belakang untuk ke depan, geser untuk berganti, ketuk kartu depan untuk detail. */
export default function WalletStack({ accounts }) {
  const router = useRouter();
  const { t } = useApp();
  const [active, setActive] = useState(accounts[0]?.id);
  const touch = useRef(null);

  useEffect(() => {
    if (!accounts.some((a) => a.id === active)) setActive(accounts[0]?.id);
  }, [accounts, active]);

  if (!accounts.length) return null;
  const idx = Math.max(0, accounts.findIndex((a) => a.id === active));
  const back = accounts.filter((a) => a.id !== active);
  const ordered = [...back.slice(Math.max(0, back.length - MAX_BACK)), accounts[idx]];

  function cycle(dir) {
    setActive(accounts[(idx + dir + accounts.length) % accounts.length].id);
  }

  return (
    <div>
      <div className="relative" style={{ paddingTop: (ordered.length - 1) * PEEK }}>
        <div className="invisible" style={{ aspectRatio: "1.586" }} />
        {ordered.map((a, i) => {
          const isFront = a.id === active;
          return (
            <button key={a.id} type="button"
              aria-label={isFront ? t("Buka {name}", { name: a.name }) : t("Tampilkan {name}", { name: a.name })}
              onClick={() => (isFront ? router.push(`/dompet/${a.id}`) : setActive(a.id))}
              onTouchStart={isFront ? (e) => { touch.current = e.touches[0].clientX; } : undefined}
              onTouchEnd={isFront ? (e) => {
                const dx = e.changedTouches[0].clientX - (touch.current ?? 0);
                if (Math.abs(dx) > 50) { e.preventDefault(); cycle(dx < 0 ? 1 : -1); }
                touch.current = null;
              } : undefined}
              className="absolute inset-x-0 top-0 block rounded-[22px] text-left transition-transform duration-300 [transition-timing-function:cubic-bezier(.2,.9,.25,1)]"
              style={{ transform: `translateY(${i * PEEK}px)`, zIndex: i + 1, filter: isFront ? "drop-shadow(0 18px 24px rgba(0,0,0,.22))" : "drop-shadow(0 -2px 8px rgba(0,0,0,.12))" }}>
              <BankCard account={a} concealed={!isFront} />
            </button>
          );
        })}
      </div>
      {accounts.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {accounts.map((a) => (
            <button key={a.id} onClick={() => setActive(a.id)} aria-label={a.name} className="grid h-6 place-items-center px-0.5">
              <span className={`block h-1.5 rounded-full transition-[width] ${a.id === active ? "w-5 bg-brand-600" : "w-1.5 bg-control"}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
