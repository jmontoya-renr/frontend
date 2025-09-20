import * as z from 'zod'

const minLengthErrorMessage = 'Password must be at least 8 characters long.'
const maxLengthErrorMessage = 'Password cannot exceed 20 characters.'
const uppercaseErrorMessage = 'Password must contain at least one uppercase letter.'
const lowercaseErrorMessage = 'Password must contain at least one lowercase letter.'
const numberErrorMessage = 'Password must contain at least one number.'
const specialCharacterErrorMessage =
  'Password must contain at least one special character (!@#$%^&* etc.).'

export const passwordSchema = z.string()
/*
  .min(8, { message: minLengthErrorMessage })
  .max(20, { message: maxLengthErrorMessage })
  .regex(/[A-ZÁÉÍÓÚÜÑ]/, { message: uppercaseErrorMessage }) // mayúsculas incluyendo acentos y Ñ
  .regex(/[a-záéíóúüñ]/, { message: lowercaseErrorMessage }) // minúsculas incluyendo acentos y ñ
  .regex(/[0-9]/, { message: numberErrorMessage })
  .regex(/[!@#$%^&*()_+\-={}\[\]:;"'`~<>,.?¡¿\\/|]/, { message: specialCharacterErrorMessage })
*/
