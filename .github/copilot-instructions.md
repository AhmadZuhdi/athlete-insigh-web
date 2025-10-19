# Athlete Insight - AI Coding Agent Instructions

## Project Overview
**Athlete Insight** is a backendless React TypeScript application that analyzes Strava activities with sophisticated fitness metrics. The architecture is frontend-only using **OAuth 2.0** for Strava auth, **IndexedDB** (via Dexie) for local caching, and **Recharts** for data visualization.

### Tech Stack
- **React 18** with TypeScript, React Router v6
- **Services**: Strava API integration, IndexedDB persistence  
- **UI**: Recharts (charts), Lucide React (icons), CSS Grid/Flexbox
- **Build**: React Scripts (CRA), targeting ES5

## Critical Architecture Patterns

### 1. Three-Tier Data Flow
```
Strava API ← → IndexedDB Cache (StravaService) → React Components
```
- **StravaService** (singleton): Handles OAuth, token refresh (5-min buffer), API calls
- **IndexedDB (Dexie)**: Caches activities, details, athlete profile, settings  
- **Components**: Read from service, never directly call API or database

### 2. Strava OAuth Flow
1. User enters `clientId`/`clientSecret` in Settings → stored in IndexedDB
2. Click "Connect to Strava" → generates authorization URL with `approval_prompt=force`
3. User authorizes → Strava redirects with `code`
4. Exchange code for tokens → stored as `accessToken`, `refreshToken`, `expiresAt`
5. **Automatic refresh**: `ensureValidToken()` refreshes if expiring within 5 mins

**Key files**: `src/services/stravaService.ts` (lines 46-100), `src/components/Settings.tsx`

### 3. Stream Data Processing (GPS + Heart Rate)
Activities fetch **11 stream types** (time, distance, latlng, altitude, velocity, heartrate, cadence, watts, temp, moving, grade):
- **Fallback**: If streams unavailable, use split-based data
- **Cache**: Streams stored in `activityDetails` table with full activity

**Key computation**: `ActivityDetail.tsx` uses streams for all visualizations—not splits!

### 4. Relative Effort Scoring Algorithm
Physiologically-weighted effort based on **5 HR zones** with multipliers (×1 to ×8):
```
Total Effort = Σ(time_in_zone_i × multiplier_i)
Relative Effort = (Total Effort / total_time) × 3600 (per hour)
```
**Input**: Birth year (calculated max HR = 220 - age) → zones (via `calculateMaxHeartRate()`, `getHeartRateZones()`)
**Location**: `ActivityDetail.tsx` lines 20-80

### 5. LLM Summary Generation
Exports **structured activity data** + **yearly context** for AI analysis:
- Includes: metrics, HR zones %, effort points, all year-to-date activities
- **Customizable prefix**: User-defined prompt in Settings (stored in `athlete.llm_summary_prefix`)
- **Output**: Plain text format optimized for LLMs to parse

## File Organization & Key Functions

| File | Purpose | Key Exports/Functions |
|------|---------|----------------------|
| `src/services/stravaService.ts` | OAuth, API calls, token refresh | `StravaService.getInstance()`, `ensureValidToken()`, `getActivityStreams()` |
| `src/services/database.ts` | Dexie schema, import/export | Tables: `settings`, `activities`, `activityDetails`, `athlete` |
| `src/components/ActivityDetail.tsx` | Main analysis page | `calculateRelativeEffortPoints()`, `calculateMaxHeartRate()`, `getHeartRateZones()` |
| `src/components/Settings.tsx` | OAuth setup, data mgmt | Settings form, export/import, birth year config |
| `src/components/Activities.tsx` | Activity listing | Pagination, caching UI state |
| `src/App.tsx` | Router setup | Routes: `/`, `/activities`, `/activity/:id`, `/records`, `/settings` |

## Naming Conventions & Patterns

- **Component state**: Snake_case for API data (e.g., `start_date_local`), camelCase for UI (e.g., `isLoading`)
- **Database models**: Match Strava API exactly (snake_case)
- **Custom athlete fields**: `birth_year`, `llm_summary_prefix` added to `StravaAthlete` interface
- **Error handling**: Try/catch with user-facing messages via `setMessage({ type, text })`

## Common Workflows

### Adding a New Metric
1. If from stream data: Add stream key to `streamTypes` array in `getActivityStreams()` (line 140)
2. Process data in component using `activity.streams[key]`
3. Visualize with Recharts

### Adding a Settings Field
1. Update `StravaAthlete` interface in `database.ts`
2. Add setter: `stravaService.updateAthlete{FieldName}(value)` 
3. Add UI control in `Settings.tsx` with `handleSave()` pattern
4. Persist via `db.athlete.update()`

### Debugging IndexedDB
Open browser DevTools → Application → IndexedDB → AthleteInsightDB → tables

## Development Workflow
```bash
npm start              # Dev server (localhost:3000)
npm run build          # Production build → build/
npm test               # React Scripts test runner
```
**Token debugging**: Intercepted in `makeAuthenticatedRequest()` headers

## Important Gotchas
- ⚠️ **No refresh on component mount**: `getActivities()` does NOT refresh from API by default—manually call or check cache staleness
- ⚠️ **Token expiry**: Some Strava endpoints reject expired tokens before 5-min buffer—test with `expiresAt` manually set to `Date.now()`
- ⚠️ **Stream data optional**: Always check `activity.streams?.heartrate` before using
- ⚠️ **Dexie version 4 schema**: Fresh start; migrations from v3 will fail silently

## Developer Preference
- Show implementation steps before proceeding
- Provide multiple approaches when applicable and let me choose
- Avoid generic advice—focus on project-specific patterns
- Be concise and to the point
- Skip creating summary unless requested