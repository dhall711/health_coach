// ============================================================
// Core Types for Health Tracker App
// Shared between web and mobile
// ============================================================

export interface Profile {
  id: string;
  display_name: string;
  age: number;
  sex: "male" | "female";
  height_inches: number;
  current_weight: number;
  goal_weight: number;
  target_date: string;
  daily_calorie_target: number;
  daily_water_goal_oz: number;
  medical_notes: string;
  preferred_workout_times: string;
  created_at: string;
  updated_at: string;
}

export interface WeightLog {
  id: string;
  timestamp: string;
  weight: number;
  body_fat_pct: number | null;
  bmi: number | null;
  source: "withings" | "manual" | "apple_health";
  created_at: string;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "drink";
export type InputMethod = "camera" | "voice" | "favorite" | "manual";
export type LapseContext = "home" | "restaurant" | "social" | "stressed" | "bored" | "screen_time" | null;

export interface FoodItem {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion_size: string;
  portion_notes: string;
}

export interface FoodLog {
  id: string;
  timestamp: string;
  meal_type: MealType;
  photo_url: string | null;
  items: FoodItem[];
  total_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion_notes: string | null;
  input_method: InputMethod;
  lapse_context: LapseContext;
  confirmed: boolean;
  created_at: string;
}

export interface FoodFavorite {
  id: string;
  name: string;
  icon: string;
  default_calories: number;
  default_protein_g: number;
  default_carbs_g: number;
  default_fat_g: number;
  meal_type: MealType;
  sort_order: number;
}

export type WorkoutType = "amt885" | "mobility" | "flexibility" | "walk" | "other";
export type WorkoutSource = "precor" | "apple" | "manual" | "apple_health";

export interface Workout {
  id: string;
  timestamp: string;
  type: WorkoutType;
  duration_min: number;
  calories_burned: number;
  avg_hr: number | null;
  distance: number | null;
  source: WorkoutSource;
  notes: string | null;
  google_event_id: string | null;
  created_at: string;
}

export interface WaterLog {
  id: string;
  timestamp: string;
  amount_oz: number;
  created_at: string;
}

export interface Streak {
  id: string;
  current_streak: number;
  longest_streak: number;
  last_check_in_date: string | null;
  streak_freezes_remaining: number;
  streak_freezes_used: number;
}

export interface MobilityLog {
  id: string;
  date: string;
  routine_type: "quick_5min" | "full_10min";
  exercises_completed: string[];
  flexibility_notes: string | null;
  pain_level: number;
  created_at: string;
}

export interface ProgressPhoto {
  id: string;
  date: string;
  photo_url: string;
  weight_at_time: number | null;
  waist_in: number | null;
  chest_in: number | null;
  hips_in: number | null;
  notes: string | null;
  created_at: string;
}

export interface FoodAnalysisResult {
  items: FoodItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  portion_assessment: string;
  suggestion: string;
}
