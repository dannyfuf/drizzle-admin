import type { Context, Next } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { AdminTokenPayload, verifyToken } from "@/auth/jwt.ts";
import { adminUrl } from "@/utils/url.ts";

const AUTH_COOKIE_NAME = "admin_session";
const LOGIN_PATH = "/login";

export const ADMIN_CONTEXT_KEY = "admin";

export function authMiddleware(sessionSecret: string, basePath: string = '') {
  return async (c: Context, next: Next) => {
    const token = getCookie(c, AUTH_COOKIE_NAME);

    if (!token) {
      return c.redirect(adminUrl(basePath, LOGIN_PATH));
    }

    const payload = await verifyToken(token, sessionSecret);

    if (!payload) {
      setCookie(c, AUTH_COOKIE_NAME, "", { maxAge: 0, path: "/" });
      return c.redirect(adminUrl(basePath, LOGIN_PATH));
    }

    c.set(ADMIN_CONTEXT_KEY, payload);
    await next();
  };
}

export function getAdmin(c: Context): AdminTokenPayload {
  return c.get(ADMIN_CONTEXT_KEY) as AdminTokenPayload;
}

export function setAuthCookie(c: Context, token: string, basePath: string = ''): void {
  setCookie(c, AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 60 * 60 * 24,
    path: basePath || "/",
  });
}

export function clearAuthCookie(c: Context, basePath: string = ''): void {
  setCookie(c, AUTH_COOKIE_NAME, "", { maxAge: 0, path: basePath || "/" });
}
