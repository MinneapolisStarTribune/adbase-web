export class ApiError extends Error {
  constructor(
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(
    path.startsWith("/api/") ? path : `/api/workspace/${path}`,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      cache: "no-store",
      signal,
    },
  );
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) window.location.reload();
    throw new ApiError(data.error || "Request failed.", data.fields);
  }
  return data as T;
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}
export function displayAmount(value: string) {
  const [whole = "0", decimal] = value.split(".");
  return (
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (decimal ? `.${decimal}` : "")
  );
}
