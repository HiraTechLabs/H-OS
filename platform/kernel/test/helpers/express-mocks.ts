/** Minimal stand-ins for the Express surface the kernel middleware touches. */
export interface MockedRequest {
  method: string;
  headers: Record<string, string | undefined>;
}

export interface MockedResponse {
  headers: Record<string, string>;
  statusCalls: number[];
  setHeader: (name: string, value: string) => Record<string, string>;
  status: (code: number) => MockedResponse;
  type: (value: string) => MockedResponse;
  json: (body: unknown) => MockedResponse;
}
