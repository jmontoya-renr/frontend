import { z } from 'zod'

export const AuthLoginResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string(),
})

export type AuthLoginResponse = z.infer<typeof AuthLoginResponseSchema>
