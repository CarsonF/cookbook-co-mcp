/** Raw meal planner row: a planned recipe or free-text note on a date, in a meal slot. */
export interface PlannedMealRow {
  diaryid: number;
  diarydate: string;
  diaryslot: number;
  diaryrecipe: number;
  diaryserving: number;
  diarynote: string | null;
  recipename: string;
}
