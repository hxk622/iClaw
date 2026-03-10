import {ApiError} from '@iclaw/shared';

export class HttpError extends Error {
  statusCode: number;
  api: ApiError;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.api = new ApiError({code, message});
  }
}
