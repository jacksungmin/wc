# World Cup 2026 Mobility Dashboard — User Guide

**H-GAC · Houston, TX**

---

## Overview

The World Cup 2026 Mobility Dashboard is a real-time situational awareness tool for monitoring transportation conditions around NRG Stadium and World Cup venues during the FIFA World Cup 2026. It integrates live traffic, transit, weather, and camera feeds into a single screen.

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
- Automatically advances past a match 4 hours after kickoff, so the next NRG match appears without manually changing the match status

---

### METRO Live Transit — World Cup Houston 2026 (bottom 70%)

Displays real-time and scheduled transit data organized into six collapsible route groups. All groups start collapsed — click a group header to expand it.

#### Route Groups

| Group | Routes |
|---|---|
| **METROrail** *(scheduled)* | Red Line · Green Line · Purple Line |
| **Bus to NRG Stadium** | 8 West Bellfort · 11 Almeda/Lyons · 14 Hiram Clarke · 60 Cambridge · 73 Bellfort · 84 Buffalo Speedway · 87 Sunnyside · 211 West Loop |
| **Bus to Fan Festival** | 40 Telephone/Heights · 41 Kirby/Polk |
| **Airport Routes to Downtown** | 500 Downtown Direct · 102 Bush IAH · 40 Telephone/Heights |
| **Park & Ride to Downtown** | 108 · 151 · 209 · 219 · 229 · 249 · 259 · 269 |
| **Local Bus to Downtown** | 20 Canal/Memorial · 54 Scott · 82 Westheimer · 85 Antoine/Washington · 137 Northshore Express |

> Route 40 appears in both **Bus to Fan Festival** and **Airport Routes to Downtown** as it serves both corridors.

#### Panel Controls

| Control | Action |
|---|---|
| **Click group header** | Expand or collapse the trip list for that group |
| **Eye icon** (right of header) | Show or hide that group's pins on the map |
| **Refresh button** (panel top-right) | Manually reload the live transit feed |

#### Reading a Trip Entry

- **Route badge** — color-coded by line (Red/Green/Purple for rail; blue for bus)
- **SCHED badge** — trip is from the timetable (rail only; no live vehicle tracking available)
- **scheduled badge** on METROrail header — confirms rail data is timetable-based, not live
- **Outbound / Inbound** — direction of travel
- **Arrival time** — next stop arrival time
- **Delay** — "on time" (green), "+Xm" (amber/orange if delayed), or "scheduled" (gray)
- **Click any trip** — zooms the map to that vehicle or stop location

---

## Center Map

### Default State
- **Map style:** Satellite (Google)
- **Traffic layer:** On (Google real-time traffic)
- **METRO pins:** On (all groups visible)
- **Camera pins:** Off (turn on via Map Details panel)

---

### Map Controls

#### Home Button (top-right)
Resets the map view back to the default Houston area zoom and center.

#### Map Details Panel (Layers icon, top-right)
Opens a panel to turn layers on or off and change the map style.

**Layers:**

| Layer | Default | Description |
|---|---|---|
| Traffic | On | Real-time traffic color overlay |
| Cameras | Off | Show or hide all live camera pins |
| METRO Transit | On | Show or hide all bus and rail pins |
| GOES Satellite | Off | NOAA GOES-18 live cloud imagery |

> Individual route groups can also be shown or hidden directly from the METRO panel using the **eye icon** on each group header.

**Map style options:** Command Dark · Google · Satellite · Hybrid · Terrain

---

### Map Markers

#### NRG Stadium ⚽
Animated orange pulsing pin at the stadium center. Always visible.

#### Fan Festival Entrance 🎪
Animated gold pulsing pin at the Fan Festival entrance location. Always visible.

#### METRO Bus Pins (rounded labels)
Bus routes appear as small rounded labels showing the route number and direction arrow:

| Appearance | Meaning |
|---|---|
| Teal label · **82▲** | Outbound |
| Amber label · **82▼** | Inbound |
| Gray label · **82** | Direction unknown |

Clicking a bus pin selects that trip and highlights it in the panel.

#### METRO Rail Pins (circles)
| Color | Line |
|---|---|
| Red | METRORAIL Red Line |
| Green | METRORAIL Green Line |
| Purple | METRORAIL Purple Line |

Direction arrow (▲/▼) shown inside the circle. Timetable departures only — no live vehicle tracking for rail.

#### Traffic Camera Pins (blue)
Camera pins appear on the map when the **Cameras** layer is turned on in Map Details. Hover a pin to see the camera name and road. Click to open the live feed in the right panel.

**Available live camera feeds:**

| Camera | Highway |
|---|---|
| IH-10 Katy @ West Loop | I-10 Katy |
| IH-10 Katy @ West Loop (S) | I-10 Katy |
| IH-10 Katy @ Post Oak | I-10 Katy |
| IH-10 Katy @ North Post Oak | I-10 Katy |
| IH-45 Gulf @ West Dallas | IH-45 Gulf |
| IH-45 Gulf @ San Jacinto | IH-45 Gulf |
| IH-45 North @ Franklin | IH-45 North |
| IH-69 Eastex @ IH 10 | IH-69 Eastex |
| IH-69 Eastex @ Franklin | IH-69 Eastex |
| IH-69 Eastex @ Texas | IH-69 Eastex |
| IH-69 Southwest @ Mc Gowen | IH-69 Southwest |
| IH-69 Southwest @ Elgin | IH-69 Southwest |
| IH-69 Southwest @ SH 288 | IH-69 Southwest |
| IH-69 Southwest @ SH 288 (S) | IH-69 Southwest |
| *(+ additional DriveTexas feeds)* | Various |

#### INRIX Incident Pins
Color-coded by severity:

| Color | Severity |
|---|---|
| Gray | Low (1) |
| Yellow | Moderate (2) |
| Orange | High (3) |
| Red | Critical (4) |

Letter codes: **C** = Crash · **X** = Closure · **W** = Construction · **H** = Hazard · **Wx** = Weather · **E** = Event

Click an incident to zoom in and see full details.

#### Traffic Speed Lines
Color-coded road lines along key corridors (I-610, US-59):

| Color | Condition |
|---|---|
| Green | Free flow (≥85% of average) |
| Yellow | Moderate congestion (65–84%) |
| Orange | Heavy congestion (40–64%) |
| Red | Severe congestion (<40%) |

### Map Traffic Summary Badge

The bottom-left map badge summarizes traffic data inside the current map view. Counts update when the map is panned or zoomed.

| Line | Counts |
|---|---|
| **INRIX** | Visible incidents and visible speed segments |
| **TranStar** | Visible incidents, lane closures, and roadway flood risks |

---

## Right Panel

### Camera Feeds (top 58%)

Displays live traffic camera feeds sorted by proximity to NRG Stadium (closest first).

- **Click a camera** to select it - the map flies to that camera's location
- **Click again** to deselect
- Sources: TxDOT DriveTexas live video feeds

### Traffic Panel (bottom 42%)

Shows two traffic tabs: **INRIX** and **TranStar**.

#### INRIX Tab

- Lists active INRIX traffic incidents within a 2-hour window
- Shows incident type, description, severity, and time
- **Click an incident** to zoom the map to its location
- **Click again** to deselect and return to default view
- Severity: Low / Medium / High / Critical

#### TranStar Tab

- Lists Houston TranStar incidents, lane closures, and roadway flood risks in the current map extent
- Optional **2h filter** limits TranStar incidents to the last 2 hours
- **Click any row** to zoom the map to its location and open the popup
- Lane closures show hotspot indicators when available
- Roadway flood risks show the sensor name and risk radius

---

## Status Ticker (Bottom Bar)

A scrolling status strip showing a live summary of all data sources:

1. Active weather alerts (event names) or "No active weather alerts"
2. INRIX incident count and major incident count
3. METRO bus (live trips) and rail (scheduled departures) summary
4. Live camera feed count
5. Map points of interest (NRG Stadium, Fan Festival Entrance)
6. Next scheduled NRG match, advanced automatically by kickoff time
7. Map and background map information

---

## Data Sources

| Source | Data | Refresh |
|---|---|---|
| NWS / weather.gov | Weather observations and alerts | ~5 min |
| Houston METRO | Live bus trip updates | 30 sec |
| Houston METRO | Rail timetable (Red/Green/Purple Lines) | At startup |
| INRIX | Traffic incidents and speed data | ~2 min |
| TxDOT DriveTexas | Live traffic camera video | Live |
| Houston TranStar | Incidents, lane closures, roadway flood risk, corridor speeds | ~60 sec |
| Google Maps | Satellite and traffic layers | Live |
| NOAA GOES-18 | Satellite cloud imagery | ~10 min |

---

## Tips

- **Best view:** Keep the dashboard in full-screen or maximized browser window
- **Game day:** Expand the **Bus to NRG Stadium** group 90 minutes before kickoff to monitor inbound routes
- **Rail tracking:** METROrail shows timetable data only — the "scheduled" label on the group header is expected
- **Route groups:** Use the eye icon on each group to declutter the map and focus on specific corridors
- **Fan Festival:** Routes 40 and 41 serve the Fan Festival area and appear under both Fan Festival and Airport groups
- **Airport routes:** Route 500 (Downtown Direct) and 102 (Bush IAH) connect the airports to downtown during match days
- **Weather alerts:** Hover over alert badges in the header for the full NWS headline
- **Camera feeds:** Turn on the Cameras layer in Map Details to see all camera pins, or select a camera from the right panel to jump directly to it
- **Traffic:** Red road lines on I-610 South Loop or US-59 near NRG indicate significant congestion — plan alternate routes
- **Map summary:** Pan or zoom the map to update the traffic summary badge to the current visible area

---

*World Cup 2026 Mobility Dashboard · H-GAC · Houston, TX*
