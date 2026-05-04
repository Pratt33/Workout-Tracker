# Workout Tracker v3.0

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

## Version 3.0 (Release)

This release (v3.0) includes the following highlights:
- Inline cardio logging (minutes & km) and inline body-weight logging.
- CSV export from History (Export CSV) alongside existing LLM export.
- UI polish and small accessibility improvements.
- Prepared for Android EAS build.

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
Android preview build:
- https://expo.dev/accounts/pratt33/projects/workout-tracker/builds/aba42879-5944-4c43-b30b-0fd8148152d3

## Future Improvements
- Personal best tracking and milestones.
- RPE/RIR and fatigue-aware recommendations.
- Cloud sync and backup.
- Coach-athlete sharing flow.
- Release-size optimization and CI/CD.

## Credits
Developed with vibe and with ME (Pratik Shirsath).
