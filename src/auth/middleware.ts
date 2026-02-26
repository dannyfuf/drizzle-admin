import type { Context, Next } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { AdminTokenPayload, verifyToken } from "./jwt.js";

const AUTH_COOKIE_NAME = "admin_session";
const LOGIN_PATH = "/login";

export const ADMIN_CONTEXT_KEY = "admin";

export function authMiddleware(sessionSecret: string) {
  return async (c: Context, next: Next) => {
    const token = getCookie(c, AUTH_COOKIE_NAME);

    if (!token) {
      return c.redirect(LOGIN_PATH);
    }

    const payload = await verifyToken(token, sessionSecret);

    if (!payload) {
      setCookie(c, AUTH_COOKIE_NAME, "", { maxAge: 0 });
      return c.redirect(LOGIN_PATH);
    }

    c.set(ADMIN_CONTEXT_KEY, payload);
    await next();
  };
}

export function getAdmin(c: Context): AdminTokenPayload {
  return c.get(ADMIN_CONTEXT_KEY) as AdminTokenPayload;
}

export function setAuthCookie(c: Context, token: string): void {
  setCookie(c, AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
}

export function clearAuthCookie(c: Context): void {
  setCookie(c, AUTH_COOKIE_NAME, "", { maxAge: 0, path: "/" });
}
