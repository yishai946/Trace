import type { Sos } from '@trace/schemas';
import styles from './EndedSummary.module.css';

const sosText = (sos: Sos[]) => {
  const active = sos.filter((s) => s.status === 'active').length;
  if (sos.length === 0) return '0';
  return active > 0 ? `${sos.length}, ${active} פעילים` : `${sos.length}, טופל`;
};

interface CountsProps {
  /** Each count is undefined while its list is unavailable; it then shows a dash, not zero. */
  searchers: number | undefined;
  polygons: number | undefined;
  reports: number | undefined;
  sos: Sos[] | undefined;
  /** The number of assignments (decision 53); omitted where the history is not shown. */
  assignments?: number;
}

const count = (n: number | undefined) => n ?? '—';

/** The final numbers of the mission. */
export function Counts({ searchers, polygons, reports, sos, assignments }: CountsProps) {
  return (
    <section className={styles.section} aria-label="מספרים סופיים">
      <dl className={styles.facts}>
        <dt>מחפשים</dt>
        <dd>{count(searchers)}</dd>
        <dt>פוליגונים</dt>
        <dd>{count(polygons)}</dd>
        <dt>דיווחים</dt>
        <dd>{count(reports)}</dd>
        {assignments !== undefined && (
          <>
            <dt>שיבוצים</dt>
            <dd>{assignments}</dd>
          </>
        )}
        <dt>SOS</dt>
        <dd>{sos ? sosText(sos) : '—'}</dd>
      </dl>
    </section>
  );
}
