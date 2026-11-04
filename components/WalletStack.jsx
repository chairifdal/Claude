"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BankCard } from "./BankCard";

const PEEK = 58;

/** Tumpukan kartu ala Wallet: ketuk kartu belakang untuk ke depan, geser untuk berganti, ketuk kartu depan untuk detail. */
export default function WalletStack({ accounts }) {
  const router = useRouter();
  const [active, setActive] = useState(accounts[0]?.id);
  const touch = useRef(null);

  useEffect(() => {
    if (!accounts.some((a) => a.id === active)) setActive(accounts[0]?.id);
  }, [accounts, active]);

  if (!accounts.length) return null;
  const idx = Math.max(0, accounts.findIndex((a) => a.id === active));
  const back = accounts.filter((a) => a.id !== active);
  const ordered = [...back, accounts[idx]];

  function cycle(dir) {
    const next = (idx + dir + accounts.length) % accounts.length;
    setActive(accounts[next].id);
  }

  return (
    <div>
      <div className="relative" style={{ paddingTop: (ordered.length - 1) * PEEK }}>
        <div className="invisible" style={{ aspectRatio: "1.62" }} />
        {ordered.map((a, i) => {
          const isFront = a.id === active;
          return (
            <button key={a.id} type="button"
              onClick={() => (isFront ? router.push(`/dompet/${a.id}`) : setActive(a.id))}
              onTouchStart={isFront ? (e) => { touch.current = e.touches[0].clientX; } : undefined}
              onTouchEnd={isFront ? (e) => {
                const dx = e.changedTouches[0].clientX - (touch.current ?? 0);
                if (Math.abs(dx) > 50) { e.preventDefault(); cycle(dx < 0 ? 1 : -1); }
                touch.current = null;
              } : undefined}
              className="absolute inset-x-0 block text-left transition-all duration-500 [transition-timing-function:cubic-bezier(.2,.9,.25,1)]"
              style={{
                top: 0,
                transform: `translateY(${i * PEEK}px) scale(${isFront ? 1 : 0.94 + (i / ordered.length) * 0.05})`,
                zIndex: i + 1,
                filter: isFront ? "drop-shadow(0 22px 28px rgba(14,20,48,.28))" : "drop-shadow(0 -2px 10px rgba(14,20,48,.12))",
              }}>
              <BankCard account={a} />
            </button>
          );
        })}
      </div>
      {accounts.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {accounts.map((a) => (
            <button key={a.id} onClick={() => setActive(a.id)} aria-label={a.name}
              className={`h-1.5 rounded-full transition-all ${a.id === active ? "w-6 bg-brand-600" : "w-1.5 bg-ink-mute/30"}`} />
          ))}
        </div>
      )}
      <p className="mt-2 text-center text-[12px] text-ink-mute">Geser kartu untuk berganti · ketuk untuk detail</p>
    </div>
  );
}
