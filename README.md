# Workout Tracker v6.0

A practical workout logging app focused on consistency, progression tracking, and LLM-ready insights.

## Why I Built This
I wanted a simple app I would actually use every day.

Goals:
- Log workouts quickly with minimal typing.
- Track progress clearly by muscle group.
- Export structured data for deeper LLM analysis.

## Core Features
- Flexible 5-workout PPL-UL rotation: Push, Pull, Legs, Upper, Lower.
- No fixed weekdays: choose any 2 rest days each week.
- Each workout starts with 5 or more exercises; add more any time and remove any of them later.
- Adding an exercise lets you choose its muscle group and whether it is tracked by reps or time.
- Exercise variants (for example Cable Crossover High-to-Low vs Low-to-High) are separate exercises with separate history.
- Rotation continues from your last logged workout, so rest days never skip a workout. After a 7+ day break it restarts at Push.
- Set logging with weight, reps, volume, and prefilled values from the last session.
- Timed strength exercises store seconds per set; any exercise can be switched to time tracking.
- Cardio logging supports duration, distance, speed, and incline.
- History with time filters and per-session editing.
- Progress charts by muscle, body weight, and cardio metrics.
- Global exercise renames that keep all past sessions connected.
- Smart prefill from previous sessions.
- JSON backup/restore plus CSV and LLM-ready exports.

## Version 6.0 (Release)

- **Flexible PPL-UL split**: Replaced the fixed 6-day weekday split with five stable workout templates and a rotation driven by the last logged workout.
- **Any 2 rest days**: Rest days can be any two days in the week. They do not consume a rotation slot, so the next training day simply continues the sequence. Log a workout on a rest-marked date at any time and the rest mark is removed.
- **Exercise menus**: Every workout ships with at least 5 exercises, and any workout can hold more. Add another exercise in Settings, choose its muscle group and whether it tracks reps or time, and remove it later. Variants are separate exercises, so alternating Cable Crossover directions or row variations keeps each variant's own history.
- **Logged-only history**: A past session shows only what you actually logged. "Log more exercises" opens the same logger for that date when you want to add more.
- **7-day reset**: If the last logged workout is 7 or more days old, the rotation restarts at Push so a skipped week is easy to resume.
- **Fresh start in 6.0**: History begins with this model. Any older data is archived on the device under a single legacy key instead of being converted. From here on, schema changes are additive migrations, so future updates keep every session.
- **Timed exercises**: Any exercise can be switched between reps and time in Settings and stores seconds per set.
- **Walking improvements**: Walking tracks duration, distance, speed, and incline. Progress can chart any of those metrics.
- **Safer data**: Paste-to-restore JSON backups, CSV/LLM exports, silent-error fixes, extra-set preservation, and rest-day clears when a workout is logged.
- **Smaller fixes**: Local-date handling (no UTC day shifts), local ISO week grouping, correct rename propagation, and empty entries no longer count as completed exercises.

## Main Challenges Faced
- Keeping the data model simple but flexible.
- Preserving history/progress accuracy after exercise renames.
- Designing a data model that keeps future history intact without carrying old migrations.
- Balancing UX polish with fast, practical logging.
- Making exports useful for LLM reasoning, not just raw JSON.

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
Android build for v6.0.0: add the new EAS build link after publishing.

Previous v5.1 build:
- https://expo.dev/accounts/pratt33/projects/workout-tracker/builds/7a3e1da6-bd79-4f62-b194-e5eea1d7f456

## Future Improvements
- Personal best tracking and milestones.
- RPE/RIR and fatigue-aware recommendations.
- Cloud sync and backup.
- Coach-athlete sharing flow.
- Release-size optimization and CI/CD.

## Credits
Developed with vibe and with ME (Pratik Shirsath).
