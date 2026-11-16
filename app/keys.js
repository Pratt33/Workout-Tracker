// Single source of truth for AsyncStorage keys.
//
// Schema policy:
// - This release starts the new data model from scratch and archives any older
//   data under `legacyArchive`. Nothing from v5 is converted.
// - From now on, schema changes must be *additive migrations*: read the stored
//   value, upgrade it in place, and write it back without discarding sessions.
//   `app_meta_v1.schemaVersion` is the marker used to run those migrations.
export const STORAGE_KEYS = {
  sessions: "workout_sessions_v1",
  plan: "custom_exercises_v1",
  cardioConfig: "cardio_config_v1",
  restDays: "rest_days_v1",
  assignments: "day_assignments_v1",
  catalog: "exercise_catalog_v1",
  meta: "app_meta_v1",
  legacyArchive: "workout_legacy_archive_v1",
};

// Keys that only the old app wrote. They are read once so the first launch can
// archive them, then removed.
export const LEGACY_STORAGE_KEYS = {
  overrides: "day_overrides_v1",
};

export const SCHEMA_VERSION = 1;
