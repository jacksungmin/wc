# World Cup 2026 Mobility Dashboard — User Guide

**H-GAC · Houston, TX**

---

## Overview

The World Cup 2026 Mobility Dashboard is a real-time situational awareness tool for monitoring transportation conditions around NRG Stadium during the FIFA World Cup 2026. It integrates live traffic, transit, weather, and camera feeds into a single screen.

---

## Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER: Logo · Title · Weather Strip · Alerts · Clock              │
├──────────────┬──────────────────────────────────┬───────────────────┤
│  LEFT PANEL  │         CENTER MAP               │   RIGHT PANEL     │
│  · Matches   │                                  │   · Camera Feeds  │
│  · METRO     │                                  │   · INRIX Traffic │
├──────────────┴──────────────────────────────────┴───────────────────┤
│  STATUS TICKER (scrolling)                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Header

| Element | Description |
|---|---|
| **Logo / Title** | H-GAC branding and dashboard name with Houston, TX subtitle |
| **Weather Strip** | Live NRG-area conditions: sky description · temperature · feels like · wind · humidity |
| **Weather Alerts** | Colored pulsing badges for active NWS alerts — Red = Extreme, Orange = Severe, Yellow = Moderate. Hover for full headline |
| **Clock** | Live CDT time and date (top-right) |

---

## Left Panel

### Game Information (top 30%)

Displays the World Cup 2026 match schedule for NRG Stadium.

- Shows home and away teams with country flags
- Displays kickoff time, group/stage, and match status
- Highlights upcoming matches with countdown ("In Xd" or **TODAY**)

---

### METRO Live Bus Transit To/From NRG Stadium (bottom 70%)

Displays real-time and scheduled transit data for routes serving NRG Stadium.

**Monitored Routes:**

| Type | Routes |
|---|---|
| Rail (Scheduled) | Red Line · Green Line · Purple Line |
| Bus (Live) | 8 West Bellfort · 11 Almeda · 14 Hiram Clarke · 60 Cambridge · 73 Bellfort · 84 Buffalo Speedway · 87 Sunnyside · 211 West Loop |

**Reading the panel:**

- **Route badge color** — matches the official line color (Red/Green/Purple for rail; Blue for bus)
- **SCHED badge** — trip is from the static schedule (no live GPS available for rail)
- **▲ Outbound / ▼ Inbound** — direction of travel shown on each entry
- **Arrival time** — next stop arrival; "on time", "+Xm" (delayed), or "scheduled"
- **Click any trip** — zooms the map to that vehicle or stop location
- **Refresh button** (top-right of panel) — manually reload the transit feed

---

## Center Map

### Default State
- **Basemap:** Satellite (Google)
- **Traffic overlay:** On (Google real-time traffic)
- **METRO markers:** On
- **Camera markers:** Off (appear only when a camera is selected)

---

### Map Controls

#### Home Button (top-right)
Resets the map view back to the default Houston area zoom and center.

#### Map Details Panel (Layers icon, top-right)
Opens a panel to toggle overlays and switch basemaps.

**Toggles:**

| Toggle | Default | Description |
|---|---|---|
| Traffic | On | Google real-time traffic color overlay |
| Cameras | Off | Show/hide all live camera markers |
| METRO Transit | On | Show/hide bus and rail markers |
| GOES Satellite | Off | NOAA GOES-18 live cloud imagery |

**Basemap options:** Command Dark · Google · Satellite · Hybrid · Terrain

---

### Map Markers

#### NRG Stadium ⚽
Animated orange pulsing marker at the stadium center. Always visible.

#### Fan Festival Entrance 🎪
Animated gold pulsing marker at the Fan Festival entrance location. Always visible.

#### METRO Bus Markers (rectangles)
| Color | Meaning |
|---|---|
| Teal + ▲ | Outbound |
| Amber + ▼ | Inbound |

Click a marker to open a popup with route, trip, stop, and position details.

#### METRO Rail Markers (circles)
| Color | Line |
|---|---|
| Red (#CC1030) | METRORAIL Red Line |
| Green (#007A33) | METRORAIL Green Line |
| Purple (#5C2882) | METRORAIL Purple Line |

Direction badge (▲/▼) shown on circle. Scheduled departures only (no live GPS for rail).

#### Traffic Camera Marker (blue)
Appears on the map only for the currently selected camera feed. Deselecting a camera removes the marker.

#### INRIX Incident Markers
Color-coded dots by severity:

| Color | Severity |
|---|---|
| Gray | Low (1) |
| Yellow | Moderate (2) |
| Orange | High (3) |
| Red | Critical (4) |

Letter codes: **C** = Crash · **X** = Closure · **W** = Construction · **H** = Hazard · **Wx** = Weather · **E** = Event

Click an incident to zoom in and see full details.

#### Traffic Speed Segments (polylines)
Color-coded segments along key corridors (I-610, US-59):

| Color | Condition |
|---|---|
| Green | Free flow (≥85% of average) |
| Yellow | Moderate congestion (65–84%) |
| Orange | Heavy congestion (40–64%) |
| Red | Severe congestion (<40%) |

---

## Right Panel

### Camera Feeds (top 68%)

Displays live traffic camera feeds sorted by proximity to NRG Stadium (closest first).

- **Click a camera thumbnail** to select it — the map shows that camera's location marker
- **Click again** to deselect — the map marker is hidden
- Supports both HLS live streams and JPEG snapshot feeds
- Source: TxDOT DriveTexas and Houston TranStar

### INRIX Traffic (2 Hours) (bottom 32%)

Lists active traffic incidents within a 2-hour window around the Houston area.

- Shows incident type, description, severity, and time
- **Click an incident** to zoom the map to its location
- **Click again** to deselect and return to default view
- Severity badge: Low / Medium / High / Critical

---

## Status Ticker (Bottom Bar)

A scrolling status strip showing a live summary of all data sources:

1. Active weather alerts (event names) or "No active weather alerts"
2. INRIX incident count and major incident count
3. METRO bus (live trips) and rail (scheduled departures) summary
4. Live camera feed count and behavior note
5. Map points of interest (NRG Stadium, Fan Festival Entrance)
6. Next scheduled NRG match
7. Map and basemap information

---

## Data Sources

| Source | Data | Refresh |
|---|---|---|
| NWS / weather.gov | Weather observations and alerts | ~5 min |
| Houston METRO GTFS-RT | Bus trip updates (real-time) | 30 sec |
| Houston METRO Static GTFS | Rail schedule (Red/Green/Purple Lines) | On load |
| INRIX | Traffic incidents and speed segments | ~2 min |
| TxDOT DriveTexas / TranStar | Traffic camera feeds | Live stream |
| Google Maps | Satellite and traffic tile layers | Live |
| NOAA GOES-18 | Satellite cloud imagery | ~10 min |

---

## Tips

- **Best view:** Keep the dashboard in full-screen or maximized browser window
- **Game day:** Check METRO Live panel 90 minutes before kickoff for scheduled rail departures
- **Weather alerts:** Hover over alert badges in the header for the full NWS headline
- **Camera feeds:** Cameras are sorted closest to NRG Stadium first — the top feeds cover the immediate stadium area
- **Traffic:** Red segments on I-610 South Loop or US-59 near NRG indicate significant congestion — plan alternate routes
- **METRO rail:** All rail entries show "SCHED" — this is expected, as METRO does not publish real-time GPS for rail

---

*World Cup 2026 Mobility Dashboard · H-GAC · Houston, TX*
