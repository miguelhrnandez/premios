import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const ADMIN_ONLY_PREFIXES = ["/usuarios", "/reportes", "/inventario"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isLoginPage = nextUrl.pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  if (
    isLoggedIn &&
    req.auth?.user.role !== "ADMIN" &&
    ADMIN_ONLY_PREFIXES.some((p) => nextUrl.pathname.startsWith(p))
  ) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
