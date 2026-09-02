export class DataApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "DataApiError";
    this.status = status;
  }
}
