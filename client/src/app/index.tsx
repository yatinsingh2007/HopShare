import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Loading } from '@/components/Loading';
import { useMe } from '@/hooks/useMe';

/** The app opens here, and lands here again after every sign-in or sign-out. */
export default function Index() {
  const { isSignedIn } = useAuth();
  const { me, loading } = useMe();

  if (!isSignedIn) return <Redirect href="/welcome" />;
  if (loading) return <Loading />;
  if (me && !me.profileComplete) return <Redirect href="/profile-setup" />;
  return <Redirect href="/home" />;
}
