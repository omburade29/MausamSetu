import type { Advisory, ComparePayload, Crop, Envelope, Forecast, MapFeatureCollection, ModelRun, Place, User } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function requestList<T>(path: string): Promise<Envelope<T[]>> {
  const separator = path.includes("?") ? "&" : "?";
  const first = await request<Envelope<T[]>>(`${path}${separator}page=1&page_size=200`);
  const total = first.meta?.total ?? first.data.length;
  const rows = [...first.data];
  const size = first.meta?.page_size || rows.length || 1000;
  for (let page = 2; rows.length < total; page += 1) {
    const next = await request<Envelope<T[]>>(`${path}${separator}page=${page}&page_size=${size}`);
    if (!next.data.length) break;
    rows.push(...next.data);
  }
  return { ...first, data: rows, meta: { page: 1, page_size: rows.length, total } };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isForm && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body?.error?.message || response.statusText;
    throw new ApiError(response.status, message);
  }
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json") || type.includes("geo+json")) return response.json();
  return response as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<Envelope<{ access_token: string; user: User }>>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (payload: object) =>
    request<Envelope<{ access_token: string; user: User }>>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: () => request<Envelope<User>>("/api/auth/me"),
  states: () => requestList<Place>("/api/states"),
  districts: (stateId: number) => requestList<Place>(`/api/districts?state_id=${stateId}`),
  blocks: (districtId: number) => requestList<Place>(`/api/blocks?district_id=${districtId}`),
  panchayats: (blockId?: number) =>
    requestList<Place>(`/api/panchayats${blockId ? `?block_id=${blockId}` : ""}`),
  panchayat: (id: number) => request<Envelope<Place>>(`/api/panchayats/${id}`),
  panchayatForecast: (id: number) => request<Envelope<Forecast[]>>(`/api/forecasts/panchayat/${id}`),
  compare: (id: number, on?: string) =>
    request<Envelope<ComparePayload>>(`/api/forecasts/compare/${id}${on ? `?on=${on}` : ""}`),
  map: (params: { on?: string; variable: string; layer: string; block_id?: number }) => {
    const query = new URLSearchParams();
    if (params.on) query.set("on", params.on);
    query.set("variable", params.variable);
    query.set("layer", params.layer);
    if (params.block_id) query.set("block_id", String(params.block_id));
    return request<Envelope<MapFeatureCollection>>(`/api/forecasts/map?${query.toString()}`);
  },
  advisories: (panchayatId?: number) =>
    request<Envelope<Advisory[]>>(`/api/advisories${panchayatId ? `?panchayat_id=${panchayatId}&page_size=100` : "?page_size=100"}`),
  crops: () => request<Envelope<Crop[]>>("/api/advisories/crops"),
  generateAdvisory: (payload: object) =>
    request<Envelope<Advisory[]>>("/api/advisories/generate", { method: "POST", body: JSON.stringify(payload) }),
  reviewAdvisory: (id: number, decision: "approve" | "reject", notes: string) =>
    request<Envelope<Advisory>>(`/api/advisories/${id}/review`, {
      method: "PUT",
      body: JSON.stringify({ decision, notes }),
    }),
  publishAdvisory: (id: number) => request<Envelope<Advisory>>(`/api/advisories/${id}/publish`, { method: "POST" }),
  models: () => request<Envelope<ModelRun[]>>("/api/models"),
  train: () => request<Envelope<{ model_version: string; statements: Record<string, string> }>>("/api/models/train", { method: "POST" }),
  generateForecasts: () => request<Envelope<{ stored: number }>>("/api/forecasts/generate", { method: "POST" }),
  jobs: () => request<Envelope<{ id: number; job_type: string; status: string; message: string; errors: { row: number | string; column: string; message: string }[]; preview: object[] }[]>>("/api/data/jobs"),
  upload: (path: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<Envelope<{ id: number; message: string; errors: { message: string }[]; preview: object[] }>>(path, {
      method: "POST",
      body,
    });
  },
  template: (name: string) => request<Envelope<{ csv: string }>>(`/api/data/templates/${name}`),
  features: () => request<Envelope<{ message: string }>>("/api/data/features/generate", { method: "POST" }),
  status: () => request<Envelope<Record<string, unknown>>>("/api/system/status"),
  download: async (path: string, filename: string) => {
    const headers = new Headers();
    const token = localStorage.getItem("token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${BASE}${path}`, { headers });
    if (!response.ok) throw new ApiError(response.status, "Download failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },
};
