// Client-side access to BoardRadar data, always via our own proxy route
// (/api/br/*). The proxy injects the key server-side; the browser never
// sees it. The x-eai-source header tells the UI whether it is looking at
// live data or a recorded fixture ("Cached sample" badge).

export type BrSource = "live" | "mock" | "error";

export interface BrResult<T> {
  ok: boolean;
  source: BrSource;
  status: number;
  data: T | null;
  errorCode?: string;
  errorMessage?: string;
}

export async function brFetch<T>(
  path: string,
  params?: Record<string, string>
): Promise<BrResult<T>> {
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  try {
    const res = await fetch(`/api/br/${path}${qs}`);
    const source = (res.headers.get("x-eai-source") ?? "error") as BrSource;
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.success === false) {
      return {
        ok: false,
        source,
        status: res.status,
        data: null,
        errorCode: body?.code ?? String(res.status),
        errorMessage: body?.error ?? "Request failed",
      };
    }
    return { ok: true, source, status: res.status, data: body as T };
  } catch {
    return {
      ok: false,
      source: "error",
      status: 0,
      data: null,
      errorCode: "NETWORK",
      errorMessage: "Network error",
    };
  }
}
