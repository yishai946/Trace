import { SearcherPanel } from '../../mission/SearcherPanel';
import styles from '../App.module.css';
import type { useSearcherPanel } from './useSearcherPanel';

interface SearcherSlotProps {
  panel: ReturnType<typeof useSearcherPanel>;
  /** A polygon is open or being reshaped: its panel holds the end-side slot. */
  taken: boolean;
  onClose: () => void;
}

/** The searcher's panel in the end-side slot of the map (UC-C10), unless a polygon panel is there. */
export function SearcherSlot({ panel, taken, onClose }: SearcherSlotProps) {
  if (!panel.searcher || taken) return null;
  return (
    <div className={`${styles.inspector} ${styles.scrolling}`}>
      <SearcherPanel
        searcher={panel.searcher}
        polygonName={panel.polygonName}
        historical={panel.historical}
        routeMeters={panel.routeMeters}
        routeFailed={panel.routeFailed}
        onRetryRoute={panel.retryRoute}
        onClose={onClose}
      />
    </div>
  );
}
