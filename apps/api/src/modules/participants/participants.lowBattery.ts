import type { PushMessage } from '../notifications/pushSender';

/** The searcher's push when the phone's battery runs low (UC-S04 step 2, decision 45): charge it or head back. */
export function lowBatteryPush(): PushMessage {
  return {
    title: 'סוללה חלשה',
    body: 'הסוללה בטלפון נמוכה. חברו מטען, או חזרו לנקודת הכינוס.',
  };
}
