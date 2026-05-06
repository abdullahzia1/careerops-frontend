/**
 * API base: empty string uses same origin (Vite proxy in dev).
 * Set VITE_API_ORIGIN to hit a remote or direct backend URL.
 */
export function apiUrl(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`api path must start with /, got: ${path}`);
  }
  const origin = import.meta.env.VITE_API_ORIGIN ?? "";
  return `${origin}${path}`;
}

export async function readErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    if (typeof j.error === "string") return j.error;
  } catch {
    /* ignore */
  }
  return res.statusText || `HTTP ${res.status}`;
}
