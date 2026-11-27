import { useState } from 'react';
import type { MissionView } from '../../mission/MissionNav';

/**
 * The panels opened from the app bar: the join code (UC-C02), the rally point (UC-C05) the mission details
 * (UC-C03) and the mission control (UC-C16). They share one corner, and the details cover the map, so only one is open at a time.
 */
export type ConsolePanel = 'join' | 'rally' | 'details' | 'control';

/** Where the commander is in the console: which mission, which of its views, and which panel is open over it. */
export function useConsoleNav() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [panel, setPanel] = useState<ConsolePanel | null>(null);
  const [createdNotice, setCreatedNotice] = useState<string | null>(null);
  /** The live map or one of the pages. The Timeline is also open for an ended mission, read-only (UC-C19). */
  const [view, setView] = useState<MissionView>('map');
  /** The report open in the Reports page; the alert and the map symbols open it. */
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  /** The searcher whose panel is open over the map (UC-C10); the table and the map symbols open it. */
  const [selectedSearcherId, setSelectedSearcherId] = useState<string | null>(null);

  return {
    openId,
    creating,
    panel,
    createdNotice,
    view,
    selectedReportId,
    selectedSearcherId,
    setSelectedSearcherId,
    setView,
    setSelectedReportId,
    setCreating,
    /** Opens a mission on its map, or the mission list with `null`. */
    openMission: (id: string | null) => {
      setOpenId(id);
      setView('map');
      setSelectedReportId(null);
      setSelectedSearcherId(null);
      setPanel(null);
      setCreatedNotice(null);
    },
    /** A mission just created opens with its join code showing (UC-C02 step 4). */
    openCreated: (id: string, notice: string | null) => {
      setCreating(false);
      setOpenId(id);
      setPanel('join');
      setCreatedNotice(notice);
    },
    togglePanel: (target: ConsolePanel) => setPanel((current) => (current === target ? null : target)),
    /** Opens the panel in place of any other, or closes it if it is the open one. */
    setPanelOpen: (target: ConsolePanel, open: boolean) =>
      setPanel((current) => (open ? target : current === target ? null : current)),
    /** The alert opens the SOS page, or the SOS screen on the phone. */
    openSos: () => setView('sos'),
    /** Shows a searcher's panel on the map. */
    openSearcher: (id: string) => {
      setSelectedSearcherId(id);
      setView('map');
    },
    /** Opens the mission control over the map, where the commander verifies and ends the mission (UC-C16). */
    openControl: () => {
      setView('map');
      setPanel('control');
    },
    openReport: (id: string) => {
      setSelectedReportId(id);
      setView('reports');
    },
  };
}

export type ConsoleNav = ReturnType<typeof useConsoleNav>;
