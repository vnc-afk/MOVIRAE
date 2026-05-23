export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    try {
      const parsed = text ? JSON.parse(text) : null;
      throw new Error(parsed?.error || res.statusText || text || "Network error");
    } catch (e) {
      throw new Error(text || res.statusText || "Network error");
    }
  }
  return (text ? JSON.parse(text) : null) as T;
}

export async function apiPost<T>(url: string, body?: any, opId?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opId) headers["x-op-id"] = opId;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    try {
      const parsed = text ? JSON.parse(text) : null;
      throw new Error(parsed?.error || res.statusText || text || "Network error");
    } catch (e) {
      throw new Error(text || res.statusText || "Network error");
    }
  }

  return (text ? JSON.parse(text) : null) as T;
}

export async function apiPut<T>(url: string, body?: any, opId?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opId) headers["x-op-id"] = opId;

  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    try {
      const parsed = text ? JSON.parse(text) : null;
      throw new Error(parsed?.error || res.statusText || text || "Network error");
    } catch (e) {
      throw new Error(text || res.statusText || "Network error");
    }
  }

  return (text ? JSON.parse(text) : null) as T;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "DELETE" });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    try {
      const parsed = text ? JSON.parse(text) : null;
      throw new Error(parsed?.error || res.statusText || text || "Network error");
    } catch (e) {
      throw new Error(text || res.statusText || "Network error");
    }
  }
  return (text ? JSON.parse(text) : null) as T;
}

export default {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
};
