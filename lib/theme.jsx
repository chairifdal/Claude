"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

/** Tampilan: "system" (ikut HP), "light", atau "dark". Disimpan per perangkat. */
const Ctx = createContext({ pref: "system", setPref: () => {}, isDark: false });

const META = { light: "#F2F2F7", dark: "#000000" };

function apply(pref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? META.dark : META.light));
  return dark;
}

export function ThemeProvider({ children }) {
  const [pref, setPrefState] = useState("system");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    let saved = "system";
    try { saved = localStorage.getItem("kk-theme") || "system"; } catch {}
    setPrefState(saved);
    setIsDark(apply(saved));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setIsDark(apply(pref));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const setPref = useCallback((p) => {
    setPrefState(p);
    try { localStorage.setItem("kk-theme", p); } catch {}
    setIsDark(apply(p));
  }, []);

  return <Ctx.Provider value={{ pref, setPref, isDark }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

/** Warna grafik per tema (Recharts tidak membaca CSS variable). */
export function chartColors(isDark) {
  return isDark
    ? { grid: "#38383A", tick: "#98989F", axis: "#48484A", cursor: "rgba(118,118,128,.24)", accent: "#22D3EE", soft: "#164E63", ref: "#98989F", tipBg: "#2C2C2E", tipBorder: "#38383A", future: "#2C2C2E" }
    : { grid: "#E5E5EA", tick: "#6C6C70", axis: "#D1D1D6", cursor: "#F2F2F7", accent: "#06B6D4", soft: "#A5F3FC", ref: "#6C6C70", tipBg: "#FFFFFF", tipBorder: "#E5E5EA", future: "#EFEFF4" };
}

