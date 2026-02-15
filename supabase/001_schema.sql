-- ============================================================
-- Health Tracker Database Schema
-- ============================================================

-- gen_random_uuid() is built-in on Neon (and Postgres 13+), no extension needed

-- --- Profiles ---
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL DEFAULT 'User',
  age INTEGER NOT NULL DEFAULT 55,
  sex TEXT NOT NULL DEFAULT 'male' CHECK (sex IN ('male', 'female')),
  height_inches NUMERIC NOT NULL DEFAULT 69, -- 5'9"
  current_weight NUMERIC NOT NULL DEFAULT 220,
  goal_weight NUMERIC NOT NULL DEFAULT 185,
  target_date DATE NOT NULL DEFAULT '2026-12-31',
  daily_calorie_target INTEGER NOT NULL DEFAULT 1800,
  daily_water_goal_oz INTEGER NOT NULL DEFAULT 64,
  medical_notes TEXT DEFAULT 'Forestier''s disease (DISH) with osteoarthritis in back and hips',
  preferred_workout_times TEXT DEFAULT '11am-1pm, after 4pm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Weight Logs ---
CREATE TABLE weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  weight NUMERIC NOT NULL,
  body_fat_pct NUMERIC,
  bmi NUMERIC,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('withings', 'manual', 'trendweight')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Food Favorites ---
CREATE TABLE food_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🍽️',
  default_calories INTEGER NOT NULL,
  default_protein_g NUMERIC NOT NULL DEFAULT 0,
  default_carbs_g NUMERIC NOT NULL DEFAULT 0,
  default_fat_g NUMERIC NOT NULL DEFAULT 0,
  meal_type TEXT NOT NULL DEFAULT 'snack' CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'drink')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Food Logs ---
CREATE TABLE food_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'drink')),
  photo_url TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  total_calories INTEGER NOT NULL DEFAULT 0,
  protein_g NUMERIC NOT NULL DEFAULT 0,
  carbs_g NUMERIC NOT NULL DEFAULT 0,
  fat_g NUMERIC NOT NULL DEFAULT 0,
  portion_notes TEXT,
  input_method TEXT NOT NULL DEFAULT 'manual' CHECK (input_method IN ('camera', 'voice', 'favorite', 'manual')),
  lapse_context TEXT CHECK (lapse_context IN ('home', 'restaurant', 'social', 'stressed', 'bored', 'screen_time')),
  confirmed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Workouts ---
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL DEFAULT 'amt885' CHECK (type IN ('amt885', 'mobility', 'flexibility', 'walk', 'other')),
  duration_min INTEGER NOT NULL DEFAULT 0,
  calories_burned INTEGER NOT NULL DEFAULT 0,
  avg_hr INTEGER,
  distance NUMERIC,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('precor', 'apple', 'manual')),
  notes TEXT,
  google_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Mobility Logs ---
CREATE TABLE mobility_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  routine_type TEXT NOT NULL CHECK (routine_type IN ('quick_5min', 'full_10min')),
  exercises_completed JSONB NOT NULL DEFAULT '[]',
  flexibility_notes TEXT,
  pain_level INTEGER NOT NULL DEFAULT 3 CHECK (pain_level BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Water Logs ---
CREATE TABLE water_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount_oz INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Progress Photos ---
CREATE TABLE progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  photo_url TEXT NOT NULL,
  weight_at_time NUMERIC,
  waist_in NUMERIC,
  chest_in NUMERIC,
  hips_in NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Body Measurements ---
CREATE TABLE body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  waist NUMERIC,
  chest NUMERIC,
  hips NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Daily Summaries ---
CREATE TABLE daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  steps INTEGER NOT NULL DEFAULT 0,
  active_calories INTEGER NOT NULL DEFAULT 0,
  resting_hr INTEGER,
  sleep_hours NUMERIC,
  total_calories_in INTEGER NOT NULL DEFAULT 0,
  total_calories_burned INTEGER NOT NULL DEFAULT 0,
  calorie_balance INTEGER NOT NULL DEFAULT 0,
  water_oz INTEGER NOT NULL DEFAULT 0,
  mobility_done BOOLEAN NOT NULL DEFAULT false,
  streak_day_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Streaks ---
CREATE TABLE streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_check_in_date DATE,
  streak_freezes_remaining INTEGER NOT NULL DEFAULT 1,
  streak_freezes_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Coach Messages ---
CREATE TABLE coach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Weekly Plans ---
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  workout_schedule JSONB NOT NULL DEFAULT '{}',
  nutrition_targets JSONB NOT NULL DEFAULT '{}',
  mobility_goals JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- OAuth Tokens (for Withings, Google Calendar) ---
CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE CHECK (provider IN ('withings', 'google')),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Sync Logs ---
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('withings', 'apple_health', 'precor', 'google_calendar')),
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  records_synced INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Indexes for common queries ---
CREATE INDEX idx_weight_logs_timestamp ON weight_logs(timestamp DESC);
CREATE INDEX idx_food_logs_timestamp ON food_logs(timestamp DESC);
CREATE INDEX idx_food_logs_date ON food_logs(DATE(timestamp));
CREATE INDEX idx_workouts_timestamp ON workouts(timestamp DESC);
CREATE INDEX idx_water_logs_timestamp ON water_logs(timestamp DESC);
CREATE INDEX idx_water_logs_date ON water_logs(DATE(timestamp));
CREATE INDEX idx_daily_summaries_date ON daily_summaries(date DESC);
CREATE INDEX idx_mobility_logs_date ON mobility_logs(date DESC);
CREATE INDEX idx_progress_photos_date ON progress_photos(date DESC);
CREATE INDEX idx_coach_messages_created ON coach_messages(created_at DESC);
