type FieldValue = string | number | boolean | null;
export type Fields = Record<string, FieldValue>;

export interface FsDoc {
  id: string;
  data: Fields;
}
