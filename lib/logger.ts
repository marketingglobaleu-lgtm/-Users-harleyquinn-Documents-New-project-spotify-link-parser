export function logEvent(event: string, payload: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    payload
  };

  console.info(JSON.stringify(entry));
}
