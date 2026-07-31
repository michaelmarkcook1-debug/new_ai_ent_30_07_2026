// Lightweight basic auth for the whole demo (Section 9 of the spec).
// Credentials come from DEMO_USER / DEMO_PASS.
// If either is unset the gate is open, which keeps local dev friction-free.
//
// This file deliberately imports nothing.
//
// Importing NextResponse from next/server pulls 97 modules into the middleware
// bundle, among them Next's ncc-compiled @opentelemetry/api, which runs
// `__nccwpck_require__.ab = __dirname + "/"` at module scope. The guard tests
// __nccwpck_require__ rather than __dirname, so on Edge, where __dirname does
// not exist, it throws ReferenceError and every request 500s with
// MIDDLEWARE_INVOCATION_FAILED. A local production build strips that path and
// looks clean, which is what made this hard to see; Vercel enables tracing in
// its production builds and the path survives.
//
// Moving to the Node runtime avoids __dirname but hits a different wall: Next
// 15.5 emits the Node middleware as ESM while nothing in the function bundle
// declares "type": "module", so Node loads it as CJS and exits 1 on the first
// import statement.
//
// Web-standard Request and Response are enough to check a header, and they
// keep the module graph at one file, so neither failure applies.

const REALM = 'Basic realm="AI Enterprise demo"';

// What NextResponse.next() puts on the wire, without importing it. Returning
// undefined is not the same thing: the request falls through to no route at
// all and every path answers 404. Verified against Next's own source at
// node_modules/next/dist/esm/server/web/spec-extension/response.js, where
// next() is `new NextResponse(null, {headers: {'x-middleware-next': '1'}})`.
const CONTINUE = () =>
  new Response(null, { headers: { "x-middleware-next": "1" } });

export function middleware(request: Request): Response {
  const user = process.env.DEMO_USER;
  const pass = process.env.DEMO_PASS;
  if (!user || !pass) return CONTINUE();

  const expected = btoa(`${user}:${pass}`);
  const header = request.headers.get("authorization");

  // The browser replays the Authorization header on every same-origin request
  // once the handshake is done, fetch() included, so there is nothing to carry
  // in a cookie.
  if (header?.startsWith("Basic ") && header.slice(6) === expected) {
    return CONTINUE();
  }

  return new Response("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": REALM },
  });
}

export const config = {
  // Everything except Next.js internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
