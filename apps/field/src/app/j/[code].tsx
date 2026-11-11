import { joinCodeFromLink } from '@trace/domain';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { routes } from '../../navigation/routes';
import { useSession } from '../../state/session';

/**
 * A join link, `<base>/j/<code>` (UC-F02, decision 6). It keeps the code and goes through the start gate, so a
 * searcher who is signed out signs in first; the join screen then opens with the code filled in.
 */
export default function JoinLinkScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const joinCode = joinCodeFromLink(code ?? '');
  const kept = useSession((s) => s.pendingJoinCode === joinCode);
  useEffect(() => useSession.getState().setPendingJoinCode(joinCode), [joinCode]);
  return kept ? <Redirect href={routes.start} /> : null;
}
