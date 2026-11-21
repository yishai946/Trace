import { isCriticalReport } from '@trace/domain';
import type { LkpPoint, Mission, MissionPolygon, Participant, Report, Sighting } from '@trace/schemas';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapFocus } from '../../map/MissionMap';
import { filterByChip, initialReportsView, statusCounts, type ReportChip } from '../../mission/reportView';
import { toMapData } from '../../mission/toMapData';

interface Input {
  /** Newest first. Undefined while they load. */
  reports: Report[] | undefined;
  mission: Mission;
  polygons: MissionPolygon[];
  participants: Participant[];
  sightings: Sighting[] | undefined;
  lkps: LkpPoint[] | undefined;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/**
 * A critical report that arrived while the screen was open: its card shows, even over another selection. The reports
 * already there when the screen opened are not new. `onArrived` runs when one arrives, to bring the closed card back.
 */
function useArrivedCritical(reports: Report[] | undefined, onArrived: () => void) {
  const [arrivedId, setArrivedId] = useState<string | null>(null);
  /** The critical reports already seen; null until the reports load. */
  const [seen, setSeen] = useState<Set<string> | null>(null);
  if (reports) {
    const critical = reports.filter(isCriticalReport).map((r) => r.id);
    const fresh = seen ? critical.filter((id) => !seen.has(id)) : [];
    if (!seen || fresh.length > 0) {
      setSeen(new Set([...(seen ?? []), ...critical]));
      if (fresh.length > 0) {
        onArrived();
        setArrivedId(fresh[0] ?? null);
      }
    }
  }
  return { arrivedId, clearArrived: () => setArrivedId(null) };
}

/**
 * What the phone Reports screen shows: the filtered list, the one report whose card is open (a critical report that
 * just arrived takes the card), and the map with its focus.
 */
export function usePhoneReports({
  reports,
  mission,
  polygons,
  participants,
  sightings,
  lkps,
  selectedId,
  onSelect,
}: Input) {
  const [view, setView] = useState<'list' | 'map'>('list');
  const [chip, setChip] = useState<ReportChip>('all');
  /** The commander closed the card; choosing a report shows it again. */
  const [closed, setClosed] = useState(false);
  /** The report the commander just chose: its card takes focus. */
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const listRef = useRef<HTMLElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const all = reports ?? [];
  const counts = statusCounts(all);
  const visible = useMemo(() => filterByChip(reports ?? [], chip), [reports, chip]);

  const { arrivedId, clearArrived } = useArrivedCritical(reports, () => setClosed(false));

  const shown = closed
    ? null
    : (visible.find((r) => r.id === arrivedId) ??
      visible.find((r) => r.id === selectedId) ??
      visible.find(isCriticalReport) ??
      null);
  const rows = visible.filter((r) => r.id !== shown?.id);

  const select = (id: string) => {
    onSelect(id);
    setClosed(false);
    clearArrived();
    setFocusId(id);
    setFitted(true);
    const report = all.find((r) => r.id === id);
    if (report) setFocus({ center: report.position.coordinates });
  };

  // The map opens on everything the mission placed: polygons, rally point, LKP and reports. Read once, at mount.
  const [initialView] = useState(() => initialReportsView({ mission, polygons, reports: all }));
  // Opened while they still load: fit the map once when the first reports or polygons arrive, never after that.
  const hasData = all.length > 0 || polygons.length > 0;
  const [fitted, setFitted] = useState(hasData);
  if (hasData && !fitted) {
    setFitted(true);
    const { center, bounds } = initialReportsView({ mission, polygons, reports: all });
    setFocus((current) => current ?? { center, bounds });
  }
  const data = useMemo(
    () =>
      toMapData({
        mission,
        polygons,
        participants,
        sightings: sightings ?? [],
        lkps: lkps ?? [],
        reports: visible,
        selectedPolygonId: null,
        editingPolygonId: null,
      }),
    [mission, polygons, participants, sightings, lkps, visible],
  );

  // When the card that had focus goes away (closed, handled, or the screen just opened from the alert), focus would
  // fall to the page: move it to the card that shows, or to the heading.
  const shownId = shown?.id;
  const shownStatus = shown?.status;
  useEffect(() => {
    if (document.activeElement && document.activeElement !== document.body) return;
    (root.current?.querySelector<HTMLElement>('[data-report-card]') ?? heading.current)?.focus();
  }, [shownId, shownStatus]);

  return {
    view,
    setView,
    chip,
    setChip,
    setClosed,
    focusId,
    focus,
    listRef,
    root,
    heading,
    counts,
    visible,
    shown,
    rows,
    select,
    initialView,
    data,
  };
}
