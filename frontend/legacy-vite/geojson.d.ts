declare module "*.geojson" {
  const value: {
    type: string
    features: Array<{
      type: string
      properties: {
        kind: string
        id: string
        name: string
        block_id?: string
        latitude?: number
        longitude?: number
      }
      geometry: {
        type: "Polygon"
        coordinates: number[][][]
      }
    }>
  }
  export default value
}
