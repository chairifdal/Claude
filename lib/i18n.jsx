"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { EN } from "./i18n-en";

/**
 * Bahasa: teks sumber ditulis dalam Bahasa Indonesia dan sekaligus menjadi kunci.
 * t("Saldo tersedia di {n} akun lancar", { n: 5 }) → versi Inggris bila locale = "en".
 */
let currentLocale = "id";
export const getLocale = () => currentLocale;

export function translate(text, vars, locale = currentLocale) {
  let s = locale === "en" ? EN[text] ?? text : text;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

const Ctx = createContext({ locale: "id", setLocale: () => {}, t: translate });

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState("id");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kk-locale");
      if (saved === "en" || saved === "id") setLocaleState(saved);
    } catch {}
  }, []);

  currentLocale = locale;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l) => {
    setLocaleState(l);
    try { localStorage.setItem("kk-locale", l); } catch {}
  }, []);

  const value = useMemo(() => ({ locale, setLocale, t: (s, v) => translate(s, v, locale) }), [locale, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
export const useT = () => useContext(Ctx).t;
