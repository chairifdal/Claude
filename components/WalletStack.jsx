"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BankCard } from "./BankCard";

const PEEK = 48;

/** Tumpukan kartu: ketuk kartu belakang untuk ke depan, geser untuk berganti, ketuk kartu depan untuk detail. */
export default function WalletStack({ accounts }) {
  const router = useRouter();
  const [active, setActive] = useState(accounts[0]?.id);
  const touch = useRef(null);

  useEffect(() => {
    if (!accounts.some((a) => a.id === active)) setActive(accounts[0]?.id);
  }, [accounts, active]);

  if (!accounts.length) return null;
  const idx = Math.max(0, accounts.findIndex((a) => a.id === active));
  const ordered = [...accounts.filter((a) => a.id !== active), accounts[idx]];

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
              aria-label={isFront ? `Buka ${a.name}` : `Tampilkan ${a.name}`}
              onClick={() => (isFront ? router.push(`/dompet/${a.id}`) : setActive(a.id))}
              onTouchStart={isFront ? (e) => { touch.current = e.touches[0].clientX; } : undefined}
              onTouchEnd={isFront ? (e) => {
                const dx = e.changedTouches[0].clientX - (touch.current ?? 0);
                if (Math.abs(dx) > 50) { e.preventDefault(); cycle(dx < 0 ? 1 : -1); }
                touch.current = null;
              } : undefined}
              className="absolute inset-x-0 top-0 block rounded-card border-2 border-canvas text-left transition-transform duration-300 [transition-timing-function:cubic-bezier(.2,.9,.25,1)]"
              style={{ transform: `translateY(${i * PEEK}px)`, zIndex: i + 1 }}>
              <BankCard account={a} concealed={!isFront} />
            </button>
          );
        })}
      </div>
      {accounts.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {accounts.map((a) => (
            <button key={a.id} onClick={() => setActive(a.id)} aria-label={a.name} className="grid h-6 place-items-center px-0.5">
              <span className={`block h-1.5 rounded-full transition-[width] ${a.id === active ? "w-5 bg-ink" : "w-1.5 bg-control"}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
