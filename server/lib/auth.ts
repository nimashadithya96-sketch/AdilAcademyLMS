import type { Request } from "express";
import type { DemoUser, UserRole } from "../../shared/platform";
import { getUserForSession } from "../modules/auth/service";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function readCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export async function requireAuthenticatedUser(
  request: Request
): Promise<DemoUser> {
  const token = readCookie(request.headers.cookie, "adil_session");
  if (!token) throw new HttpError(401, "Authentication required.");
  const user = await getUserForSession(token);
  if (!user) throw new HttpError(401, "Authentication required.");
  return user;
}

export async function requireRole(
  request: Request,
  roles: UserRole[]
): Promise<DemoUser> {
  const user = await requireAuthenticatedUser(request);
  if (!roles.includes(user.role)) {
    throw new HttpError(403, "You do not have permission for this action.");
  }
  return user;
}
