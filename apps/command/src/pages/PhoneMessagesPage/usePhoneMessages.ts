import type { Message } from '@trace/schemas';
import { useState } from 'react';
import type { Key } from 'react-aria-components';
import { choose } from '../../choose';

const TABS = ['new', 'sent'] as const;
export type PhoneMessagesTab = (typeof TABS)[number];

/** Which half of the screen shows, and which sent message's recipients are open. */
export function usePhoneMessages(messages: Message[] | undefined) {
  const [tab, setTab] = useState<PhoneMessagesTab>('new');
  const [detailId, setDetailId] = useState<string | null>(null);
  // Back from the detail: the list takes focus once it renders.
  const [returning, setReturning] = useState(false);
  // A message that is gone from the list closes its detail.
  const detail = detailId === null ? undefined : messages?.find((m) => m.id === detailId);

  return {
    tab,
    detail,
    returning,
    selectTab: (key: Key) => {
      setTab(choose(TABS, key, 'new'));
      setDetailId(null);
      setReturning(false);
    },
    openDetail: (id: string) => {
      setDetailId(id);
      setTab('sent');
      setReturning(false);
    },
    closeDetail: () => {
      setDetailId(null);
      setReturning(true);
    },
  };
}
