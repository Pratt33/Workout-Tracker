export const PLAN = {
  1: {
    label: 'Monday',
    groups: [
      { name: 'Chest', color: '#7B72E8', exercises: ['Bench Press (Barbell)', 'Dumbbell Incline Press', 'Pec Deck / Weighted Dips'] },
      { name: 'Triceps', color: '#E8724A', exercises: ['Skull Crushers', 'Triceps Pressdown (Bar)'] }
    ]
  },
  2: {
    label: 'Tuesday',
    groups: [
      { name: 'Back', color: '#2DBF8E', exercises: ['Barbell Row', 'Lat Pulldown', 'Meadows Row'] },
      { name: 'Biceps', color: '#4A9FE8', exercises: ['Dumbbell Preacher Curl', 'Incline Curl'] }
    ]
  },
  3: {
    label: 'Wednesday',
    groups: [
      { name: 'Shoulders', color: '#E8B84A', exercises: ['Machine Shoulder Press', 'Standing Dumbbell Lateral Raise'] },
      { name: 'Legs', color: '#7ABF3A', exercises: ['Romanian Deadlift (RDL)', 'Leg Press', 'Leg Extension'] }
    ]
  },
  4: {
    label: 'Thursday',
    groups: [
      { name: 'Chest', color: '#7B72E8', exercises: ['Incline Bench Press (Barbell)', 'Dumbbell Bench Press', 'Low-to-High Cable Fly'] },
      { name: 'Triceps', color: '#E8724A', exercises: ['1-Arm Dumbbell Overhead', 'Overhead Cable Tricep Extension'] }
    ]
  },
  5: {
    label: 'Friday',
    groups: [
      { name: 'Back', color: '#2DBF8E', exercises: ['Wide Grip Pull-up / Assisted Alt', 'Cable Row', 'Neutral Grip Lat Pulldown'] },
      { name: 'Biceps', color: '#4A9FE8', exercises: ['Barbell Curl', 'Hammer Curl'] }
    ]
  },
  6: {
    label: 'Saturday',
    groups: [
      { name: 'Shoulders', color: '#E8B84A', exercises: ['Lean Away DB Lateral Raise', 'Face Pulls'] },
      { name: 'Legs', color: '#7ABF3A', exercises: ['Squats'] },
      { name: 'Abs & Forearms', color: '#9A9A9A', exercises: ['Cable Crunch', 'Hanging Leg Raise', "Farmer's Carry"] }
    ]
  },
  0: null
};

export const MUSCLE_COLORS = {
  'Chest': '#7B72E8',
  'Triceps': '#E8724A',
  'Back': '#2DBF8E',
  'Biceps': '#4A9FE8',
  'Shoulders': '#E8B84A',
  'Legs': '#7ABF3A',
  'Abs & Forearms': '#9A9A9A'
};

export const MUSCLES = Object.keys(MUSCLE_COLORS);
