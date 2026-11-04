"use client";
import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { firstName } from "@/lib/format";
import { AccountGlyph, Money } from "./ui";

/**
 * Pemilih akun: satu baris berisi akun terpilih; ketuk untuk membuka daftar
 * (dikelompokkan "Akun saya" dan "Dibagikan ke saya"), pilih, daftar menutup lagi.
 */
export default function AccountPicker({ id, label, accounts, value, onChange, placeholder }) {
  const { user, people, t } = useApp();
  const [open, setOpen] = useState(!value);
  const selected = accounts.find((a) => a.id === value);
  const mine = accounts.filter((a) => a.owner_id === user?.id);
  const shared = accounts.filter((a) => a.owner_id !== user?.id);
  const meta = (a) => (a.owner_id !== user?.id ? t("Milik {name}", { name: firstName(people[a.owner_id]) }) : null);

  return (
    <div>
      {label && <p id={`${id}-label`} className="label">{label}</p>}
      <div className="rounded-control border border-line bg-white">
        <button type="button" aria-expanded={open} aria-labelledby={label ? `${id}-label` : undefined} onClick={() => setOpen((o) => !o)}
          className="flex min-h-[60px] w-full items-center gap-3 px-3 py-2 text-left">
          {selected ? (
            <>
              <AccountGlyph account={selected} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-medium">{selected.name}</span>
                <span className="block truncate text-[14px] text-ink-soft">{meta(selected) || <Money value={selected.balance} dots={5} />}</span>
              </span>
            </>
          ) : (
            <span className="flex-1 text-[16px] text-ink-soft">{placeholder || t("Pilih akun")}</span>
          )}
          <ChevronDown className={`h-5 w-5 flex-none text-ink-soft transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="border-t border-rule p-1" role="listbox" aria-labelledby={label ? `${id}-label` : undefined}>
            {[[t("Akun saya"), mine], [t("Dibagikan ke saya"), shared]].filter(([, list]) => list.length).map(([title, list]) => (
              <div key={title}>
                {mine.length > 0 && shared.length > 0 && <p className="px-3 pb-1 pt-2 text-[14px] text-ink-soft">{title}</p>}
                {list.map((a) => {
                  const active = a.id === value;
                  return (
                    <button key={a.id} type="button" role="option" aria-selected={active}
                      onClick={() => { onChange(a.id); setOpen(false); }}
                      className={`flex min-h-[56px] w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left ${active ? "bg-fill" : "hover:bg-canvas"}`}>
                      <AccountGlyph account={a} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px]">{a.name}</span>
                        {meta(a) && <span className="block truncate text-[14px] text-ink-soft">{meta(a)}</span>}
                      </span>
                      {!meta(a) && <Money value={a.balance} className="flex-none text-[14px] text-ink-soft" dots={4} />}
                      <Check className={`h-5 w-5 flex-none text-ink ${active ? "" : "invisible"}`} />
                    </button>
                  );
                })}
              </div>
            ))}
            {!accounts.length && <p className="px-3 py-3 text-[14px] text-ink-soft">{t("Belum ada akun yang bisa dipilih.")}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
