import { NextRequest, NextResponse } from "next/server";

// Lightweight basic auth for the whole demo (Section 9 of the spec).
// Credentials come from DEMO_USER / DEMO_PASS in .env.local.
// If either is unset the gate is open, which keeps local dev friction-free.
export function middleware(request: NextRequest) {
  const user = process.env.DEMO_USER;
  const pass = process.env.DEMO_PASS;
  if (!user || !pass) return NextResponse.next();

  const expected = btoa(`${user}:${pass}`);

  // A same-site cookie set after the first successful Basic handshake keeps
  // client-side fetch() calls authenticated (browsers do not always replay
  // Basic credentials on fetch). The cookie carries the same base64 token as
  // the Basic header itself, so it grants nothing the header did not.
  if (request.cookies.get("eai_auth")?.value === expected) {
    return NextResponse.next();
  }

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ") && header.slice(6) === expected) {
    const res = NextResponse.next();
    res.cookies.set("eai_auth", expected, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return res;
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="AI Enterprise demo"' },
  });
}

export const config = {
  // Everything except Next.js internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
