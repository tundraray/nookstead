import type { DrizzleClient } from '../core/client';
import { users } from '../schema/users';
import { accounts } from '../schema/accounts';

export interface FindOrCreateUserParams {
  email: string;
  name: string | null;
  image: string | null;
  provider: string;
  providerAccountId: string;
}

export interface FindOrCreateUserResult {
  userId: string;
}

export async function findOrCreateUser(
  db: DrizzleClient,
  params: FindOrCreateUserParams
): Promise<FindOrCreateUserResult> {
  const { email, name, image, provider, providerAccountId } = params;

  const [user] = await db
    .insert(users)
    .values({ email, name, image })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name,
        image,
        updatedAt: new Date(),
      },
    })
    .returning({ id: users.id });

  await db
    .insert(accounts)
    .values({
      userId: user.id,
      provider,
      providerAccountId,
    })
    .onConflictDoUpdate({
      target: [accounts.provider, accounts.providerAccountId],
      set: { userId: user.id },
    });

  return { userId: user.id };
}
