export const genId = () =>
  crypto.randomUUID() ??
  String(Date.now()) + Math.random().toString(16).slice(2);
