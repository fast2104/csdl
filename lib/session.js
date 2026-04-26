import crypto from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "wallet_demo_session";

function sessionSecret() {
  return process.env.SESSION_SECRET || "wallet-demo-secret";
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(payload) {
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function signPayload(encodedPayload) {
  return crypto
    .createHmac("sha256", sessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function createToken(payload) {
  const encodedPayload = encodePayload(payload);
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function readToken(token) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (signPayload(encodedPayload) !== signature) {
    return null;
  }

  try {
    return decodePayload(encodedPayload);
  } catch {
    return null;
  }
}

export async function setSessionCookie(user) {
  const token = createToken({
    userId: user.userId,
    fullName: user.fullName,
    email: user.email,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return readToken(token);
}
