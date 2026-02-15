// Meal planning: templates, grocery list generation, rotation

export interface MealTemplate {
  id: string;
  name: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
  prep_notes: string;
  prep_time_min: number;
}

export interface DayPlan {
  day: string;
  breakfast: MealTemplate;
  lunch: MealTemplate;
  dinner: MealTemplate;
  snacks: MealTemplate[];
  total_calories: number;
  total_protein_g: number;
}

export const BREAKFAST_TEMPLATES: MealTemplate[] = [
  {
    id: "b1",
    name: "Standard Morning (Your Usual)",
    meal_type: "breakfast",
    calories: 390,
    protein_g: 22,
    carbs_g: 63,
    fat_g: 5,
    ingredients: ["Coffee with cream", "1 banana", "1 cup nonfat Greek yogurt", "1/2 cup blueberries", "2 tbsp Ezekiel cereal"],
    prep_notes: "Your regular routine -- already dialed in",
    prep_time_min: 5,
  },
];

export const LUNCH_TEMPLATES: MealTemplate[] = [
  { id: "l1", name: "Grilled Chicken Salad", meal_type: "lunch", calories: 520, protein_g: 42, carbs_g: 30, fat_g: 22, ingredients: ["6 oz grilled chicken breast", "3 cups mixed greens", "1/4 avocado", "Cherry tomatoes", "2 tbsp vinaigrette"], prep_notes: "Prep chicken in batches on Sunday", prep_time_min: 10 },
  { id: "l2", name: "Turkey & Cheese Wrap", meal_type: "lunch", calories: 480, protein_g: 38, carbs_g: 35, fat_g: 18, ingredients: ["4 oz deli turkey", "1 whole wheat tortilla", "1 slice Swiss cheese", "Lettuce, tomato, mustard", "1 apple"], prep_notes: "Quick assembly, no cooking required", prep_time_min: 5 },
  { id: "l3", name: "Tuna Power Bowl", meal_type: "lunch", calories: 500, protein_g: 45, carbs_g: 40, fat_g: 16, ingredients: ["1 can tuna in water", "1/2 cup brown rice", "1 cup steamed broccoli", "1 tbsp olive oil", "Lemon, salt, pepper"], prep_notes: "Rice can be batch-prepped. Microwave broccoli 3 min.", prep_time_min: 8 },
  { id: "l4", name: "Protein Soup + Bread", meal_type: "lunch", calories: 460, protein_g: 35, carbs_g: 45, fat_g: 14, ingredients: ["2 cups chicken tortilla soup (Costco)", "1 slice Ezekiel bread", "1 string cheese"], prep_notes: "Heat soup, toast bread. Done.", prep_time_min: 5 },
  { id: "l5", name: "Egg & Veggie Scramble", meal_type: "lunch", calories: 440, protein_g: 32, carbs_g: 25, fat_g: 24, ingredients: ["3 eggs", "1/4 cup shredded cheese", "1 cup mixed peppers & onions", "1 slice Ezekiel toast"], prep_notes: "Quick stovetop scramble, 8 min total", prep_time_min: 8 },
];

export const DINNER_TEMPLATES: MealTemplate[] = [
  { id: "d1", name: "Salmon & Roasted Vegetables", meal_type: "dinner", calories: 580, protein_g: 40, carbs_g: 30, fat_g: 30, ingredients: ["6 oz salmon fillet", "2 cups roasted Brussels sprouts", "1/2 sweet potato", "1 tbsp olive oil"], prep_notes: "Sheet pan: 400F for 20 min. Minimal cleanup.", prep_time_min: 25 },
  { id: "d2", name: "Chicken Stir-Fry", meal_type: "dinner", calories: 550, protein_g: 42, carbs_g: 45, fat_g: 18, ingredients: ["6 oz chicken thigh, sliced", "2 cups stir-fry vegetables", "1/2 cup brown rice", "2 tbsp low-sodium soy sauce"], prep_notes: "Wok or large skillet, 15 min cook time", prep_time_min: 20 },
  { id: "d3", name: "Turkey Meatballs & Pasta", meal_type: "dinner", calories: 560, protein_g: 38, carbs_g: 55, fat_g: 18, ingredients: ["5 turkey meatballs (Costco frozen)", "1 cup whole wheat pasta", "1/2 cup marinara sauce", "Side salad with vinaigrette"], prep_notes: "Microwave meatballs, boil pasta. 12 min.", prep_time_min: 15 },
  { id: "d4", name: "Lean Beef Tacos", meal_type: "dinner", calories: 540, protein_g: 36, carbs_g: 40, fat_g: 22, ingredients: ["5 oz 93% lean ground beef", "2 corn tortillas", "1/4 cup black beans", "Salsa, lettuce, lime"], prep_notes: "Brown beef with taco seasoning. 10 min.", prep_time_min: 15 },
  { id: "d5", name: "Rotisserie Chicken Plate", meal_type: "dinner", calories: 520, protein_g: 44, carbs_g: 35, fat_g: 20, ingredients: ["6 oz Costco rotisserie chicken (no skin)", "1 cup roasted potatoes", "1 cup steamed green beans"], prep_notes: "Zero prep if you grab a rotisserie chicken. Reheat sides.", prep_time_min: 5 },
];

export function generateWeeklyPlan(weekOffset: number = 0): DayPlan[] {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const breakfast = BREAKFAST_TEMPLATES[0];

  return days.map((day, i) => {
    const lunchIdx = (i + weekOffset) % LUNCH_TEMPLATES.length;
    const dinnerIdx = (i + weekOffset) % DINNER_TEMPLATES.length;
    const lunch = LUNCH_TEMPLATES[lunchIdx];
    const dinner = DINNER_TEMPLATES[dinnerIdx];

    return {
      day,
      breakfast,
      lunch,
      dinner,
      snacks: [],
      total_calories: breakfast.calories + lunch.calories + dinner.calories,
      total_protein_g: breakfast.protein_g + lunch.protein_g + dinner.protein_g,
    };
  });
}

export function generateGroceryList(plan: DayPlan[]): string[] {
  const ingredientSet = new Set<string>();
  plan.forEach((day) => {
    day.breakfast.ingredients.forEach((i) => ingredientSet.add(i));
    day.lunch.ingredients.forEach((i) => ingredientSet.add(i));
    day.dinner.ingredients.forEach((i) => ingredientSet.add(i));
    day.snacks.forEach((s) => s.ingredients.forEach((i) => ingredientSet.add(i)));
  });
  return Array.from(ingredientSet).sort();
}
