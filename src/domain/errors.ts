export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message, "validation_error");
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, "not_found");
  }
}
