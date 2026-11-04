"use client";
import { useEffect, useState } from "react";
import { AppDataProvider } from "@/lib/app-data";
import AppChrome from "@/components/AppChrome";
import TransactionSheet from "@/components/TransactionSheet";
import AccountSheet from "@/components/AccountSheet";
import { Toast } from "@/components/ui";

export default function AppLayout({ children }) {
  // Semua data bergantung pada sesi & jam lokal HP → render hanya di client
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="grid min-h-[100dvh] place-items-center">
        <img src="/icons/icon.svg" alt="" className="h-16 w-16 animate-pulse rounded-2xl" />
      </div>
    );
  }
  return (
    <AppDataProvider>
      <div className="mx-auto min-h-[100dvh] max-w-md px-4 pb-36">{children}</div>
      <AppChrome />
      <TransactionSheet />
      <AccountSheet />
      <Toast />
    </AppDataProvider>
  );
}
