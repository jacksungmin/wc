export interface WeatherAlert {
  id: string
  event: string
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown'
  urgency: string
  headline: string
  description: string
  instruction?: string
  onset: string
  expires: string
  areaDesc: string
}

export interface WeatherObservation {
  stationId: string
  stationName: string
  timestamp: string
  temperature: number | null
  dewpoint: number | null
  windDirection: number | null
  windSpeed: number | null
  relativeHumidity: number | null
  windChill: number | null
  heatIndex: number | null
  textDescription: string
}

export interface TrafficCamera {
  id: string
  name: string
  highway: string
  direction: string
  lat: number
  lng: number
  streamUrl?: string  // HLS playlist (DriveTexas / SkyVDN) — takes priority
  imageUrl?: string   // JPEG snapshot fallback (TranStar)
}

export interface InrixIncident {
  id: string
  type: string
  subType: string
  shortDesc: string
  fullDesc: string
  lat: number
  lng: number
  severity: 1 | 2 | 3 | 4
  startTime: string
  endTime?: string
}

export interface InrixSegment {
  code: string
  speed: number
  averageSpeed: number
  travelTime: number
  startLat: number
  startLng: number
  endLat: number
  endLng: number
}

export interface WorldCupMatch {
  id: string
  date: string
  kickoff: string
  homeTeam: string
  awayTeam: string
  homeFlag: string
  awayFlag: string
  homeFlagCode?: string
  awayFlagCode?: string
  group: string
  stage: string
  status: 'upcoming' | 'live' | 'completed'
  homeScore?: number
  awayScore?: number
}

export interface TranStarSegmentDetail {
  ft: string
  speedMph: number
  travelSec: number
  delaySec: number
  lengthMi: number
}

export interface TranStarCorridor {
  label: string
  rd: string
  dir: string
  travelMin: number
  delayMin: number
  avgSpeed: number
  segments: TranStarSegmentDetail[]
  camHighway: string | null
}

export interface TranStarIncident {
  id: string
  location: string
  desc: string
  vehicles: number
  lanes: string
  status: string
  time: string
  date: string
  lat: number
  lng: number
}

export interface TranStarLaneClosure {
  id: string
  location: string
  roadway: string
  lanes: string
  duration: string
  detour: string
  status: string
  agency: string
  hotspot: boolean
  project: string
  lat: number
  lng: number
  startTime: string
  endTime: string
}

export interface MetroTripUpdate {
  id: string
  routeId: string
  routeShortName?: string | null
  routeLongName?: string | null
  routeType?: number | null
  tripId: string
  directionId?: number
  delaySeconds: number | null
  nextStopId: string | null
  nextStopSequence: number | null
  arrivalTime: string | null
  stopUpdates: number
  lat?: number
  lng?: number
  bearing?: number | null
  vehicleId?: string | null
  positionSource?: 'vehicle' | 'stop'
  isScheduled?: boolean
}
