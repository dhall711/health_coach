// Calorie and TDEE calculations for weight loss planning

/**
 * Mifflin-St Jeor equation for Basal Metabolic Rate
 * Most accurate for overweight individuals
 */
export function calculateBMR(
  weightLbs: number,
  heightInches: number,
  ageYears: number,
  sex: 'male' | 'female'
): number {
  const weightKg = weightLbs * 0.453592;
  const heightCm = heightInches * 2.54;

  if (sex === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
  } else {
    return 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
  }
}

/**
 * Total Daily Energy Expenditure
 * Activity multipliers:
 *   sedentary: 1.2
 *   lightly active: 1.375 (light exercise 1-3 days/week)
 *   moderately active: 1.55 (moderate exercise 3-5 days/week)
 *   very active: 1.725
 */
export function calculateTDEE(
  bmr: number,
  activityLevel: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' = 'lightly_active'
): number {
  const multipliers = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
  };
  return Math.round(bmr * multipliers[activityLevel]);
}

/**
 * Calculate daily calorie target for weight loss
 * @param tdee - Total Daily Energy Expenditure
 * @param weeklyLossLbs - Target weekly weight loss (default 1 lb/week = 500 cal/day deficit)
 * @param minCalories - Minimum safe calories (default 1500 for men)
 */
export function calculateCalorieTarget(
  tdee: number,
  weeklyLossLbs: number = 1,
  minCalories: number = 1500
): number {
  const dailyDeficit = weeklyLossLbs * 500; // 3500 cal per lb / 7 days
  return Math.max(Math.round(tdee - dailyDeficit), minCalories);
}

/**
 * Calculate macro targets in grams
 * @param calorieTarget - Daily calorie target
 * @param proteinPct - Protein percentage (default 30%)
 * @param carbsPct - Carbs percentage (default 40%)
 * @param fatPct - Fat percentage (default 30%)
 */
export function calculateMacros(
  calorieTarget: number,
  proteinPct: number = 0.30,
  carbsPct: number = 0.40,
  fatPct: number = 0.30
) {
  return {
    protein_g: Math.round((calorieTarget * proteinPct) / 4), // 4 cal per gram
    carbs_g: Math.round((calorieTarget * carbsPct) / 4),     // 4 cal per gram
    fat_g: Math.round((calorieTarget * fatPct) / 9),         // 9 cal per gram
  };
}

/**
 * Calculate projected goal date based on current trajectory
 */
export function calculateProjectedGoalDate(
  currentWeight: number,
  goalWeight: number,
  weeklyLossRate: number = 1 // lbs per week
): Date {
  const lbsToLose = currentWeight - goalWeight;
  const weeksNeeded = lbsToLose / weeklyLossRate;
  const today = new Date();
  const goalDate = new Date(today);
  goalDate.setDate(goalDate.getDate() + Math.ceil(weeksNeeded * 7));
  return goalDate;
}

/**
 * Calculate BMI
 */
export function calculateBMI(weightLbs: number, heightInches: number): number {
  return Math.round((weightLbs / (heightInches * heightInches)) * 703 * 10) / 10;
}

/**
 * Get default profile calculations for the user
 */
export function getDefaultProfileCalcs() {
  const bmr = calculateBMR(220, 69, 55, 'male'); // ~1,850
  const tdee = calculateTDEE(bmr, 'lightly_active'); // ~2,540
  const calorieTarget = calculateCalorieTarget(tdee, 1); // ~2,040
  const macros = calculateMacros(calorieTarget);
  const bmi = calculateBMI(220, 69);
  const projectedDate = calculateProjectedGoalDate(220, 185);

  return {
    bmr,
    tdee,
    calorieTarget: Math.min(calorieTarget, 1800), // Cap at 1800 as per plan
    macros,
    bmi,
    projectedDate,
  };
}
