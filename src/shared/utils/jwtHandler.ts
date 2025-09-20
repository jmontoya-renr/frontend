import { AccessTokenSchema, type AccessToken } from '@/features/auth/schemas/token'
import { z } from 'zod'

/**
 * Decodes the payload of a JWT (JSON Web Token) without verifying its signature.
 * Returns the decoded payload as a plain object, or `null` if decoding fails.
 *
 * @param token - The JWT string to decode.
 * @returns A record containing the decoded payload, or `null` if invalid.
 */
function decodePayloadUnsafe(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null

    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

function decodePayload(token: string): AccessToken | null {
  const raw = decodePayloadUnsafe(token)
  if (!raw) return null
  const parsed = AccessTokenSchema.safeParse(raw)
  if (parsed.error) console.warn(parsed.error)
  return parsed.success ? parsed.data : null
}

/**
 * Checks whether a given JWT is expired based on its `exp` (expiration) claim.
 * If the token cannot be decoded or lacks an `exp` field, it is considered expired.
 *
 * @param token - The JWT string to check.
 * @returns `true` if the token is expired or invalid, `false` otherwise.
 */
function isExpired(token: string): boolean {
  const claims = decodePayloadUnsafe(token)
  const exp = z.object({ exp: z.number().int() }).safeParse(claims)
  if (!exp.success) return true
  const now = Math.floor(Date.now() / 1000)
  return exp.data.exp < now
}

function getClaims(token: string): AccessToken | null {
  return decodePayload(token)
}

function getContext(token: string) {
  return decodePayload(token)?.context ?? null
}

function getSub(token: string): string | null {
  return decodePayload(token)?.sub ?? null
}

function secondsToExpiry(token: string): number | null {
  const claims = decodePayloadUnsafe(token)
  const exp = z.object({ exp: z.number().int() }).safeParse(claims)
  if (!exp.success) return null
  const now = Math.floor(Date.now() / 1000)
  return Math.max(0, exp.data.exp - now)
}

/**
 * Utility object to handle basic JWT operations such as decoding and expiration check.
 */
export const jwtHandler = {
  decodePayloadUnsafe,
  decodePayload,
  isExpired,
  getClaims,
  getContext,
  getSub,
  secondsToExpiry,
}
