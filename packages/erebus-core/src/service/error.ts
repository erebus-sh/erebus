export class ErebusError extends Error {
  constructor(message: string, more?: string) {
    super(message + (more ? `: ${more}` : ""));
  }
}
