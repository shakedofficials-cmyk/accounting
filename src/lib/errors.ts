import { ZodError } from "zod";

export function getActionErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
