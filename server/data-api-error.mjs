export class DataApiError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = "DataApiError";
    this.status = status;
    this.code = options.code;
    this.retryAfter = options.retryAfter;
  }
}
