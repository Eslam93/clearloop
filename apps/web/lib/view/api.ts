// The browser's API client. Every call names the acting persona; the tenant comes from the cookie.

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; persona: string; idempotencyKey?: string },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        "x-clearloop-as": options.persona,
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiClientError(0, "network", "Network error");
  }
  const data = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string; details?: unknown } }
    | null;
  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      data?.error?.code ?? "internal",
      data?.error?.message ?? `HTTP ${response.status}`,
      data?.error?.details,
    );
  }
  return data as T;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
