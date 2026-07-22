export class KiteMcpError extends Error {
  constructor(
    message: string,
    readonly details: {
      operation: string;
      status?: number;
      code?: string;
      retryable: boolean;
      nextStep: string;
    }
  ) {
    super(message);
    this.name = "KiteMcpError";
  }
}

export function formatError(error: unknown): string {
  if (error instanceof KiteMcpError) {
    const status = error.details.status ? `status=${error.details.status}` : "status=unknown";
    const code = error.details.code ? ` code=${error.details.code}` : "";
    return `${error.message} (${status}${code}, retryable=${error.details.retryable}). Next step: ${error.details.nextStep}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
