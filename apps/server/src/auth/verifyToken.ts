import { jwtDecrypt } from 'jose';
import { hkdf } from '@panva/hkdf';

export interface TokenPayload {
  userId: string;
  email: string;
  sub: string;
  name?: string;
  picture?: string;
  iat: number;
  exp: number;
  jti: string;
}

const DEV_COOKIE_NAME = 'authjs.session-token';
const PROD_COOKIE_NAME = '__Secure-authjs.session-token';

async function deriveEncryptionKey(
  secret: string,
  cookieName: string
): Promise<Uint8Array> {
  return new Uint8Array(
    await hkdf(
      'sha256',
      secret,
      cookieName,
      `Auth.js Generated Encryption Key (${cookieName})`,
      64
    )
  );
}

export async function verifyNextAuthToken(
  token: string,
  secret: string,
  isProduction = process.env['NODE_ENV'] === 'production'
): Promise<TokenPayload> {
  const cookieName = isProduction ? PROD_COOKIE_NAME : DEV_COOKIE_NAME;
  const encryptionSecret = await deriveEncryptionKey(secret, cookieName);

  const { payload } = await jwtDecrypt(token, encryptionSecret, {
    clockTolerance: 15,
  });

  if (!payload['userId'] || typeof payload['userId'] !== 'string') {
    throw new Error('Token payload missing userId');
  }

  if (!payload['email'] || typeof payload['email'] !== 'string') {
    throw new Error('Token payload missing email');
  }

  return payload as unknown as TokenPayload;
}
