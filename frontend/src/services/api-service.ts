'use client';

import { apiURL } from '@utils/api-url';
import { isProtectedRoute, routePath } from '@utils/protected-routes';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { SERVICE_KEY_HEADER, serviceKeyFromPath } from 'src/constants/services';

export interface ApiResponse<T = unknown> {
  data: T;
  message: string;
}

/** The login page to send a rejected request to, or undefined when the error should just surface. */
export const loginRedirectUrl = (error: AxiosError<ApiResponse>, pathname: string, origin: string): URL | undefined => {
  const path = routePath(pathname);
  //TODO: Refactor to be more compliant with NextJS routing standards
  if (!isProtectedRoute(path) || error?.response?.status !== 401 || path.includes('login')) return undefined;

  const loginUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/login`, origin);
  loginUrl.searchParams.set('path', pathname);
  loginUrl.searchParams.set('failMessage', error.response.data.message);
  return loginUrl;
};

export const handleError = (error: AxiosError<ApiResponse>) => {
  const loginUrl = loginRedirectUrl(error, window?.location.pathname ?? '', window.location.origin);
  if (loginUrl) window.location.assign(loginUrl);

  throw error;
};

const defaultOptions = {
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
};

/** Plain header records only, so the form header can be merged without axios' header classes. */
export type ApiRequestOptions = Omit<AxiosRequestConfig, 'headers'> & { headers?: Record<string, string> };

/**
 * The backend resolves the namespace from the form the page belongs to, so every call names it.
 * Caller headers still replace the defaults wholesale (an upload sends {} to drop the JSON type).
 */
export const requestOptions = (
  options?: ApiRequestOptions,
  pathname = window.location.pathname
): AxiosRequestConfig => {
  const merged = { ...defaultOptions, ...options };
  const service = serviceKeyFromPath(routePath(pathname));

  return service ? { ...merged, headers: { ...merged.headers, [SERVICE_KEY_HEADER]: service } } : merged;
};

const get = <T>(url: string, options?: ApiRequestOptions) =>
  axios.get<T>(apiURL(url), requestOptions(options)).catch(handleError);

const post = <T>(url: string, data: unknown, options?: ApiRequestOptions) => {
  return axios.post<T>(apiURL(url), data, requestOptions(options)).catch(handleError);
};

const remove = <T>(url: string, options?: ApiRequestOptions) => {
  return axios.delete<T>(apiURL(url), requestOptions(options)).catch(handleError);
};

const patch = <T>(url: string, data: unknown, options?: ApiRequestOptions) => {
  return axios.patch<T>(apiURL(url), data, requestOptions(options)).catch(handleError);
};

const put = <T>(url: string, data: unknown, options?: ApiRequestOptions) => {
  return axios.put<T>(apiURL(url), data, requestOptions(options)).catch(handleError);
};

export const apiService = { get, post, put, patch, delete: remove };
