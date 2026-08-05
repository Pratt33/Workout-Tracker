# Workout Tracker v5.1

A practical workout logging app focused on consistency, progression tracking, and LLM-ready insights.

## Why I Built This
I wanted a simple app I would actually use every day.

Goals:
- Log workouts quickly with minimal typing.
- Track progress clearly by muscle group.
- Export structured data for deeper LLM analysis.

## Core Features
- Daily split workout flow.
- Set logging with weight, reps, and volume.
- History with time filters.
- Progress charts by muscle.
- Editable exercise names with safe data migration.
- Smart prefill from previous sessions.
- LLM-ready export with annotations and derived metrics.
- Rest-day declaration (including missed-day marking).

## Version 5.1 (Release)

This release (v5.1) covers the v5.x line of work:

- **Data Consistency Fixes**: Exercise renames now persist across *all* sessions, so renamed exercises keep their full history in Progress, History, and exports. Fixed consecutive-rename orphaned data, cardio minute tracking, and exports dropping renamed rows.
- **Settings Redesign**: Settings now uses a proper menu with navigation (workout plan, cardio config, data, rest days, about) instead of one long scroll.
- **Pinned Y-Axis on Charts**: Y-axis labels stay fixed while swiping data horizontally on every Progress chart.
- **UI/UX Polish & Design System**: Added a central design-token system (semantic colors, chart palette, spacing/radius/type scales), refined empty states, consistent touch targets, and accessibility labels. Tighter, balanced Home-screen layout with correct cross-platform row alignment.
- **v4.3 Earlier**: Rest-day crash fix, progress-screen cleanup, and dynamic chart orientation-scaling.

## Main Challenges Faced
- Keeping the data model simple but flexible.
- Preserving history/progress accuracy after exercise renames.
- Balancing UX polish with fast, practical logging.
- Making exports useful for LLM reasoning, not just raw JSON.
- Setting up EAS build and deployment flow correctly.

## Results and Impact
- Faster logging and better workout consistency.
- Clearer visibility into progression and muscle balance.
- Easier identification of weak/undertrained areas.
- Better training decisions using data instead of guesswork.

## Tools Used
- VS Code
- Git and GitHub
- Expo EAS Build
- Expo Go / Android device testing
- PowerShell

## Tech Stack
- React Native
- Expo
- React Navigation (Bottom Tabs)
- AsyncStorage (@react-native-async-storage/async-storage)
- react-native-chart-kit
- react-native-svg
- react-native-safe-area-context

## App Download Link
Android build (v5.1):
- Build details: https://expo.dev/accounts/pratt33/projects/workout-tracker/builds/7a3e1da6-bd79-4f62-b194-e5eea1d7f456
- Direct AAB: https://expo.dev/artifacts/eas/gHuxWR7KTI3PLZtGLJJSxhOHirRMdT-nF2miL7K68z8.aab

## Future Improvements
- Personal best tracking and milestones.
- RPE/RIR and fatigue-aware recommendations.
- Cloud sync and backup.
- Coach-athlete sharing flow.
- Release-size optimization and CI/CD.

## Credits
Developed with vibe and with ME (Pratik Shirsath).
