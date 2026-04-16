const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3030/api/v1";

// Backend origin (no /api/v1 suffix) — for static assets served by the backend
// (e.g. /uploads/logos/<hash>.png). Computed by stripping the trailing /api/vN path.
export const BACKEND_ORIGIN = API_URL.replace(/\/api\/v\d+\/?$/, "");

export function uploadUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  // Accepts either "/uploads/foo.png" or "uploads/foo.png" or absolute URLs.
  if (/^https?:\/\//.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BACKEND_ORIGIN}${normalized}`;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || "Request failed");
  }

  return res;
}

export async function apiJson<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await apiFetch(path, options);
  return res.json();
}
