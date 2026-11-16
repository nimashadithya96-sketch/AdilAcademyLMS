import type {
  NextFunction,
  Request,
  RequestHandler,
  Response
} from "express";
import { ZodError } from "zod";
import { HttpError } from "./auth";

export function asyncRoute(
  handler: (
    request: Request,
    response: Response,
    next: NextFunction
  ) => Promise<void>
): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

export function apiErrorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
) {
  if (error instanceof HttpError) {
    response.status(error.status).json({ message: error.message });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({
      message: "Request validation failed.",
      issues: error.issues.map((issue) => issue.message)
    });
    return;
  }
  if (error instanceof Error && error.message === "DATABASE_NOT_CONFIGURED") {
    response.status(503).json({
      message: "Replit PostgreSQL database is not configured."
    });
    return;
  }
  if (error instanceof Error && error.message === "APP_STORAGE_UNAVAILABLE") {
    response.status(503).json({
      message: "Replit App Storage is not configured."
    });
    return;
  }
  if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "42P01") {
    response.status(503).json({ message: "Registration database update එක apply වී නැහැ. Replit Shell එකේ npm run db:migrate දී නැවත උත්සාහ කරන්න." });
    return;
  }
  console.error("Unhandled API error", error);
  response.status(500).json({ message: "Unexpected server error." });
}
