# Athlete Insight - Strava Activity Analyzer

A React-based web applic### Strava API Integration
- OAuth 2.0 authentication flow
- Automatic token refresh
- Activity listing and detailed activity fetching
- **Activity Streams**: GPS coordinates, time series, elevation, heart rate, and sensor data
- Local caching with IndexedDB

### Data Analysis
- Performance metrics (pace, speed, elevation)
- **Enhanced GPS-based analysis** with stream data
- Split analysis with interactive charts
- Heart rate and power data (when available)
- **Heart Rate Zone Analysis**: 5-zone distribution with age-based max HR calculation
- **Relative Effort Scoring**: Physiologically-weighted effort points based on HR zone time distribution
- Elevation profile visualization
- **Real-time data visualization** using continuous sensor streamsconnects to the Strava API to analyze your activities. Everything runs in the frontend with data stored locally using IndexedDB - no backend required!

## Features

- **Settings Page**: Configure your Strava API credentials (Client ID and Client Secret)
- **Activities Page**: List and browse your Strava activities (cached locally after first fetch)
- **Activity Detail**: Detailed analysis of individual activities with enhanced charts and statistics
- **Stream Data Integration**: Fetches detailed GPS, heart rate, and sensor data for rich visualizations
- **LLM Summary Export**: Generate comprehensive activity summaries optimized for AI analysis with customizable prompts
- **Offline-First**: All data is stored locally in IndexedDB for fast access
- **Responsive Design**: Modern UI that works on desktop and mobile

## Activity Analysis Features

### Enhanced Data Visualization
- **Pace Analysis**: Detailed pace charts using GPS stream data (more accurate than split-based)
- **Elevation Profile**: Continuous elevation data from GPS streams
- **Heart Rate Tracking**: Real-time heart rate data throughout the activity
- **Heart Rate Zone Distribution**: Visual breakdown of time spent in each HR zone with color-coded intensity levels
- **Relative Effort Analysis**: Weighted effort scoring based on heart rate zone distribution with physiological multipliers
- **Speed Analysis**: Velocity data with smooth curves
- **Stream Data Indicator**: Shows whether detailed GPS/sensor data is available
- **LLM Data Export**: One-click generation of structured activity summaries for AI analysis and coaching insights

### Data Sources
- **Primary**: GPS and sensor stream data (time, distance, latlng, altitude, velocity, heart rate)
- **Fallback**: Split-based data when streams are unavailable
- **Automatic Caching**: Stream data is cached locally for offline access

## Heart Rate Zone Analysis

### Zone-Based Training Insights
- **5-Zone Heart Rate System**: Recovery, Aerobic Base, Aerobic, Lactate Threshold, Neuromuscular Power
- **Age-Based Max HR Calculation**: Uses standard 220-age formula (configurable birth year in settings)
- **Visual Zone Distribution**: Color-coded pie chart showing time spent in each intensity zone
- **Zone Color Coding**: Blue (easy) → Green (moderate) → Yellow (tempo) → Orange (hard) → Red (maximum)

### Relative Effort Scoring System
The app calculates a sophisticated effort score that goes beyond simple time or average heart rate:

#### Zone Multipliers
- **Zone 1 (Recovery)**: ×1 multiplier - Light blue
- **Zone 2 (Aerobic Base)**: ×2 multiplier - Green  
- **Zone 3 (Aerobic)**: ×3 multiplier - Yellow
- **Zone 4 (Lactate Threshold)**: ×5 multiplier - Orange
- **Zone 5 (Neuromuscular Power)**: ×8 multiplier - Red

#### Key Metrics
- **Total Effort Points**: Cumulative weighted score for entire activity
- **Relative Effort Score**: Normalized effort per hour for cross-activity comparison
- **Intensity Factor**: Average intensity rating (0-8 scale)
- **Physiological Weighting**: Higher zones contribute exponentially more points, reflecting real metabolic cost

This system allows meaningful comparison between different workout types - a short intense interval session can have similar effort scores to longer moderate-paced activities.

## LLM Summary & AI Analysis

### Intelligent Data Export
The app includes a sophisticated LLM summary feature that generates structured, AI-ready summaries of your activities:

#### Core Features
- **One-Click Export**: Generate comprehensive activity summaries with the "📋 LLM Summary" button
- **Structured Format**: Machine-readable data format optimized for language model analysis
- **Comprehensive Context**: Includes activity metrics, heart rate zones, effort scoring, and yearly performance context
- **Custom Prefixes**: Configure personalized prompts in Settings to guide AI analysis toward specific coaching goals

#### Data Included in Summaries
- **Activity Basics**: Name, type, date, distance, time, speed, elevation
- **Heart Rate Analysis**: Zone distribution percentages, average HR, max HR calculations
- **Effort Metrics**: Relative effort points, intensity factors, physiological weighting
- **Yearly Context**: Complete activity history for the same year with performance trends
- **Performance Patterns**: Activity type distribution, training load analysis, comparative metrics

#### Example Use Cases
- **AI Coaching**: "Analyze this data as a professional running coach and suggest training improvements..."
- **Performance Trends**: "Review my yearly training data and identify patterns in my fitness progression..."
- **Recovery Planning**: "Based on my recent activities and effort scores, recommend optimal recovery strategies..."
- **Goal Setting**: "Help me plan my next training phase based on my current fitness metrics..."

#### Technical Format
Summaries are generated in a structured format that language models can easily parse:
```
Activity: Morning Run (Run) on 2025-08-27 - Distance: 10.5km, Time: 45m 30s, 
HR_zones:[Recovery:15%,Aerobic_Base:35%,Aerobic:30%,Threshold:20%], 
relative_effort:320pts

Year_2025_context: Total_activities:45, Total_distance:456.7km, 
Activity_types:[Run:35,Ride:8,Swim:2], All_year_activities:[...]
```

This enables sophisticated AI analysis of training patterns, performance trends, and personalized coaching recommendations.

## Setup Instructions

### 1. Create a Strava App

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Create a new app or use an existing one
3. Set the **Authorization Callback Domain** to: `localhost` (for development) or your domain for production
4. Note down your **Client ID** and **Client Secret**

### 2. Run the Application

```bash
# Install dependencies
npm install

# Start the development server
npm start
```

The app will open at `http://localhost:3000`

### 3. Configure API Access

1. Go to the **Settings** page
2. Enter your Strava **Client ID** and **Client Secret**
3. Click "Save Settings"
4. Click "Connect to Strava" to authorize the app
5. You'll be redirected to Strava to authorize access
6. After authorization, you'll be redirected back to the app

### 4. Configure Additional Settings

- **Birth Year**: Set your birth year for accurate heart rate zone calculations
- **LLM Summary Prefix**: Customize the prompt prefix for AI analysis (e.g., "Analyze this as a professional coach...")
- **Data Management**: Export/import your activity data for backup or transfer

### 5. Explore Your Data

- Go to **Activities** to see your recent activities
- Click on any activity to view detailed analysis
- Use the "📋 LLM Summary" button to generate AI-ready activity summaries
- Data is automatically cached locally for offline access

## Technical Features

### Frontend Technologies
- **React 18** with TypeScript
- **React Router** for navigation
- **Recharts** for data visualization
- **Dexie** for IndexedDB management
- **CSS Grid & Flexbox** for responsive layout

### Strava API Integration
- OAuth 2.0 authentication flow
- Automatic token refresh
- Activity listing and detailed activity fetching
- Local caching with IndexedDB

### Data Analysis
- Performance metrics (pace, speed, elevation)
- Split analysis with charts
- Heart rate and power data (when available)
- **Heart Rate Zone Analysis**: 5-zone distribution with age-based max HR calculation
- **Relative Effort Scoring**: Physiologically-weighted effort points based on HR zone time distribution
- **LLM Summary Generation**: AI-ready activity summaries with yearly context and custom prompts
- Elevation profile visualization

## Project Structure

```
src/
├── components/
│   ├── Activities.tsx          # Activities list page
│   ├── ActivityDetail.tsx      # Individual activity analysis
│   └── Settings.tsx            # API configuration page
├── services/
│   ├── database.ts             # IndexedDB schema and types
│   └── stravaService.ts        # Strava API integration
├── App.tsx                     # Main app component with routing
├── index.tsx                   # App entry point
└── index.css                   # Global styles
```

## Key Features

### Backendless Architecture
- All data processing happens in the browser
- No server required - deploy to any static hosting
- Data persists locally using IndexedDB

### Smart Caching
- Activities are cached after first fetch
- Offline browsing of previously loaded data
- Automatic cache updates when connected

### Comprehensive Analysis
- Split-by-split performance analysis
- Elevation gain/loss tracking
- Heart rate and power metrics
- Pace and speed analysis with charts

## Browser Compatibility

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- Mobile browsers with IndexedDB support

## Deployment

For production deployment:

1. Update the Strava app settings to include your production domain
2. Build the app: `npm run build`
3. Deploy the `build` folder to any static hosting service
4. Configure HTTPS (required for Strava OAuth)

## Security Notes

- Client Secret is stored locally only (not transmitted except to Strava)
- Access tokens are managed securely with automatic refresh
- All API calls use HTTPS
- No user data is sent to any third-party services (except Strava)
