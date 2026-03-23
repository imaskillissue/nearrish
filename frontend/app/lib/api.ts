const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

let redirectingToHome = false;

function handleUnauthorized(): never {
  if (!redirectingToHome) {
    redirectingToHome = true;
    localStorage.removeItem('session_token');
    sessionStorage.setItem('session_expired', '1');
    window.location.href = '/';
  }
  throw new Error('Session expired');
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['AUTH'] = token;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      handleUnauthorized();
    }
    let message = `API error: ${res.status}`;
    try {
      const body = await res.text();
      if (body) {
        const json = JSON.parse(body);
        if (typeof json.message === 'string' && json.message) message = json.message;
        else if (typeof json.detail === 'string' && json.detail) message = json.detail;
      }
    } catch { /* JSON parse failed — keep default message */ }
    throw new Error(message);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export { API_BASE };

export async function apiUpload(path: string, formData: FormData): Promise<{ filename: string; url: string }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  const headers: Record<string, string> = {};
  if (token) headers['AUTH'] = token;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      handleUnauthorized();
    }
    throw new Error(`Upload error: ${res.status}`);
  }
  return res.json();
}
