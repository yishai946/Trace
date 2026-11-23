import { joinCodeFromLink } from '@trace/domain';
import { JoinLandingPage } from '../../pages/JoinLandingPage';
import { Launch } from '../Launch';

/**
 * What the address opens: the page at a join link, `/j/<code>`, which needs no sign-in because the visitor is a
 * searcher without the Field app (UC-F02); any other address is the console.
 */
export function Entry() {
  const code = joinCodeFromLink(window.location.pathname);
  return code ? <JoinLandingPage code={code} /> : <Launch />;
}
