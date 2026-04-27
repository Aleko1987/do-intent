export interface IntakeResponse {
  ok: boolean;
  deduped: boolean;
  correlation_id: string;
  candidate_signal_id: string;
  evidence_id: string | null;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function postCaptureIntake(params: {
  baseUrl: string;
  token: string;
  payload: Record<string, unknown>;
}): Promise<IntakeResponse> {
  let response: Response;
  try {
    response = await fetch(`${params.baseUrl}/marketing/capture-intake`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify(params.payload),
    });
  } catch (cause) {
    const error = new Error("capture intake network error") as Error & {
      retryable?: boolean;
      statusCode?: number;
      cause?: unknown;
    };
    error.retryable = true;
    error.cause = cause;
    throw error;
  }

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || `capture intake failed (${response.status})`) as Error & {
      retryable?: boolean;
      statusCode?: number;
    };
    error.retryable = isRetryableStatus(response.status);
    error.statusCode = response.status;
    throw error;
  }

  return (await response.json()) as IntakeResponse;
}
