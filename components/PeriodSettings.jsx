"use client";
import { CalendarRange } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { rangeLabel } from "@/lib/period";
import { Segmented, Switch } from "./ui";

/** Pengaturan periode keuangan (per orang): kalender, mengikuti transaksi Gaji, atau tanggal tetap. */
export default function PeriodSettings() {
  const { profile, categories, cycle, savePeriod, salaryRoot, t } = useApp();
  if (!profile) return null;
  const mode = profile.period_mode || "calendar";
  const on = mode !== "calendar";
  const incomeRoots = categories.filter((c) => c.owner_id === profile.id && c.kind === "income" && !c.parent_id);
  const cur = cycle.rangeOf(new Date());

  return (
    <section className="card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[8px] bg-[#34C759] text-white"><CalendarRange className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <Switch id="period-on" checked={on} onChange={(v) => savePeriod({ period_mode: v ? "salary" : "calendar" })}
            label={t("Periode mengikuti gajian")}
            description={t("Beranda, Analisis, dan Anggaran dihitung dari gajian ke gajian, bukan tanggal 1. Tagihan tetap memakai tanggal kalender.")} />
        </div>
      </div>

      {on && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <Segmented value={mode} onChange={(m) => savePeriod({ period_mode: m })} options={[
            { value: "salary", label: t("Dari transaksi Gaji") },
            { value: "fixed", label: t("Tanggal tetap") },
          ]} />

          {mode === "salary" ? (
            <div>
              <label htmlFor="salary-cat" className="label">{t("Kategori pemicu")}</label>
              <select id="salary-cat" className="field" value={salaryRoot?.id || ""}
                onChange={(e) => savePeriod({ salary_category_id: e.target.value || null })}>
                {!salaryRoot && <option value="">{t("Pilih kategori pemasukan")}</option>}
                {incomeRoots.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="mt-2 text-[14px] text-ink-soft">
                {t("Periode baru dimulai di tanggal pemasukan kategori ini (termasuk sub-kategorinya). Gaji kedua yang masuk kurang dari 20 hari setelah awal periode tidak memulai periode baru.")}
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="period-day" className="label">{t("Mulai setiap tanggal")}</label>
              <select id="period-day" className="field" value={profile.period_day || 25} onChange={(e) => savePeriod({ period_day: Number(e.target.value) })}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          <div className="rounded-[14px] bg-fill px-4 py-3">
            <p className="text-[13px] font-medium uppercase tracking-wide text-ink-soft">{t("Periode sekarang")}</p>
            <p className="text-[17px] font-semibold">{rangeLabel(cur.start, cur.end, true)}</p>
            {configuredSalaryWithoutData(profile, cycle) && <p className="mt-1 text-[14px] text-warn-ink">{t("Belum ada pemasukan Gaji tercatat, jadi sementara memakai bulan kalender.")}</p>}
            {cur.predicted && <p className="mt-1 text-[14px] text-ink-soft">{t("Tanggal akhir adalah perkiraan gajian berikutnya.")}</p>}
          </div>
        </div>
      )}
    </section>
  );
}

const configuredSalaryWithoutData = (profile, cycle) => profile.period_mode === "salary" && cycle.mode === "calendar";
