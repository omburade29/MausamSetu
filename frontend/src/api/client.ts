import type { BlockForecast, DownscaleRun, HistoryItem, RegionsFile, Selection } from "@/types"

async function parseError(response: Response) {
  const body = await response.json().catch(() => ({}))
  if (typeof body.detail === "string") return body.detail
  if (Array.isArray(body.detail)) {
    return body.detail
      .map((item: { msg?: string; loc?: string[] }) => item.msg || "Invalid input")
      .join(" ")
  }
  return response.statusText || "Request failed"
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<T>
}

export async function getHealth() {
  const body = await request<{ status: string; service?: string }>("/api/health")
  if (body.service !== "MausamSetu") {
    throw new Error("The service on /api/health is not MausamSetu.")
  }
  return body
}

export function getRegions() {
  return request<RegionsFile>("/api/regions")
}

export function getBlockForecast(blockId: string, date?: string) {
  const params = new URLSearchParams({ block_id: blockId })
  if (date) params.set("date", date)
  return request<BlockForecast>(`/api/block-forecast?${params.toString()}`)
}

export function getPanchayats(blockId: string) {
  return request<{
    features: Array<{ properties: Record<string, unknown>; geometry: BlockForecast["geometry"] }>
    block: { geometry: BlockForecast["geometry"] }
  }>(`/api/panchayats/${blockId}`)
}

export async function postDownscale(selection: Selection) {
  const body = await request<DownscaleRun>("/api/downscale", {
    method: "POST",
    body: JSON.stringify({
      state_id: selection.stateId,
      district_id: selection.districtId,
      block_id: selection.blockId,
      date: selection.date,
      variable: selection.variable,
      model: selection.model,
      predictors: selection.predictors,
    }),
  })
  if (!body?.run_id || !Array.isArray(body.panchayat_forecasts)) {
    throw new Error("Downscale response did not include Panchayat forecasts.")
  }
  return body
}

export function getRun(runId: string) {
  return request<DownscaleRun>(`/api/downscale/${runId}`)
}

export function getHistory() {
  return request<{ runs: HistoryItem[] }>("/api/history")
}

export function deleteHistory() {
  return request<{ deleted: number; status: string }>("/api/history", { method: "DELETE" })
}

const LOCAL_KEY = "mausamsetu.localHistory"

export function readLocalHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as HistoryItem[]) : []
  } catch {
    return []
  }
}

export function readLocalRuns(): DownscaleRun[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_KEY}.runs`)
    return raw ? (JSON.parse(raw) as DownscaleRun[]) : []
  } catch {
    return []
  }
}

export function saveLocalRun(run: DownscaleRun) {
  const runs = [run, ...readLocalRuns()].slice(0, 40)
  const items: HistoryItem[] = runs.map((item) => ({
    run_id: item.run_id,
    created_at: item.created_at,
    state_name: item.geography.state_name,
    district_name: item.geography.district_name,
    block_name: item.geography.block_name,
    block_id: item.geography.block_id,
    variable: item.variable,
    model: item.model,
    panchayat_count: item.panchayat_forecasts.length,
    validation_status:
      item.validation_metrics.improvement_percent == null
        ? "Reference unavailable"
        : item.validation_metrics.improvement_percent > 0
          ? "Lower error than baseline on this sample"
          : item.validation_metrics.improvement_percent < 0
            ? "Higher error than baseline on this sample"
            : "Same error as baseline on this sample",
    source: "demo_simulation",
    is_simulated: true,
  }))
  localStorage.setItem(LOCAL_KEY, JSON.stringify(items))
  localStorage.setItem(`${LOCAL_KEY}.runs`, JSON.stringify(runs))
}

export function clearLocalHistory() {
  localStorage.removeItem(LOCAL_KEY)
  localStorage.removeItem(`${LOCAL_KEY}.runs`)
}
