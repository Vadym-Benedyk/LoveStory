// Our API reports a date conflict as HTTP 409 with { error: { code: 'CONFLICT' } }.
export function isConflictError(err: unknown): boolean {
  const res = (err as { response?: { status?: number; data?: { error?: { code?: string } } } })?.response;
  return res?.status === 409 || res?.data?.error?.code === 'CONFLICT';
}
