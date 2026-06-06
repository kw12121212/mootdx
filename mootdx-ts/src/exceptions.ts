export class MootdxError extends Error {
  provider?: string;
  response?: unknown;
  data?: unknown;

  constructor(message?: string, options?: { provider?: string; response?: unknown; data?: unknown }) {
    super(message);
    this.name = "MootdxError";
    this.provider = options?.provider;
    this.response = options?.response;
    this.data = options?.data;
  }
}

export class MootdxValidationError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "MootdxValidationError";
  }
}

export class MootdxModuleNotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "MootdxModuleNotFoundError";
  }
}

export class FileNeedRefresh extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "FileNeedRefresh";
  }
}
