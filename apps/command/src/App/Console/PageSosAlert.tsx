import { SosAlert } from '../../mission/SosAlert';
import type { MissionView } from '../../mission/MissionNav';
import type { MissionData } from './useMissionData';

/**
 * The SOS alert over the searchers, Reports, Messages and Timeline pages (UC-C14: it stays until the SOS is closed).
 * The map floats its own, and the SOS page is where the alert leads.
 */
export function PageSosAlert({
  view,
  sos,
  onOpenSos,
}: {
  view: MissionView;
  sos: MissionData['sos'];
  onOpenSos: () => void;
}) {
  if (view === 'map' || view === 'sos') return null;
  return <SosAlert sos={sos.data} failed={sos.isError} onRetry={() => void sos.refetch()} onOpen={onOpenSos} />;
}
