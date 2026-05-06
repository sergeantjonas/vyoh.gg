export class RiotError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "RiotError";
    this.status = status;
    this.path = path;
  }
}
