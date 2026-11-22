/** The mission and missing-person fields the commander edits (UC-C03), in form order. */
export const MISSION_DETAIL_FIELDS = [
  'name',
  'missingPersonName',
  'missingPersonAge',
  'disappearedAt',
  'description',
  'additionalInfo',
] as const;
export type MissionDetailField = (typeof MISSION_DETAIL_FIELDS)[number];

/** The values as stored: text or null, the age, and the disappearance time as an ISO instant or null. */
export interface MissionDetailValues {
  name: string;
  missingPersonName: string | null;
  missingPersonAge: number | null;
  disappearedAt: string | null;
  description: string | null;
  additionalInfo: string | null;
}

/** The field names as the Command form shows them. */
export const MISSION_DETAIL_FIELD_LABELS: Record<MissionDetailField, string> = {
  name: 'שם / מזהה מסע',
  missingPersonName: 'שם הנעדר',
  missingPersonAge: 'גיל',
  disappearedAt: 'זמן היעלמות',
  description: 'תיאור / לבוש',
  additionalInfo: 'מידע רלוונטי',
};

function sameValue(field: MissionDetailField, a: MissionDetailValues, b: MissionDetailValues): boolean {
  if (field === 'disappearedAt') {
    const [before, after] = [a.disappearedAt, b.disappearedAt];
    return before === null || after === null ? before === after : Date.parse(before) === Date.parse(after);
  }
  return a[field] === b[field];
}

/** The fields whose value changed, in MISSION_DETAIL_FIELDS order. Times compare as instants, whatever their offset. */
export function changedMissionDetails(before: MissionDetailValues, after: MissionDetailValues): MissionDetailField[] {
  return MISSION_DETAIL_FIELDS.filter((field) => !sameValue(field, before, after));
}

/** How a change reads to searchers and on the Timeline: "עודכנו: גיל, תיאור / לבוש". */
export function detailChangesText(fields: readonly MissionDetailField[]): string {
  if (fields.length === 0) return 'פרטי המסע והנעדר עודכנו';
  const labels = fields.map((field) => MISSION_DETAIL_FIELD_LABELS[field]).join(', ');
  return fields.length === 1 ? `עודכן: ${labels}` : `עודכנו: ${labels}`;
}
