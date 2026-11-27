import { create } from 'zustand';
import type { routes } from '../navigation/routes';

/** What an in-app alert is about; the order of the list is the order they were raised, newest first. */
export interface FieldAlert {
  /** One alert per id: raising the same id again replaces it, e.g. the SOS of one sender or the battery. */
  id: string;
  kind: 'low-battery' | 'sos' | 'details';
  title: string;
  text: string;
  /** The screen the alert opens, or null when there is nothing more to see. */
  href: typeof routes.sos | typeof routes.missingPerson | null;
}

interface AlertsState {
  alerts: FieldAlert[];
  raise: (alert: FieldAlert) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

/**
 * The alerts shown over the mission screens while the app is open: low battery, an SOS sent to the searcher and a
 * change of the missing person's details (UC-S04, UC-C14, UC-C03). Kept in memory only: an alert is about now, and
 * whatever it announces is also on its own screen. Not persisted.
 */
export const useAlerts = create<AlertsState>()((set) => ({
  alerts: [],
  raise: (alert) => set((s) => ({ alerts: [alert, ...s.alerts.filter((a) => a.id !== alert.id)] })),
  dismiss: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
  clear: () => set({ alerts: [] }),
}));
