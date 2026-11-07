"use client";
import { LayoutGrid } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { Switch } from "./ui";

// Widget Beranda yang bisa disembunyikan. Kartu saldo dan undangan selalu tampil.
export const HOME_WIDGETS = [
  { key: "insight", label: "Insight" },
  { key: "quick", label: "Catat cepat" },
  { key: "budget", label: "Anggaran" },
  { key: "bills", label: "Tagihan bulan ini" },
  { key: "couple", label: "Kita bulan ini" },
  { key: "spending", label: "Ke mana uangnya" },
  { key: "accounts", label: "Akun" },
  { key: "goals", label: "Target tabungan" },
  { key: "recent", label: "Terakhir dicatat" },
];

export default function HomeWidgetSettings() {
  const { homeHidden, saveProfile, t } = useApp();
  const toggle = (key, on) => {
    const next = on ? homeHidden.filter((k) => k !== key) : [...new Set([...homeHidden, key])];
    saveProfile({ home_hidden: next });
  };
  return (
    <section className="card p-5">
      <p className="flex items-center gap-3 text-[17px]">
        <span className="grid h-[30px] w-[30px] place-items-center rounded-[8px] bg-[#FF9500] text-white"><LayoutGrid className="h-[18px] w-[18px]" /></span>
        {t("Tampilan Beranda")}
      </p>
      <p className="mt-1 text-[14px] text-ink-soft">{t("Pilih kartu yang muncul di Beranda. Kartu saldo selalu tampil.")}</p>
      <div className="mt-3 divide-y divide-line">
        {HOME_WIDGETS.map((w) => (
          <div key={w.key} className="py-2.5">
            <Switch id={`w-${w.key}`} checked={!homeHidden.includes(w.key)} onChange={(v) => toggle(w.key, v)} label={t(w.label)} />
          </div>
        ))}
      </div>
    </section>
  );
}
