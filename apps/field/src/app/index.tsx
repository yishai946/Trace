import { Redirect } from 'expo-router';
import { routes } from '../navigation/routes';

// Sign-in (UC-F01) decides where a returning searcher lands; until then every start is at the login screen.
export default function Index() {
  return <Redirect href={routes.login} />;
}
