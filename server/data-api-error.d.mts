export class DataApiError extends Error {
  constructor(status: number, message: string);
  status: number;
}
