-- ============================================================
-- Seed Food Favorites (pre-loaded with known daily items)
-- ============================================================

INSERT INTO food_favorites (name, icon, default_calories, default_protein_g, default_carbs_g, default_fat_g, meal_type, sort_order) VALUES
  ('Morning Coffee', '☕', 35, 1, 1, 2, 'breakfast', 1),
  ('Banana', '🍌', 105, 1, 27, 0, 'breakfast', 2),
  ('Greek Yogurt Bowl', '🥣', 250, 20, 35, 3, 'breakfast', 3),
  ('Glass of Water', '💧', 0, 0, 0, 0, 'drink', 4),
  ('Glass of Wine', '🍷', 125, 0, 4, 0, 'drink', 5),
  ('Whiskey (neat)', '🥃', 100, 0, 0, 0, 'drink', 6);

-- Seed initial profile
INSERT INTO profiles (display_name, age, sex, height_inches, current_weight, goal_weight, target_date, daily_calorie_target, daily_water_goal_oz, medical_notes, preferred_workout_times)
VALUES (
  'David',
  55,
  'male',
  69,
  220,
  185,
  '2026-12-31',
  1800,
  64,
  'Forestier''s disease (DISH) with osteoarthritis in back and hips. Impaired mobility. Focus on low-impact exercise only.',
  '11am-1pm, after 4pm'
);

-- Seed initial streak record
INSERT INTO streaks (current_streak, longest_streak, streak_freezes_remaining)
VALUES (0, 0, 1);
