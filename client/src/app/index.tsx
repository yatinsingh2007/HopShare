import { Redirect } from 'expo-router';
import { useSession } from '@/context/AuthContext';
import { Loading } from '@/components/Loading';
import { useMe } from '@/hooks/useMe';

/**
 * The app opens here, and lands here again after every sign-in, sign-up or sign-out.
 * Only riders we have no name for see the one-question setup; everyone else goes straight to Home.
 */
export default function Index() {
  const { isSignedIn } = useSession();
  const { me, loading } = useMe();

  if (!isSignedIn) return <Redirect href="/welcome" />;
  if (loading) return <Loading />;
  if (me && !me.firstName) return <Redirect href="/profile-setup" />;
  return <Redirect href="/home" />;
}
