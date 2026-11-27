import type { Report, Sos } from '@trace/schemas';
import styles from './EndedSummary.module.css';

const sosText = (sos: Sos[]) => {
  const active = sos.filter((s) => s.status === 'active').length;
  if (sos.length === 0) return '0';
  return active > 0 ? `${sos.length}, ${active} פעילים` : `${sos.length}, טופל`;
};

interface CountsProps {
  searchers: number;
  polygons: number;
  reports: Report[];
  sos: Sos[];
}

/** The final numbers of the mission. */
export function Counts({ searchers, polygons, reports, sos }: CountsProps) {
  return (
    <section className={styles.section} aria-label="מספרים סופיים">
      <dl className={styles.facts}>
        <dt>מחפשים</dt>
        <dd>{searchers}</dd>
        <dt>פוליגונים</dt>
        <dd>{polygons}</dd>
        <dt>דיווחים</dt>
        <dd>{reports.length}</dd>
        <dt>SOS</dt>
        <dd>{sosText(sos)}</dd>
      </dl>
    </section>
  );
}
