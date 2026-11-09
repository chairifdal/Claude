"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { CategoryIcon } from "./ui";

const PER_PAGE = 12; // 4 kolom × 3 baris; sisanya di halaman berikut (geser ke samping)

/** Pilihan kategori maksimal 3 baris, selebihnya digeser ke samping. */
export default function CategoryPager({ items, isActive, onPick, iconSize = 32 }) {
  const { t } = useApp();
  const ref = useRef(null);
  const [page, setPage] = useState(0);
  const pages = [];
  for (let i = 0; i < items.length; i += PER_PAGE) pages.push(items.slice(i, i + PER_PAGE));

  const goPage = (i, smooth = true) => {
    const el = ref.current;
    if (!el) return;
    const p = Math.max(0, Math.min(pages.length - 1, i));
    el.scrollTo({ left: p * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
    setPage(p);
  };

  // Kategori terpilih ada di halaman lain (mis. saat mengubah catatan) → langsung tampilkan halamannya
  useEffect(() => {
    const idx = items.findIndex(isActive);
    if (idx >= PER_PAGE) goPage(Math.floor(idx / PER_PAGE), false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div ref={ref} className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
        onScroll={(e) => { const el = e.currentTarget; setPage(Math.round(el.scrollLeft / el.clientWidth)); }}>
        {pages.map((list, pi) => (
          <div key={pi} className="grid w-full flex-none snap-start snap-always grid-cols-4 content-start gap-1">
            {list.map((c) => {
              const active = isActive(c);
              return (
                <button key={c.id} type="button" aria-pressed={active} onClick={() => onPick(c)}
                  className={`flex flex-col items-center gap-1 rounded-control border px-1 py-2 transition ${active ? "border-brand-600 bg-brand-50" : "border-transparent hover:bg-canvas"}`}>
                  <CategoryIcon category={c} size={iconSize} />
                  <span className="line-clamp-2 text-center text-[13px] leading-tight">{c.name}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-2">
          <button type="button" aria-label={t("Sebelumnya")} onClick={() => goPage(page - 1)} disabled={page === 0}
            className="hidden h-7 w-7 place-items-center rounded-full bg-fill text-ink-soft disabled:opacity-30 md:grid">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5" role="tablist">
            {pages.map((_, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === page} aria-label={t("Halaman {n}", { n: i + 1 })} onClick={() => goPage(i)}
                className={`h-1.5 rounded-full transition-all ${i === page ? "w-4 bg-brand-600" : "w-1.5 bg-ink-mute/40"}`} />
            ))}
          </div>
          <button type="button" aria-label={t("Berikutnya")} onClick={() => goPage(page + 1)} disabled={page === pages.length - 1}
            className="hidden h-7 w-7 place-items-center rounded-full bg-fill text-ink-soft disabled:opacity-30 md:grid">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
