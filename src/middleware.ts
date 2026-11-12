import createIntlMiddleware from "next-intl/middleware";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);
const PROTECTED = ["/dashboard", "/account", "/agent", "/admin", "/notifications"];

export default async function middleware(request: NextRequest) {
  const response = intl(request);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return response; // demo mode (no database yet)

  // Refresh the Supabase session cookie on every request
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();

  const m = request.nextUrl.pathname.match(/^\/(en|ar)(\/.*)?$/);
  const locale = m?.[1] ?? "en";
  const rest = m?.[2] ?? "/";
  if (!user && PROTECTED.some((p) => rest === p || rest.startsWith(p + "/"))) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }
  return response;
}

export const config = { matcher: ["/((?!api|auth|_next|icon|apple-icon|opengraph-image|twitter-image|.*\\..*).*)"] };
