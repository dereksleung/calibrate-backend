import * as z4 from "zod/v4/core";

interface SuccessValidationResult<T> {
  isValid: true;
  data: T;
}

interface FailureValidationResult {
  isValid: false;
  errors: string[];
}

export type ValidationResult<T> =
  | SuccessValidationResult<T>
  | FailureValidationResult;

export function validate<T extends z4.$ZodType>(
  schema: T,
  data: unknown,
): ValidationResult<z4.infer<T>> {
  const result = z4.safeParse(schema, data);
  if (result.success) {
    return { isValid: true, data: result.data };
  }
  return {
    isValid: false,
    errors: result.error.issues.map((error) => error.message),
  };
}
