import { cookies } from 'next/headers';
import { auth } from '@/auth';

const DEV_COOKIE = 'authjs.session-token';
const PROD_COOKIE = '__Secure-authjs.session-token';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const jar = await cookies();
  const token =
    jar.get(PROD_COOKIE)?.value ?? jar.get(DEV_COOKIE)?.value ?? null;

  if (!token) {
    return Response.json({ error: 'Session token not found' }, { status: 401 });
  }

  return Response.json({ token });
}
