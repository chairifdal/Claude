"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Detail (mis. sheet) yang tercatat di riwayat browser, supaya gestur kembali / geser ke kanan
 * menutup detail itu dulu, bukan meninggalkan halaman. Kembali dari halaman lain membuka detailnya lagi.
 * Mengembalikan [nilai, buka(nilai), tutup()].
 */
export function useHistoryDetail(key = "__detail") {
  const [value, setValue] = useState(null);

  useEffect(() => {
    const read = () => window.history.state?.[key] ?? null;
    setValue(read());
    const onPop = () => setValue(read());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [key]);

  const open = useCallback((v) => {
    const st = window.history.state || {};
    // Status internal Next.js ikut disalin supaya router tetap mengenali entri ini
    if (st[key]) window.history.replaceState({ ...st, [key]: v }, "");
    else window.history.pushState({ ...st, [key]: v }, "");
    setValue(v);
  }, [key]);

  const close = useCallback(() => {
    if (window.history.state?.[key]) window.history.back();
    setValue(null);
  }, [key]);

  return [value, open, close];
}
