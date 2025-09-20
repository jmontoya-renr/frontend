import axios from 'axios'
import type {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
  CustomParamsSerializer,
} from 'axios'
import { useAuthStore } from '@/features/auth/stores'

/**
 * Custom query parameter serializer compatible with Axios.
 *
 * - Converts arrays into repeated key=value pairs.
 * - Ignores `undefined` and `null` values.
 * - Appends empty string for empty arrays.
 *
 * @param params - The query parameters to serialize.
 * @returns A serialized query string.
 */
export const paramsSerializer: CustomParamsSerializer = (params) => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        searchParams.append(key, '')
      } else {
        value.forEach((item) => {
          if (item !== undefined && item !== null) {
            searchParams.append(key, String(item))
          }
        })
      }
    } else if (value !== undefined && value !== null) {
      searchParams.append(key, String(value))
    }
  })

  return searchParams.toString()
}

/**
 * Axios request interceptor to add Authorization header if access token exists.
 *
 * @param config - The outgoing request configuration.
 * @returns The modified request configuration.
 */
const onRequest = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
  const auth = useAuthStore()
  const token = auth.accessToken

  if (!config.headers) return config

  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
}

/**
 * Axios request error handler.
 *
 * @param error - The Axios error.
 * @returns A rejected promise with the error.
 */
const onRequestError = (error: AxiosError): Promise<AxiosError> => {
  return Promise.reject(error)
}

/**
 * Axios response interceptor (pass-through).
 *
 * @param response - The successful response.
 * @returns The same response.
 */
const onResponse = (response: AxiosResponse): AxiosResponse => {
  return response
}

/**
 * Axios response error handler with support for token refresh logic on 401 errors.
 *
 * If the access token is expired and a refresh token is available, it attempts
 * to refresh the token and retry the original request. If refreshing fails, the
 * user is logged out and redirected to the login page.
 *
 * @param axiosInstance - The Axios instance used to retry the request.
 * @param error - The original Axios error.
 * @returns The response from the retried request or a rejected promise.
 */
const onResponseError = async (
  axiosInstance: AxiosInstance,
  error: AxiosError,
): Promise<AxiosError> => {
  const auth = useAuthStore()
  const originalRequest = error.config

  if (!originalRequest || originalRequest.url?.includes('/refresh')) return Promise.reject(error)

  if (error.response?.status === 401 && auth.refreshToken) {
    try {
      await auth.refreshAccessToken()

      if (auth.accessToken) {
        originalRequest.headers.Authorization = `Bearer ${auth.accessToken}`
        return axiosInstance(originalRequest)
      }
    } catch {
      auth.logout()
    }
  }

  return Promise.reject(error)
}

/**
 * Applies custom request and response interceptors to a given Axios instance.
 *
 * @param axiosInstance - The Axios instance to configure.
 * @returns The enhanced Axios instance.
 */
export function setupInterceptorsTo(axiosInstance: AxiosInstance): AxiosInstance {
  axiosInstance.interceptors.request.use(onRequest, onRequestError)
  axiosInstance.interceptors.response.use(onResponse, (error) =>
    onResponseError(axiosInstance, error),
  )
  return axiosInstance
}

/**
 * Creates a preconfigured Axios instance for HTTP requests.
 *
 * - `baseURL` is read from environment variable `VITE_API_BASE_URL`,
 *    falling back to `http://127.0.0.1:9000` if not provided.
 * - Default headers include `Content-Type: application/json`.
 * - A custom `paramsSerializer` is applied for query parameters.
 */
const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:9000',
  paramsSerializer,
})

/**
 * Applies custom interceptors (e.g., for auth, error handling) to the Axios instance.
 *
 * @returns The Axios instance enhanced with request/response interceptors.
 */
export default setupInterceptorsTo(http)
