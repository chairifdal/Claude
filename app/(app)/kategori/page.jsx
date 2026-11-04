"use client";
import { useState } from "react";
import { Plus, CornerDownRight, Loader2, Trash2, Search } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { ICON_GROUPS } from "@/lib/constants";
import { CategoryIcon, PageHeader, Segmented, Sheet } from "@/components/ui";

export default function CategoriesPage() {
  const { categories, user, t } = useApp();
  const [kind, setKind] = useState("expense");
  const [edit, setEdit] = useState(null); // { category } | { parent } | {}

  const mine = categories.filter((c) => c.owner_id === user?.id && c.kind === kind);
  const roots = mine.filter((c) => !c.parent_id);

  return (
    <div>
      <PageHeader title={t("Kategori")} subtitle={t("Atur kategori & sub-kategori")} back="/pengaturan"
        right={<button className="btn-primary h-10 px-4 text-[14px]" onClick={() => setEdit({})}><Plus className="h-4 w-4" /> {t("Kategori")}</button>} />

      <div className="max-w-[720px]">
        <Segmented value={kind} onChange={setKind} className="sm:w-[320px]" options={[
          { value: "expense", label: t("Pengeluaran") },
          { value: "income", label: t("Pemasukan") },
        ]} />

        <div className="mt-4 space-y-3">
          {roots.map((r) => {
            const subs = mine.filter((c) => c.parent_id === r.id);
            return (
              <div key={r.id} className="card overflow-hidden">
                <button onClick={() => setEdit({ category: r })} className="flex w-full items-center gap-3 p-4 text-left hover:bg-raised">
                  <CategoryIcon category={r} size={36} />
                  <div className="flex-1">
                    <p className="text-[16px] font-medium">{r.name}</p>
                    <p className="text-[14px] text-ink-soft">{subs.length ? t("{n} sub-kategori", { n: subs.length }) : t("Tanpa sub-kategori")}</p>
                  </div>
                </button>
                <div className="flex flex-wrap gap-2 border-t border-rule px-4 py-3">
                  {subs.map((s) => (
                    <button key={s.id} onClick={() => setEdit({ category: s })} className="chip h-9 border border-line bg-white text-ink">
                      <CornerDownRight className="h-3.5 w-3.5 text-ink-soft" /> {s.name}
                    </button>
                  ))}
                  <button onClick={() => setEdit({ parent: r })} className="chip h-9 border border-dashed border-control text-ink-soft">
                    <Plus className="h-3.5 w-3.5" /> {t("Sub-kategori")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Sheet open={!!edit} onClose={() => setEdit(null)} full
        title={edit?.category ? t("Ubah kategori") : edit?.parent ? t("Sub-kategori {name}", { name: edit.parent.name }) : t("Kategori baru")}>
        {edit && <CategoryForm key={edit.category?.id || edit.parent?.id || "new"} {...edit} kind={kind} roots={roots} onDone={() => setEdit(null)} />}
      </Sheet>
    </div>
  );
}

function CategoryForm({ category, parent, kind, roots, onDone }) {
  const { supabase, user, notify, refresh, t } = useApp();
  const [name, setName] = useState(category?.name || "");
  const [icon, setIcon] = useState(category?.icon || parent?.icon || "circle");
  const [parentId, setParentId] = useState(category ? category.parent_id || "" : parent?.id || "");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const color = category?.color || parent?.color || roots.find((r) => r.id === parentId)?.color || "#64748B";

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const payload = { name: name.trim(), icon, color, parent_id: parentId || null, kind: category?.kind || kind };
    const { error } = category
      ? await supabase.from("categories").update(payload).eq("id", category.id)
      : await supabase.from("categories").insert({ ...payload, owner_id: user.id, sort_order: 50 });
    setBusy(false);
    if (error) return notify(error.message, "err");
    notify(t("Kategori disimpan")); refresh(); onDone();
  }
  async function remove() {
    const { error } = await supabase.from("categories").delete().eq("id", category.id);
    if (error) return notify(error.message, "err");
    notify(t("Kategori dihapus")); refresh(); onDone();
  }

  const parentOptions = roots.filter((r) => r.id !== category?.id);
  const ql = q.trim().toLowerCase();

  return (
    <div className="space-y-6 pb-6">
      <div>
        <label htmlFor="cat-name" className="label">{t("Nama")}</label>
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 flex-none place-items-center rounded-control border border-line"><CategoryIcon category={{ icon }} size={28} /></span>
          <input id="cat-name" autoFocus className="field" placeholder={t("mis. Gas LPG")} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>

      <div>
        <label htmlFor="cat-parent" className="label">{t("Induk")}</label>
        <select id="cat-parent" className="field" value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">{t("Tanpa induk (kategori utama)")}</option>
          {parentOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      <div>
        <p className="label">{t("Ikon")}</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-soft" />
          <input className="field pl-11" aria-label={t("Cari ikon")} placeholder={t("Cari ikon, mis. gas, susu, sekolah")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="mt-3 space-y-4">
          {ICON_GROUPS.map((g) => {
            const icons = Object.entries(g.icons).filter(([k]) => !ql || k.includes(ql) || t(g.label).toLowerCase().includes(ql) || (ICON_WORDS[k] || "").includes(ql));
            if (!icons.length) return null;
            return (
              <div key={g.label}>
                <p className="mb-2 text-[14px] text-ink-soft">{t(g.label)}</p>
                <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-9">
                  {icons.map(([k, Icon]) => (
                    <button key={k} type="button" onClick={() => setIcon(k)} aria-label={k} aria-pressed={icon === k}
                      className={`grid aspect-square place-items-center rounded-control border transition ${icon === k ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-ink-soft hover:text-ink"}`}>
                      <Icon className="h-5 w-5" strokeWidth={1.6} />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        {category && (confirm
          ? <button className="btn-danger" onClick={remove}>{t("Yakin hapus?")}</button>
          : <button className="btn-danger w-12 px-0" onClick={() => setConfirm(true)} aria-label={t("Hapus")}><Trash2 className="h-5 w-5" /></button>)}
        <button className="btn-primary flex-1" disabled={busy || !name.trim()} onClick={save}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("Simpan")}
        </button>
      </div>
      {category && !category.parent_id && <p className="text-[14px] text-ink-soft">{t("Menghapus kategori utama juga menghapus sub-kategorinya. Transaksi lama tetap ada tanpa kategori.")}</p>}
    </div>
  );
}

// Kata kunci pencarian ikon dalam Bahasa Indonesia
const ICON_WORDS = {
  utensils: "makan", "shopping-basket": "belanja dapur sayur", "shopping-cart": "belanja supermarket", coffee: "kopi", "glass-water": "galon air minum",
  milk: "susu", soup: "sayur masak", pizza: "makanan", apple: "buah", carrot: "sayur", beef: "daging", fish: "ikan", egg: "telur", wheat: "beras",
  cake: "kue ulang tahun", "cooking-pot": "masak dapur", refrigerator: "kulkas", home: "rumah", zap: "listrik pln token", plug: "listrik", droplet: "air pdam",
  droplets: "air", flame: "gas lpg kompor", wifi: "internet", tv: "tv", router: "internet wifi", phone: "pulsa telepon", key: "sewa kontrakan kpr kost",
  building: "apartemen", "hand-helping": "art asisten pembantu", trash: "sampah iuran kebersihan", wrench: "servis perbaikan", hammer: "renovasi tukang",
  paintbrush: "cat renovasi", "spray-can": "sabun deterjen pembersih", "washing-machine": "laundry cuci", sofa: "perabot", bed: "kasur", bath: "mandi",
  shower: "mandi", lamp: "lampu", sprout: "tanaman kebun", flower: "bunga", baby: "bayi anak popok", "toy-brick": "mainan", school: "sekolah spp",
  "graduation-cap": "kuliah wisuda", book: "buku les", backpack: "tas sekolah", "heart-pulse": "kesehatan", stethoscope: "dokter rumah sakit",
  pill: "obat vitamin", syringe: "vaksin imunisasi", shield: "asuransi bpjs", dumbbell: "olahraga gym", "shopping-bag": "belanja", shirt: "baju",
  scissors: "salon cukur", sparkles: "bonus perawatan", gem: "perhiasan emas", watch: "jam", glasses: "kacamata", smartphone: "hp", laptop: "laptop kerja",
  car: "mobil", fuel: "bensin", bike: "motor ojek", bus: "bus", train: "kereta krl", "circle-parking": "parkir tol", plane: "pesawat liburan", hotel: "hotel",
  ticket: "tiket", clapperboard: "film bioskop", gamepad: "game", music: "musik", umbrella: "hujan", receipt: "tagihan cicilan", banknote: "uang tunai",
  "hand-coins": "uang belanja", coins: "receh", "piggy-bank": "tabungan", wallet: "dompet", landmark: "bank pajak", "credit-card": "kartu kredit",
  briefcase: "gaji kerja", "trending-up": "investasi", "hand-heart": "sedekah zakat infaq", gift: "hadiah kado", heart: "keluarga", users: "keluarga arisan",
  calendar: "bulanan", target: "target", package: "paket", truck: "pindahan kirim", "paw-print": "hewan", dog: "anjing", cat: "kucing",
};
