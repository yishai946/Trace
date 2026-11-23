import type { PointTarget } from '../../map/MissionMap';
import type { usePolygonEdit } from './usePolygonEdit';
import type { useSightingPanel } from './useSightingPanel';

interface SlotSelectionInput {
  polygon: ReturnType<typeof usePolygonEdit>;
  sighting: ReturnType<typeof useSightingPanel>;
  onOpenReport: (id: string) => void;
  onSelectSearcher: (id: string | null) => void;
}

/**
 * What a click on the map opens in the end-side slot: the polygon Inspector, the LKP panel or a searcher's panel
 * share it, so opening one puts the others away.
 */
export function useSlotSelection({ polygon, sighting, onOpenReport, onSelectSearcher }: SlotSelectionInput) {
  const selectPolygon = (polygonId: string | null) => {
    polygon.select(polygonId);
    onSelectSearcher(null);
    if (polygonId) sighting.hide();
  };
  const openLkpPanel = (sightingId: string | null) => {
    polygon.select(null);
    onSelectSearcher(null);
    sighting.show(sightingId);
  };
  const toggleAddSighting = () => {
    if (sighting.adding) return sighting.cancelAdd();
    polygon.select(null);
    onSelectSearcher(null);
    sighting.startAdd();
  };
  const selectPoint = (target: PointTarget) => {
    if (target.kind === 'report') return onOpenReport(target.id);
    if (target.kind === 'searcher') {
      polygon.select(null);
      sighting.hide();
      return onSelectSearcher(target.id);
    }
    openLkpPanel(target.kind === 'sighting' ? target.id : null);
  };
  return { selectPolygon, toggleAddSighting, selectPoint };
}
