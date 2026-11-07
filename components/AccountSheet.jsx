"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Archive, Trash2, Upload, X, Search } from "lucide-react";
import { useApp } from "@/lib/app-data";
import { ACCOUNT_COLORS, ACCOUNT_KINDS, INSTRUMENTS } from "@/lib/constants";
import { amountToInput, parseAmount } from "@/lib/format";
import { Sheet, Switch, BrandTile, Segmented } from "./ui";
import { BRANDS, BRAND_GROUPS } from "@/lib/brands";
import { BankCard } from "./BankCard";
import AmountInput, { GramInput, parseGram, gramToInput } from "./AmountInput";

export default function AccountSheet() {
  const { accountSheet, closeAccount, t } = useApp();
  return (
    <Sheet open={!!accountSheet} onClose={closeAccount} title={accountSheet?.account ? t("Ubah akun") : t("Akun baru")} full>
      {accountSheet && <AccountForm key={accountSheet.account?.id || "new"} account={accountSheet.account} />}
    </Sheet>
  );
}

function AccountForm({ account }) {
  const router = useRouter();
  const { supabase, user, closeAccount, notify, refresh, t } = useApp();
  const [name, setName] = useState(account?.name || "");
  const [kind, setKind] = useState(account?.kind || "bank");
  const [color, setColor] = useState(account?.color || ACCOUNT_COLORS[0]);
  const [initial, setInitial] = useState(account ? amountToInput(Math.abs(account.initial_balance)) : "");
  const [negative, setNegative] = useState(account ? account.initial_balance < 0 : false);
  const [instrument, setInstrument] = useState(account?.instrument || "");
  const [unit, setUnit] = useState(account?.unit || "money");
  const [initialQty, setInitialQty] = useState(gramToInput(account?.initial_qty));
  const [unitPrice, setUnitPrice] = useState(account?.unit_price ? amountToInput(account.unit_price) : "");
  const [limit, setLimit] = useState(account?.credit_limit ? amountToInput(account.credit_limit) : "");
  const [dueDay, setDueDay] = useState(account?.due_day || "");
  const [include, setInclude] = useState(account ? account.include_in_totals !== false : true);
  const [goal, setGoal] = useState(account?.goal_amount ? amountToInput(account.goal_amount) : "");
  const [goalDate, setGoalDate] = useState(account?.goal_date || "");
  const [icon, setIcon] = useState(account?.icon || "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [brandGroup, setBrandGroup] = useState("bank");
  const [brandQuery, setBrandQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const isCredit = kind === "credit";
  const isInvest = kind === "investment";
  const gram = isInvest && instrument === "gold" && unit === "gram";

  function pickBrand(b) {
    setIcon(`brand:${b.id}`);
    setColor(b.color);
    const g = BRAND_GROUPS.find((x) => x.id === b.group);
    if (g && kind !== "credit" && kind !== "cash") setKind(g.kind);
    if (!name.trim()) setName(b.name);
    setPickerOpen(false);
  }

  async function onUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return notify(t("Pilih file gambar"), "err");
    setUploading(true);
    try {
      const bmp = await createImageBitmap(file);
      const side = Math.min(bmp.width, bmp.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 160;
      canvas.getContext("2d").drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 160, 160);
      const blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Gagal memproses gambar"))), "image/png"));
      const path = `${user.id}/${Date.now()}.png`;
      const { error } = await supabase.storage.from("account-icons").upload(path, blob, { contentType: "image/png", cacheControl: "31536000" });
      if (error) throw error;
      setIcon(supabase.storage.from("account-icons").getPublicUrl(path).data.publicUrl);
      setPickerOpen(false);
    } catch (err) {
      notify(err.message || t("Gagal mengunggah foto"), "err");
    } finally { setUploading(false); }
  }

  const shownBrands = BRANDS.filter((b) => (brandQuery.trim() ? b.name.toLowerCase().includes(brandQuery.trim().toLowerCase()) : b.group === brandGroup));
  // Emas dalam gram: saldo awal Rupiah (modal) = gram awal × harga per gram
  const initialValue = gram ? Math.round(parseGram(initialQty) * parseAmount(unitPrice)) : parseAmount(initial) * (negative || isCredit ? -1 : 1);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const payload = {
      name: name.trim(), kind, color, icon: icon || null,
      initial_balance: initialValue,
      credit_limit: isCredit ? parseAmount(limit) || null : null,
      due_day: isCredit && dueDay ? Number(dueDay) : null,
      include_in_totals: include,
      goal_amount: !isCredit && parseAmount(goal) > 0 ? parseAmount(goal) : null,
      goal_date: !isCredit && parseAmount(goal) > 0 && goalDate ? goalDate : null,
      // Kolom instrumen (migrasi 010) hanya dikirim bila dipakai, supaya akun lain tetap bisa disimpan sebelum migrasi
      ...(isInvest || account?.instrument ? {
        instrument: isInvest ? instrument || null : null,
        unit: gram ? "gram" : "money",
        unit_price: gram && parseAmount(unitPrice) > 0 ? parseAmount(unitPrice) : null,
        initial_qty: gram ? parseGram(initialQty) : 0,
      } : {}),
    };
    const { error } = account
      ? await supabase.from("accounts").update(payload).eq("id", account.id)
      : await supabase.from("accounts").insert({ ...payload, owner_id: user.id });
    setBusy(false);
    if (error) {
      const missing = /instrument|unit_price|initial_qty|column/i.test(error.message);
      return notify(missing ? t("Jalankan migrasi database 010 dulu untuk menyimpan instrumen investasi.") : error.message, "err");
    }
    notify(account ? t("Akun diperbarui") : t("Akun dibuat"));
    refresh();
    closeAccount();
  }

  async function archive() {
    await supabase.from("accounts").update({ archived: !account.archived }).eq("id", account.id);
    notify(account.archived ? t("Akun dipulihkan") : t("Akun diarsipkan"));
    refresh(); closeAccount(); router.push("/dompet");
  }

  async function remove() {
    const { error } = await supabase.from("accounts").delete().eq("id", account.id);
    if (error) {
      setConfirm(false);
      return notify(error.message.includes("ACCOUNT_HAS_SHARED_TRANSFERS")
        ? t("Akun ini punya transfer dengan akun pasangan, jadi tidak bisa dihapus. Arsipkan saja.")
        : error.message, "err");
    }
    notify(t("Akun dihapus"));
    refresh(); closeAccount(); router.push("/dompet");
  }

  const preview = { name: name || t("Nama akun"), kind, color, icon, balance: initialValue, instrument, unit: gram ? "gram" : "money", qty_balance: parseGram(initialQty), unit_price: parseAmount(unitPrice), credit_limit: parseAmount(limit), my_role: "owner", owner_id: user?.id, member_count: account?.member_count || 0 };

  return (
    <div className="space-y-6 pb-6">
      <div className="pointer-events-none mx-auto max-w-[340px]"><BankCard account={preview} /></div>

      <div>
        <label htmlFor="wl-name" className="label">{t("Nama akun")}</label>
        {/* Bukan kolom login: cegah iOS/password manager menawarkan isi otomatis (memicu Face ID) */}
        <input id="wl-name" name="wallet-label" type="text" autoComplete="off" autoCapitalize="words" data-1p-ignore data-lpignore="true" data-form-type="other"
          className="field" placeholder={t("mis. BCA, Gopay, Dompet harian, Dana darurat")} value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <p className="label">{t("Jenis")}</p>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(ACCOUNT_KINDS).map(([k, v]) => {
            const Icon = v.icon;
            const active = kind === k;
            return (
              <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={active}
                className={`flex flex-col items-center gap-1 rounded-control border px-2 py-3 text-[14px] font-medium transition ${active ? "border-brand-600 bg-brand-50 text-brand-600 ring-1 ring-brand-600" : "border-line text-ink-soft"}`}>
                <Icon className="h-5 w-5" /> <span className="text-center leading-tight">{t(v.label.split(" /")[0])}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isInvest && (
        <div>
          <p className="label">{t("Instrumen")}</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(INSTRUMENTS).map(([k, v]) => {
              const Icon = v.icon;
              const active = instrument === k;
              return (
                <button key={k} type="button" aria-pressed={active} onClick={() => setInstrument(active ? "" : k)}
                  className={`chip h-10 border ${active ? "border-brand-600 bg-brand-600 text-white" : "border-transparent bg-fill text-ink"}`}>
                  <Icon className="h-4 w-4" /> {t(v.label)}
                </button>
              );
            })}
          </div>
          {instrument === "gold" && (
            <div className="mt-3">
              <p className="mb-1.5 text-[13px] text-ink-soft">{t("Catat emas dalam")}</p>
              <Segmented value={unit} onChange={setUnit} className="w-full"
                options={[{ value: "money", label: t("Rupiah") }, { value: "gram", label: t("Gram") }]} />
              {unit === "gram" && <p className="mt-2 text-[13px] leading-snug text-ink-soft">{t("Saat setor atau beli, isi juga berapa gram yang didapat. Nilai akun = total gram × harga per gram di bawah.")}</p>}
            </div>
          )}
        </div>
      )}

      <div>
        <p className="label">{t("Warna kartu")}</p>
        <div className="flex flex-wrap gap-2.5">
          {ACCOUNT_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c}
              className="grid h-10 w-10 place-items-center rounded-full"
              style={{ background: c, outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}>
              {color === c && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="label">{t("Ikon")} <span className="font-normal normal-case tracking-normal">({t("opsional")})</span></p>
        <div className="flex items-center gap-3">
          {icon ? <BrandTile icon={icon} size={48} /> : <span className="grid h-12 w-12 place-items-center rounded-[13px] bg-fill text-[13px] text-ink-mute">{t("Bawaan")}</span>}
          <button type="button" className="btn-ghost h-11 flex-1 px-3 text-[15px]" onClick={() => setPickerOpen((o) => !o)} aria-expanded={pickerOpen}>{t("Pilih merek")}</button>
          <button type="button" className="btn-ghost h-11 flex-1 px-3 text-[15px]" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {t("Unggah")}
          </button>
          {icon && <button type="button" className="icon-btn" onClick={() => setIcon("")} aria-label={t("Hapus ikon")}><X className="h-4 w-4" /></button>}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
        </div>
        {pickerOpen && (
          <div className="mt-3 rounded-card bg-raised p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
              <input className="field h-10 pl-9 text-[16px]" placeholder={t("Cari merek")} aria-label={t("Cari merek")} value={brandQuery} onChange={(e) => setBrandQuery(e.target.value)} />
            </div>
            {!brandQuery.trim() && (
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-control bg-fill p-1" role="tablist">
                {BRAND_GROUPS.map((g) => (
                  <button key={g.id} type="button" role="tab" aria-selected={brandGroup === g.id} onClick={() => setBrandGroup(g.id)}
                    className={`rounded-[9px] py-1.5 text-[14px] font-medium ${brandGroup === g.id ? "bg-seg text-ink shadow-seg" : "text-ink-soft"}`}>{t(g.label)}</button>
                ))}
              </div>
            )}
            <div className="mt-3 grid grid-cols-4 gap-3">
              {shownBrands.map((b) => (
                <button key={b.id} type="button" onClick={() => pickBrand(b)} className="flex flex-col items-center gap-1.5 active:scale-95">
                  <BrandTile icon={`brand:${b.id}`} size={52} className={icon === `brand:${b.id}` ? "ring-2 ring-brand-600 ring-offset-2 ring-offset-raised" : ""} />
                  <span className="w-full truncate text-center text-[12px] text-ink-soft">{b.name}</span>
                </button>
              ))}
              {shownBrands.length === 0 && <p className="col-span-4 py-3 text-center text-[14px] text-ink-soft">{t("Tidak ketemu. Pakai Unggah untuk logo sendiri.")}</p>}
            </div>
            <p className="mt-3 text-[12px] leading-snug text-ink-mute">{t("Badge merek bukan logo resmi. Untuk logo asli, gunakan Unggah.")}</p>
          </div>
        )}
      </div>

      {gram ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor="wl-qty" className="label">{t("Saldo awal (gram)")}</label>
            <GramInput id="wl-qty" value={initialQty} onChange={setInitialQty} />
          </div>
          <div className="min-w-0">
            <label htmlFor="wl-price" className="label">{t("Harga per gram")}</label>
            <AmountInput id="wl-price" value={unitPrice} onChange={setUnitPrice} />
          </div>
          <p className="col-span-2 -mt-1 pl-1 text-[13px] text-ink-soft">{t("Perbarui harga per gram kapan saja supaya nilai emasmu mengikuti harga terkini.")}</p>
        </div>
      ) : (
      <div>
        <label htmlFor="wl-initial" className="label">{isCredit ? t("Tagihan saat ini") : t("Saldo awal")}</label>
        <div className="flex gap-2">
          {!isCredit && (
            <button type="button" onClick={() => setNegative((n) => !n)} aria-label={negative ? t("Saldo minus") : t("Saldo plus")}
              className={`h-12 w-12 shrink-0 rounded-control border text-lg font-semibold ${negative ? "border-expense bg-expense-soft text-expense" : "border-control text-ink-soft"}`}>
              {negative ? "−" : "+"}
            </button>
          )}
          <AmountInput id="wl-initial" value={initial} onChange={setInitial} className="flex-1" />
        </div>
      </div>
      )}
      {isCredit && (
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
          <div>
            <label htmlFor="wl-limit" className="label">{t("Limit kartu")}</label>
            <AmountInput id="wl-limit" value={limit} onChange={setLimit} />
          </div>
          <div>
            <label htmlFor="wl-due" className="label">{t("Jatuh tempo")}</label>
            <select id="wl-due" className="field px-3" value={dueDay} onChange={(e) => setDueDay(e.target.value)}>
              <option value="">—</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{t("Tgl {d}", { d })}</option>)}
            </select>
          </div>
        </div>
      )}
      {isCredit && <p className="-mt-3 pl-1 text-[14px] text-ink-soft">{t("Selama masih ada tagihan, kartu ini muncul di \"Tagihan bulan ini\" di Beranda dengan tombol Bayar.")}</p>}

      <Switch id="wl-include" checked={include} onChange={setInclude} label={t("Masuk hitungan")}
        description={t("Kalau dimatikan, transaksi akun ini tidak dihitung di grafik pemasukan/pengeluaran dan anggaran, tetapi saldonya tetap masuk total aset. Cocok untuk dana darurat, titipan, atau rekening usaha.")} />

      {!isCredit && (
        <div className="rounded-card bg-raised p-4">
          <p className="text-[16px] font-medium">{t("Target tabungan")} <span className="font-normal text-ink-soft">({t("opsional")})</span></p>
          <p className="mt-1 text-[14px] text-ink-soft">{t("Isi kalau akun ini untuk menabung, mis. dana darurat, liburan, atau DP rumah.")}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="wl-goal" className="mb-1 block text-[13px] text-ink-soft">{t("Target")}</label>
              <AmountInput id="wl-goal" value={goal} onChange={setGoal} />
            </div>
            <div className="min-w-0">
              <label htmlFor="wl-goal-date" className="mb-1 block text-[13px] text-ink-soft">{t("Tanggal target")}</label>
              {/* iOS memberi input tanggal lebar minimum sendiri; appearance-none + min-w-0 menjaganya di dalam kotak */}
              <input id="wl-goal-date" type="date" className="field block min-w-0 max-w-full appearance-none px-3 text-left" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      <button className="btn-primary w-full" onClick={save} disabled={busy || !name.trim()}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : account ? t("Simpan perubahan") : t("Buat akun")}
      </button>

      {account && (
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={archive}><Archive className="h-4 w-4" /> {account.archived ? t("Pulihkan") : t("Arsipkan")}</button>
          {confirm
            ? <button className="btn-danger flex-1" onClick={remove}>{t("Hapus + semua transaksi?")}</button>
            : <button className="btn-danger flex-1" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" /> {t("Hapus")}</button>}
        </div>
      )}
    </div>
  );
}
