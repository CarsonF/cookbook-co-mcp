import type { Tool } from '../define.js';
import { getPlannedMeals } from './get-planned-meals.js';
import { scheduleMeal } from './schedule-meal.js';
import { unscheduleMeal } from './unschedule-meal.js';
import { updatePlannedMeal } from './update-planned-meal.js';

export const mealPlanTools: Tool[] = [
  scheduleMeal,
  updatePlannedMeal,
  unscheduleMeal,
  getPlannedMeals,
];
