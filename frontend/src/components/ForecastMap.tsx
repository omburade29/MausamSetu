import type { Feature, GeoJsonObject } from "geojson"
import L from "leaflet"
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { GeoJSON, MapContainer, ScaleControl, TileLayer, useMap } from "react-leaflet"
import { VARIABLE_META } from "@/content/copy"
import EmptyState from "@/components/EmptyState"
import LoadingState from "@/components/LoadingState"
import MapLegend from "@/components/MapLegend"
import { choropleth } from "@/lib/colors"
import { formatValue } from "@/lib/format"
import type { PolygonGeometry, VariableId } from "@/types"

export interface MapPlace {
  id: string
  name: string
  geometry: PolygonGeometry
  latitude: number
  longitude: number
  value?: number
  uncertainty?: string
}

interface Props {
  blockGeometry: PolygonGeometry | null
  places: MapPlace[]
  mode: "block" | "panchayat"
  variable: VariableId
  blockValue?: number
  selectedId?: string | null
  onSelect?: (id: string) => void
  loading?: boolean
}

function FitTo({ geometry }: { geometry: PolygonGeometry }) {
  const map = useMap()
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current) return
    const bounds = L.geoJSON(geometry as GeoJsonObject).getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.12))
      fitted.current = true
    }
  }, [geometry, map])
  return null
}

function project(lon: number, lat: number) {
  const x = ((lon - 86.47) / (86.634 - 86.47)) * 1000
  const y = ((20.53 - lat) / (20.53 - 20.37)) * 640
  return `${x},${y}`
}

function BoundaryView({ places, blockGeometry, mode, variable, selectedId, onSelect, min, max }: Props & { min: number; max: number }) {
  return (
    <svg viewBox="0 0 1000 640" className="h-full w-full bg-[#e8eef5]" role="img" aria-label="Boundary fallback map">
      {blockGeometry && (
        <polygon
          points={blockGeometry.coordinates[0].map(([lon, lat]) => project(lon, lat)).join(" ")}
          fill="#dbeafe"
          stroke="#0B1F3A"
          strokeWidth="6"
        />
      )}
      {places.map((place) => {
        const t = max === min ? 0.5 : ((place.value ?? min) - min) / (max - min)
        const fill = mode === "panchayat" ? choropleth(variable, t) : "#ffffff"
        const selected = place.id === selectedId
        return (
          <g key={place.id} onClick={() => onSelect?.(place.id)} className="cursor-pointer">
            <polygon
              points={place.geometry.coordinates[0].map(([lon, lat]) => project(lon, lat)).join(" ")}
              fill={fill}
              fillOpacity={mode === "panchayat" ? 0.88 : 0.7}
              stroke={selected ? "#0B1F3A" : "#1B4B86"}
              strokeWidth={selected ? 8 : 3}
            />
            <text
              x={project(place.longitude, place.latitude).split(",")[0]}
              y={project(place.longitude, place.latitude).split(",")[1]}
              textAnchor="middle"
              fontSize="22"
              fontWeight="600"
              fill="#0B1F3A"
            >
              {place.name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

class MapBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}

export default function ForecastMap(props: Props) {
  const { blockGeometry, places, mode, variable, blockValue, selectedId, onSelect, loading } = props
  const [tilesFailed, setTilesFailed] = useState(false)
  const [boundaryView, setBoundaryView] = useState(false)
  const values = places.map((place) => place.value).filter((value): value is number => value != null)
  const min = values.length ? Math.min(...values) : (blockValue ?? 0)
  const max = values.length ? Math.max(...values) : (blockValue ?? 1)

  const collection = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: places.map((place) => ({
        type: "Feature" as const,
        properties: {
          id: place.id,
          name: place.name,
          value: place.value,
          uncertainty: place.uncertainty,
        },
        geometry: place.geometry,
      })),
    }),
    [places],
  )

  if (loading) return <LoadingState label="Preparing the map" />
  if (!blockGeometry) {
    return <EmptyState title="Map waiting for a block" message="Choose a block to draw the schematic boundary." />
  }

  const styleFor = (feature?: Feature) => {
    const id = String(feature?.properties?.id ?? "")
    const value = Number(feature?.properties?.value)
    const t = max === min || Number.isNaN(value) ? 0.55 : (value - min) / (max - min)
    const selected = id === selectedId
    if (mode === "block") {
      return { color: "#1B4B86", weight: selected ? 3 : 1.4, fillColor: "#ffffff", fillOpacity: 0.55 }
    }
    return {
      color: selected ? "#0B1F3A" : "#0f2744",
      weight: selected ? 3.2 : 1.2,
      fillColor: choropleth(variable, t),
      fillOpacity: selected ? 0.9 : 0.78,
    }
  }

  const fallback = (
    <BoundaryView {...props} min={min} max={max} />
  )

  return (
    <div className="relative h-[560px] overflow-hidden rounded-2xl border border-slate-200">
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <button
          type="button"
          className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-navy-900 shadow"
          onClick={() => setBoundaryView((value) => !value)}
        >
          {boundaryView ? "Try map tiles" : "Boundary view"}
        </button>
      </div>
      {boundaryView ? (
        fallback
      ) : (
        <MapBoundary fallback={fallback}>
          <MapContainer center={[20.45, 86.55]} zoom={12} className="h-full w-full" scrollWheelZoom>
            <FitTo geometry={blockGeometry} />
            {!tilesFailed && (
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                eventHandlers={{ tileerror: () => setTilesFailed(true) }}
              />
            )}
            <GeoJSON
              data={blockGeometry as GeoJsonObject}
              style={{ color: "#0B1F3A", weight: 2.4, fillColor: "#93C5FD", fillOpacity: mode === "block" ? 0.28 : 0.05 }}
            />
            <GeoJSON
              key={`${mode}-${variable}-${selectedId}-${min}-${max}`}
              data={collection as GeoJsonObject}
              style={styleFor}
              onEachFeature={(feature, layer) => {
                const name = String(feature.properties?.name ?? "")
                const value = feature.properties?.value
                const uncertainty = feature.properties?.uncertainty
                const valueText =
                  typeof value === "number" ? formatValue(variable, value) : formatValue(variable, blockValue)
                layer.bindTooltip(
                  `<strong>${name}</strong><br/>${valueText}${uncertainty ? `<br/>${uncertainty}` : ""}`,
                  { sticky: true },
                )
                layer.on("click", () => {
                  const id = feature.properties?.id
                  if (typeof id === "string") onSelect?.(id)
                })
              }}
            />
            <ScaleControl position="bottomright" />
          </MapContainer>
        </MapBoundary>
      )}
      <div className="absolute bottom-3 left-3 z-10 max-w-[220px]">
        <MapLegend variable={variable} min={min} max={max} mode={mode} />
      </div>
      {tilesFailed && !boundaryView && (
        <p className="absolute left-3 top-3 z-10 rounded-lg bg-white/95 px-2 py-1 text-xs font-medium text-amber-900 shadow">
          Map tiles unavailable. Boundaries and labels remain usable.
        </p>
      )}
      <p className="absolute bottom-3 right-16 z-10 hidden rounded-lg bg-white/90 px-2 py-1 text-[11px] text-slate-600 shadow sm:block">
        {mode === "block" ? "Current resolution: Block level" : "Output resolution: Panchayat level"} · {VARIABLE_META[variable].label}
      </p>
    </div>
  )
}
