# Health Coach Doug - Mobile App

Native iOS app for Health Coach Doug, built with React Native + Expo.

## Architecture

- **Frontend**: React Native with Expo Router (tab navigation)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Backend**: Shared Vercel-hosted Next.js API (same as web app)
- **Database**: Neon Postgres (accessed via API endpoints)
- **AI**: Claude API via backend endpoints
- **Health Data**: Apple HealthKit via `@kingstinct/react-native-healthkit`
- **Camera**: `expo-image-picker` for food photo analysis

## Screens

| Tab | Description |
|-----|-------------|
| Today | Mission Control dashboard with greeting, AI coach, daily plan, calories, hydration, goal progress |
| Track | Log food (camera/text/favorites), weight, workouts, water |
| Insights | Weight trends, calorie averages, pattern analysis |
| Plan | Configurable workout schedule, daily/weekly targets |
| Coach | AI daily review, weekly summary, free chat |

## Getting Started

### Prerequisites

- Node.js 18+
- Xcode 15+ (for iOS simulator)
- Apple Developer account (for device builds)
- EAS CLI: `npm install -g eas-cli`

### Development

```bash
cd mobile
npm install
npx expo start
```

### iOS Simulator Build

```bash
eas build --profile development --platform ios
```

### Device Build (TestFlight)

```bash
eas build --profile preview --platform ios
```

## API Configuration

The mobile app connects to the Vercel-hosted backend. Edit `lib/api.ts` to switch between development and production:

```typescript
const USE_PROD = true;  // false = localhost:3000
```

## HealthKit Integration

On first launch, the app requests permission to read:
- Step count
- Active energy burned
- Body mass (weight from Withings via HealthKit)
- Heart rate / resting heart rate
- Workout sessions
- Sleep analysis

This replaces the need for the "Health Auto Export" third-party app used by the web version.
