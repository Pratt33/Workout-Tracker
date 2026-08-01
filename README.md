# Workout Tracker v4.3

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

## Version 4.3 (Release)

This release (v4.3) includes:
- **Pinned Y-Axis on Charts**: Pinned Y-axis labels to the left of chart containers so they remain visible while swiping/scrolling data horizontally.
- **Progress Screen UI Cleanup**: Removed redundant date/weight entry cards in the body weight tracking section to keep the focus solely on the chart visualization.
- **Rest-Day Crash Fix**: Resolved a critical null-pointer crash in `DayLogger` when accessing the application on scheduled rest days (such as Sundays).
- **v4.2 Features**: Dynamic chart orientation-scaling, settings modal scroll persistence, and robust cardio rename migrations.

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
Android build (v4.3):
- Build details: https://expo.dev/accounts/pratt33/projects/workout-tracker/builds/bf1d7853-bb8a-47d2-afa2-e415c2f6d884
- Direct AAB: https://expo.dev/artifacts/eas/_y_rF_easX-4qSPT8eCNhQgLG94YotXDNmw7QrCK6kQ.aab

## Future Improvements
- Personal best tracking and milestones.
- RPE/RIR and fatigue-aware recommendations.
- Cloud sync and backup.
- Coach-athlete sharing flow.
- Release-size optimization and CI/CD.

## Credits
Developed with vibe and with ME (Pratik Shirsath).
