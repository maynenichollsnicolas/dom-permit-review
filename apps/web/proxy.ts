import { NextResponse, type NextRequest } from "next/server";

// Auth is handled per-page via useUser hook.
// This proxy only passes requests through.
export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
