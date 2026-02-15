// ============================================================
// Core Types for Health Tracker App
// ============================================================

// --- User Profile ---
export interface Profile {
  id: string;
  display_name: string;
  age: number;
  sex: 'male' | 'female';
  height_inches: number;
  current_weight: number;
  goal_weight: number;
  target_date: string; // ISO date
  daily_calorie_target: number;
  daily_water_goal_oz: number;
  medical_notes: string;
  preferred_workout_times: string; // e.g. "11am-1pm, after 4pm"
  created_at: string;
  updated_at: string;
}

// --- Weight ---
export interface WeightLog {
  id: string;
  timestamp: string;
  weight: number;
  body_fat_pct: number | null;
  bmi: number | null;
  source: 'withings' | 'apple_health' | 'manual' | 'trendweight';
  created_at: string;
}

// --- Food ---
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink';
export type InputMethod = 'camera' | 'voice' | 'favorite' | 'manual';
export type LapseContext = 'home' | 'restaurant' | 'social' | 'stressed' | 'bored' | 'screen_time' | null;

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
  icon: string; // emoji
  default_calories: number;
  default_protein_g: number;
  default_carbs_g: number;
  default_fat_g: number;
  meal_type: MealType;
  sort_order: number;
}

// --- Workouts ---
export type WorkoutType = 'amt885' | 'mobility' | 'flexibility' | 'walk' | 'other';
export type WorkoutSource = 'precor' | 'apple_health' | 'manual';

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

// --- Mobility ---
export interface MobilityLog {
  id: string;
  date: string;
  routine_type: 'quick_5min' | 'full_10min';
  exercises_completed: string[];
  flexibility_notes: string | null;
  pain_level: number; // 1-5
  created_at: string;
}

// --- Water ---
export interface WaterLog {
  id: string;
  timestamp: string;
  amount_oz: number;
  created_at: string;
}

// --- Progress Photos ---
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

// --- Body Measurements ---
export interface BodyMeasurement {
  id: string;
  date: string;
  waist: number | null;
  chest: number | null;
  hips: number | null;
  notes: string | null;
  created_at: string;
}

// --- Daily Summary ---
export interface DailySummary {
  id: string;
  date: string;
  steps: number;
  active_calories: number;
  resting_hr: number | null;
  sleep_hours: number | null;
  total_calories_in: number;
  total_calories_burned: number;
  calorie_balance: number;
  water_oz: number;
  mobility_done: boolean;
  streak_day_count: number;
}

// --- Streaks ---
export interface Streak {
  id: string;
  current_streak: number;
  longest_streak: number;
  last_check_in_date: string | null;
  streak_freezes_remaining: number;
  streak_freezes_used: number;
}

// --- Coach Messages ---
export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// --- Plans ---
export interface WeeklyPlan {
  id: string;
  week_start: string;
  workout_schedule: object;
  nutrition_targets: object;
  mobility_goals: object;
  notes: string | null;
  created_at: string;
}

// --- Claude Food Analysis Response ---
export interface FoodAnalysisResult {
  items: FoodItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  portion_assessment: string;
  suggestion: string;
}

// --- Dashboard Summary (computed) ---
export interface DashboardData {
  today: {
    caloriesConsumed: number;
    calorieTarget: number;
    caloriesRemaining: number;
    waterOz: number;
    waterGoalOz: number;
    mobilityDone: boolean;
    workoutsDone: number;
  };
  weight: {
    current: number;
    goal: number;
    startWeight: number;
    trend: WeightLog[];
  };
  streak: Streak;
  recentFoodLogs: FoodLog[];
  recentWorkouts: Workout[];
}
