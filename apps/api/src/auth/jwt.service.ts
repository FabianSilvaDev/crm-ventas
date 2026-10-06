import { randomUUID } from 'node:crypto';

import { type JWTPayload, SignJWT, jwtVerify } from 'jose';

import { Permission } from '@crm/contracts';

import type { Env } from '../config/env.js';

/**
 * Claims del access token JWT (`docs/api.md` §3.3).
 *
 * El token vive 15 minutos en memoria del cliente; el `org` es la `organization_id` que Prisma
 * forzará en las queries cuando llegue. Hoy los repositorios JSON aplican ese filtro manualmente.
 */
export interface AccessTokenClaims extends JWTPayload {
  readonly sub: string;
  readonly org: string;
  readonly role: string;
  readonly permissions: readonly Permission[];
  readonly jti: string;
  readonly iss: string;
  readonly aud: string;
}

export class JwtService {
  constructor(private readonly env: Env) {}

  async signAccessToken(payload: {
    readonly userId: string;
    readonly organizationId: string;
    readonly role: string;
    readonly permissions: readonly Permission[];
  }): Promise<{ readonly token: string; readonly jti: string; readonly expiresIn: number }> {
    const secret = this.requireSecret();
    const jti = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = this.env.ACCESS_TOKEN_TTL_SECONDS;

    const token = await new SignJWT({
      sub: payload.userId,
      org: payload.organizationId,
      role: payload.role,
      permissions: payload.permissions,
      jti,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setIssuer(this.env.JWT_ISSUER)
      .setAudience(this.env.JWT_AUDIENCE)
      .setExpirationTime(now + expiresIn)
      .sign(secret);

    return { token, jti, expiresIn };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const secret = this.requireSecret();
    const { payload } = await jwtVerify(token, secret, {
      issuer: this.env.JWT_ISSUER,
      audience: this.env.JWT_AUDIENCE,
      algorithms: ['HS256'],
    });

    if (typeof payload.sub !== 'string') {
      throw new Error('JWT sin claim sub');
    }
    if (typeof payload.org !== 'string') {
      throw new Error('JWT sin claim org');
    }
    if (typeof payload.role !== 'string') {
      throw new Error('JWT sin claim role');
    }
    if (!Array.isArray(payload.permissions)) {
      throw new Error('JWT sin claim permissions');
    }

    return payload as unknown as AccessTokenClaims;
  }

  private requireSecret(): Uint8Array {
    if (this.env.JWT_SECRET === undefined) {
      throw new Error('JWT_SECRET no está configurado');
    }
    return new TextEncoder().encode(this.env.JWT_SECRET);
  }
}
