import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login"];
// Cookie sesi Supabase: sb-<ref>-auth-token (atau dipecah: .0, .1, ...)
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

// Hanya memeriksa ada/tidaknya cookie sesi, tanpa panggilan jaringan ke Supabase Auth
// (sebelumnya getUser() di tiap perpindahan halaman, termasuk prefetch). Keamanan data tetap
// dijaga RLS di database; sesi yang kedaluwarsa ditangani di sisi client (lib/app-data.jsx).
export function middleware(request) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p)) || path.startsWith("/auth");
  if (isPublic) return NextResponse.next();
  const hasSession = request.cookies.getAll().some((c) => AUTH_COOKIE.test(c.name));
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons|manifest.webmanifest|favicon.ico|.*\\.(?:png|svg|ico)$).*)"],
};
