export interface ApiResponse<T = unknown> {
  data: T;
  message: string;
  /** The bounded Location of a created resource, when the caller chose not to follow it. */
  location?: string;
}

export default ApiResponse;
