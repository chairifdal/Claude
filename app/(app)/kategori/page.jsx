"use client";
import { useState } from "react";
import { Plus, CornerDownRight, Loader2, Trash2, Check } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/constants";
import { CategoryIcon, PageHeader, Segmented, Sheet } from "@/components/ui";

export default function CategoriesPage() {
  const { categories, user } = useApp();
  const [kind, setKind] = useState("expense");
  const [edit, setEdit] = useState(null); // { category } | { parent } | {}

  const mine = categories.filter((c) => c.owner_id === user?.id && c.kind === kind);
  const roots = mine.filter((c) => !c.parent_id);

  return (
    <div>
      <PageHeader title="Kategori" subtitle="Atur kategori & sub-kategori" back="/pengaturan"
        right={<button className="icon-btn bg-white shadow-card" onClick={() => setEdit({})} aria-label="Kategori baru"><Plus className="h-5 w-5" /></button>} />

      <Segmented value={kind} onChange={setKind} className="bg-white shadow-card" options={[
        { value: "expense", label: "Pengeluaran", activeClass: "text-expense" },
        { value: "income", label: "Pemasukan", activeClass: "text-income" },
      ]} />

      <div className="mt-4 space-y-3">
        {roots.map((r) => {
          const subs = mine.filter((c) => c.parent_id === r.id);
          return (
            <div key={r.id} className="card overflow-hidden">
              <button onClick={() => setEdit({ category: r })} className="flex w-full items-center gap-3 p-3.5 text-left">
                <CategoryIcon category={r} size={44} />
                <div className="flex-1">
                  <p className="font-bold">{r.name}</p>
                  <p className="text-[12px] text-ink-mute">{subs.length ? `${subs.length} sub-kategori` : "Tanpa sub-kategori"}</p>
                </div>
              </button>
              <div className="flex flex-wrap gap-1.5 border-t border-line bg-canvas/60 p-3">
                {subs.map((s) => (
                  <button key={s.id} onClick={() => setEdit({ category: s })} className="chip bg-white text-ink-soft shadow-card">
                    <CornerDownRight className="h-3.5 w-3.5" style={{ color: r.color }} /> {s.name}
                  </button>
                ))}
                <button onClick={() => setEdit({ parent: r })} className="chip border border-dashed border-ink-mute/40 text-ink-mute">
                  <Plus className="h-3.5 w-3.5" /> Sub
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Sheet open={!!edit} onClose={() => setEdit(null)}
        title={edit?.category ? "Ubah kategori" : edit?.parent ? `Sub-kategori ${edit.parent.name}` : "Kategori baru"}>
        {edit && <CategoryForm key={edit.category?.id || edit.parent?.id || "new"} {...edit} kind={kind} roots={roots} onDone={() => setEdit(null)} />}
      </Sheet>
    </div>
  );
}

function CategoryForm({ category, parent, kind, roots, onDone }) {
  const { supabase, user, notify, refresh } = useApp();
  const [name, setName] = useState(category?.name || "");
  const [icon, setIcon] = useState(category?.icon || parent?.icon || "circle");
  const [color, setColor] = useState(category?.color || parent?.color || CATEGORY_COLORS[0]);
  const [parentId, setParentId] = useState(category ? category.parent_id || "" : parent?.id || "");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const payload = { name: name.trim(), icon, color, parent_id: parentId || null, kind: category?.kind || kind };
    const { error } = category
      ? await supabase.from("categories").update(payload).eq("id", category.id)
      : await supabase.from("categories").insert({ ...payload, owner_id: user.id, sort_order: 50 });
    setBusy(false);
    if (error) return notify(error.message, "err");
    notify("Kategori disimpan"); refresh(); onDone();
  }
  async function remove() {
    const { error } = await supabase.from("categories").delete().eq("id", category.id);
    if (error) return notify(error.message, "err");
    notify("Kategori dihapus"); refresh(); onDone();
  }

  const preview = { icon, color };
  const parentOptions = roots.filter((r) => r.id !== category?.id);

  return (
    <div className="space-y-5 pb-3">
      <div className="flex items-center gap-3">
        <CategoryIcon category={preview} size={56} />
        <input autoFocus className="field" placeholder="Nama kategori" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <span className="label">Induk</span>
        <select className="field" value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">— Kategori utama —</option>
          {parentOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      <div>
        <span className="label">Warna</span>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className="grid h-8 w-8 place-items-center rounded-full"
              style={{ background: c, boxShadow: color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : undefined }}>
              {color === c && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">Ikon</span>
        <div className="grid grid-cols-7 gap-1.5">
          {Object.entries(CATEGORY_ICONS).map(([k, Icon]) => (
            <button key={k} type="button" onClick={() => setIcon(k)}
              className={`grid aspect-square place-items-center rounded-xl transition ${icon === k ? "text-white" : "bg-canvas text-ink-soft"}`}
              style={icon === k ? { background: color } : undefined}>
              <Icon className="h-[18px] w-[18px]" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {category && (confirm
          ? <button className="btn-danger" onClick={remove}>Hapus?</button>
          : <button className="btn-danger px-4" onClick={() => setConfirm(true)} aria-label="Hapus"><Trash2 className="h-5 w-5" /></button>)}
        <button className="btn-primary flex-1" disabled={busy || !name.trim()} onClick={save}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Simpan"}
        </button>
      </div>
      {category && !category.parent_id && <p className="text-[12px] text-ink-mute">Menghapus kategori utama juga menghapus sub-kategorinya. Transaksi lama tetap ada tanpa kategori.</p>}
    </div>
  );
}
