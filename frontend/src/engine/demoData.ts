import forecastsFile from "@data/block_forecasts.json"
import geoFile from "@data/panchayats.geojson"
import predictorsFile from "@data/predictors.json"
import referencesFile from "@data/reference_values.json"
import regionsFile from "@data/regions.json"
import type {
  BlockForecast,
  PanchayatFeature,
  PolygonGeometry,
  RegionsFile,
  WeatherValues,
} from "@/types"

export const regions = regionsFile as RegionsFile

type PredictorRow = {
  panchayat_id: string
  elevation_m: number | null
  land_cover: number | null
  soil_moisture: number | null
  distance_to_water_km: number | null
  vegetation: number | null
  data_quality: number | null
}

type GeoFeature = {
  properties: {
    kind: string
    id: string
    name: string
    block_id?: string
    latitude?: number
    longitude?: number
  }
  geometry: PolygonGeometry
}

const predictors = predictorsFile.predictors as PredictorRow[]
const features = (geoFile as { features: GeoFeature[] }).features
const forecastRows = forecastsFile.forecasts as Array<WeatherValues & { block_id: string; date: string }>
const referenceRows = (referencesFile as { references: Array<WeatherValues & { panchayat_id: string; date: string }> })
  .references

export function geographyIndex() {
  return regions.states.flatMap((state) =>
    state.districts.flatMap((district) =>
      district.blocks.map((block) => ({
        state,
        district,
        block,
      })),
    ),
  )
}

export function blockGeometry(): PolygonGeometry {
  const block = features.find((feature) => feature.properties.kind === "block")
  if (!block) throw new Error("Demo GeoJSON is missing the block boundary.")
  return block.geometry
}

export function localPanchayats(blockId: string): PanchayatFeature[] {
  return features
    .filter((feature) => feature.properties.kind === "panchayat" && feature.properties.block_id === blockId)
    .map((feature) => {
      const predictor = predictors.find((row) => row.panchayat_id === feature.properties.id)
      if (!predictor) throw new Error(`Missing predictors for ${feature.properties.id}`)
      return {
        id: feature.properties.id,
        name: feature.properties.name,
        latitude: feature.properties.latitude ?? 0,
        longitude: feature.properties.longitude ?? 0,
        geometry: feature.geometry,
        elevation_m: predictor.elevation_m,
        land_cover: predictor.land_cover,
        soil_moisture: predictor.soil_moisture,
        distance_to_water_km: predictor.distance_to_water_km,
        vegetation: predictor.vegetation,
        data_quality: predictor.data_quality,
      }
    })
}

export function localBlockForecast(blockId: string, date?: string): BlockForecast {
  const match = geographyIndex().find((item) => item.block.id === blockId)
  if (!match) throw new Error("Block not found in the demo geography.")
  const series = forecastRows.filter((row) => row.block_id === blockId).sort((a, b) => a.date.localeCompare(b.date))
  if (!series.length) throw new Error("No demo block forecast is stored for this block.")
  const chosen = series.find((row) => row.date === (date || "2026-09-28")) ?? series[series.length - 1]
  return {
    block_id: blockId,
    block_name: match.block.name,
    state_name: match.state.name,
    district_name: match.district.name,
    date: chosen.date,
    dates: series.map((row) => row.date),
    values: {
      rainfall_mm: chosen.rainfall_mm,
      temperature_c: chosen.temperature_c,
      humidity_pct: chosen.humidity_pct,
      wind_kmh: chosen.wind_kmh,
    },
    series: series.map((row) => ({
      date: row.date,
      rainfall_mm: row.rainfall_mm,
      temperature_c: row.temperature_c,
      humidity_pct: row.humidity_pct,
      wind_kmh: row.wind_kmh,
    })),
    resolution: "Block level",
    resolution_text: "Current resolution: Block level",
    geometry: blockGeometry(),
    representative_point: match.block.representative_point,
    note: "Coarse block guidance for the demonstration. Not an IMD bulletin.",
    source: "demo_simulation",
    is_simulated: true,
  }
}

export function referenceFor(panchayatId: string, date: string): WeatherValues | null {
  const row = referenceRows.find((item) => item.panchayat_id === panchayatId && item.date === date)
  if (!row) return null
  return {
    rainfall_mm: row.rainfall_mm,
    temperature_c: row.temperature_c,
    humidity_pct: row.humidity_pct,
    wind_kmh: row.wind_kmh,
  }
}
