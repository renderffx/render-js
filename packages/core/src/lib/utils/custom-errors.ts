export function createCustomError(
  message: string,
  options?: { status?: number; location?: string },
): Error & { status?: number; location?: string } {
  const error = new Error(message) as Error & { status?: number; location?: string };
  if (options?.status) {
    error.status = options.status;
  }
  if (options?.location) {
    error.location = options.location;
  }
  return error;
}

export function getErrorInfo(e: unknown): { message: string; status?: number; location?: string } | null {
  if (typeof e !== 'object' || e === null) {
    return null;
  }
  const error = e as { status?: number; location?: string; message?: string };
  if (typeof error.message !== 'string') {
    return null;
  }
  return {
    message: error.message,
    status: error.status,
    location: error.location,
  };
}
