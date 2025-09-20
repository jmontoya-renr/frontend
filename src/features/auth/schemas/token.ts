import { z } from 'zod'
import { AuthJwtPayloadSchema } from '@/features/auth/schemas/user'

export const AccessTokenSchema = z
  .object({
    sub: z.string().regex(/^\d+$/),
    context: AuthJwtPayloadSchema,
    type: z.literal('access'),
    iat: z.number().int().nonnegative(),
    exp: z.number().int().nonnegative(),
    jti: z.string().min(1),
  })
  .refine((t) => t.exp > t.iat, { message: 'exp debe ser > iat', path: ['exp'] })

export type AccessToken = z.infer<typeof AccessTokenSchema>
