import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  clearLocalHistory,
  deleteHistory,
  getBlockForecast,
  getHealth,
  getHistory,
  getRun,
  postDownscale,
  readLocalRuns,
  saveLocalRun,
} from "@/api/client"
import { ALL_PREDICTORS } from "@/content/copy"
import { geographyIndex, localBlockForecast, localPanchayats, regions as localRegions } from "@/engine/demoData"
import { runLocalDownscale } from "@/engine/runLocal"
import { samePredictors } from "@/lib/format"
import type { BlockForecast, DownscaleRun, HistoryItem, PanchayatFeature, RegionsFile, Selection } from "@/types"

const SESSION_KEY = "mausamsetu.session"

interface SessionSnapshot {
  selection: Selection
  run: DownscaleRun | null
  selectedPanchayatId: string | null
}

function initialSelection(): Selection {
  return {
    stateId: "",
    districtId: "",
    blockId: "",
    date: "2026-09-28",
    variable: "rainfall_mm",
    model: "contextual_baseline",
    predictors: [...ALL_PREDICTORS],
  }
}

function readSession(): SessionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as SessionSnapshot) : null
  } catch {
    return null
  }
}

interface AppContextValue {
  backendOnline: boolean | null
  usingFallback: boolean
  fallbackNote: string | null
  regions: RegionsFile
  selection: Selection
  setSelection: (patch: Partial<Selection>) => void
  useDemoRegion: () => void
  blockForecast: BlockForecast | null
  panchayats: PanchayatFeature[]
  run: DownscaleRun | null
  selectedPanchayatId: string | null
  setSelectedPanchayatId: (id: string | null) => void
  history: HistoryItem[]
  loading: boolean
  processing: boolean
  processStep: number
  error: string | null
  clearError: () => void
  reload: () => void
  downscale: () => Promise<void>
  openRun: (runId: string) => Promise<void>
  resetDemo: () => Promise<void>
  staleRun: boolean
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const stored = readSession()
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const [usingFallback, setUsingFallback] = useState(false)
  const [fallbackNote, setFallbackNote] = useState<string | null>(null)
  const [regions, setRegions] = useState<RegionsFile>(localRegions)
  const [selection, setSelectionState] = useState<Selection>(stored?.selection ?? initialSelection())
  const [blockForecast, setBlockForecast] = useState<BlockForecast | null>(null)
  const [panchayats, setPanchayats] = useState<PanchayatFeature[]>([])
  const [run, setRun] = useState<DownscaleRun | null>(stored?.run ?? null)
  const [selectedPanchayatId, setSelectedPanchayatId] = useState<string | null>(stored?.selectedPanchayatId ?? null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [processStep, setProcessStep] = useState(-1)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const setSelection = useCallback((patch: Partial<Selection>) => {
    setSelectionState((current) => ({ ...current, ...patch }))
  }, [])

  const refreshHistory = useCallback(async (online: boolean) => {
    if (!online) {
      setHistory(
        readLocalRuns().map((item) => ({
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
        })),
      )
      return
    }
    const payload = await getHistory()
    setHistory(payload.runs)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      setLoading(true)
      setError(null)
      try {
        await getHealth()
        if (cancelled) return
        setBackendOnline(true)
        setRegions(localRegions)
        await refreshHistory(true)
      } catch {
        if (cancelled) return
        setBackendOnline(false)
        setUsingFallback(true)
        setFallbackNote("Backend unavailable. Geography and forecasts are being read from the local demo files.")
        setRegions(localRegions)
        await refreshHistory(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [refreshHistory, reloadKey])

  useEffect(() => {
    if (!selection.blockId) {
      setBlockForecast(null)
      setPanchayats([])
      return
    }
    let cancelled = false
    async function loadBlock() {
      try {
        const [forecast, features] = await Promise.all([
          getBlockForecast(selection.blockId, selection.date),
          Promise.resolve(localPanchayats(selection.blockId)),
        ])
        if (cancelled) return
        setBlockForecast(forecast)
        setPanchayats(features)
        setError(null)
      } catch {
        try {
          if (cancelled) return
          setBlockForecast(localBlockForecast(selection.blockId, selection.date))
          setPanchayats(localPanchayats(selection.blockId))
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the block forecast.")
        }
      }
    }
    void loadBlock()
    return () => {
      cancelled = true
    }
  }, [selection.blockId, selection.date, backendOnline])

  useEffect(() => {
    const snapshot: SessionSnapshot = { selection, run, selectedPanchayatId }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(snapshot))
  }, [selection, run, selectedPanchayatId])

  const useDemoRegion = useCallback(() => {
    const demo = geographyIndex()[0]
    setSelectionState((current) => ({
      ...current,
      stateId: demo.state.id,
      districtId: demo.district.id,
      blockId: demo.block.id,
      date: "2026-09-28",
      variable: "rainfall_mm",
    }))
    setError(null)
  }, [])

  const downscale = useCallback(async () => {
    if (!selection.stateId || !selection.districtId || !selection.blockId) {
      setError("Choose a state, district, and block before downscaling.")
      return
    }
    if (!selection.date) {
      setError("Choose a forecast date.")
      return
    }
    setProcessing(true)
    setProcessStep(0)
    setError(null)
    let step = 0
    const timer = window.setInterval(() => {
      step += 1
      if (step <= 4) setProcessStep(step)
    }, 560)
    const started = Date.now()
    const waitForAnimation = async () => {
      const remaining = 2900 - (Date.now() - started)
      if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining))
    }
    try {
      let next: DownscaleRun
      let note: string | null = null
      try {
        next = await postDownscale(selection)
        setBackendOnline(true)
        setUsingFallback(false)
      } catch (err) {
        const reason =
          selection.model === "random_forest"
            ? "Backend unavailable, so the Random Forest prototype could not be trained. Showing the Contextual Baseline local fallback instead."
            : `Backend unavailable. Showing the local deterministic demo. ${err instanceof Error ? err.message : ""}`.trim()
        next = runLocalDownscale(selection, { fallbackNote: reason })
        saveLocalRun(next)
        note = reason
        setBackendOnline(false)
        setUsingFallback(true)
      }
      await waitForAnimation()
      setRun(next)
      setFallbackNote(note)
      const ranked = [...next.panchayat_forecasts].sort(
        (a, b) => b.forecasts[selection.variable] - a.forecasts[selection.variable],
      )
      setSelectedPanchayatId(ranked[0]?.panchayat_id ?? null)
      await refreshHistory(note == null)
    } catch (err) {
      await waitForAnimation()
      setError(err instanceof Error ? err.message : "Downscaling failed.")
    } finally {
      window.clearInterval(timer)
      setProcessStep(5)
      setProcessing(false)
    }
  }, [refreshHistory, selection])

  const openRun = useCallback(async (runId: string) => {
    setError(null)
    try {
      const payload = await getRun(runId)
      setRun(payload)
      setSelectionState((current) => ({
        ...current,
        stateId: payload.geography.state_id,
        districtId: payload.geography.district_id,
        blockId: payload.geography.block_id,
        date: payload.geography.date,
        variable: payload.variable,
        model: payload.model,
        predictors: payload.predictors?.length ? payload.predictors : current.predictors,
      }))
      setSelectedPanchayatId(payload.panchayat_forecasts[0]?.panchayat_id ?? null)
      setUsingFallback(false)
    } catch {
      const local = readLocalRuns().find((item) => item.run_id === runId)
      if (!local) {
        setError(`No downscaling run found for id ${runId}.`)
        return
      }
      setRun(local)
      setSelectedPanchayatId(local.panchayat_forecasts[0]?.panchayat_id ?? null)
    }
  }, [])

  const resetDemo = useCallback(async () => {
    try {
      await deleteHistory()
    } catch {
      setBackendOnline(false)
    }
    clearLocalHistory()
    sessionStorage.removeItem(SESSION_KEY)
    setRun(null)
    setSelectedPanchayatId(null)
    setSelectionState(initialSelection())
    setFallbackNote(null)
    setUsingFallback(backendOnline === false)
    setError(null)
    await refreshHistory(backendOnline === true)
  }, [backendOnline, refreshHistory])

  const staleRun = useMemo(() => {
    if (!run) return false
    return (
      run.geography.block_id !== selection.blockId ||
      run.geography.date !== selection.date ||
      run.model !== selection.model ||
      !samePredictors(run.predictors ?? [], selection.predictors)
    )
  }, [run, selection])

  const value = useMemo<AppContextValue>(
    () => ({
      backendOnline,
      usingFallback,
      fallbackNote,
      regions,
      selection,
      setSelection,
      useDemoRegion,
      blockForecast,
      panchayats,
      run,
      selectedPanchayatId,
      setSelectedPanchayatId,
      history,
      loading,
      processing,
      processStep,
      error,
      clearError: () => setError(null),
      reload: () => setReloadKey((key) => key + 1),
      downscale,
      openRun,
      resetDemo,
      staleRun,
    }),
    [
      backendOnline,
      usingFallback,
      fallbackNote,
      regions,
      selection,
      setSelection,
      useDemoRegion,
      blockForecast,
      panchayats,
      run,
      selectedPanchayatId,
      history,
      loading,
      processing,
      processStep,
      error,
      downscale,
      openRun,
      resetDemo,
      staleRun,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error("useApp must be used inside AppProvider")
  return context
}
