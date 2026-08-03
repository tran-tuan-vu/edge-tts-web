import { SignJWT, jwtVerify } from "jose";
import { createHash, timingSafeEqual } from "crypto";

const SESSION_COOKIE = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 giờ

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Thiếu biến môi trường AUTH_SECRET");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sub: string;
}

export async function signSession(username: string): Promise<string> {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

/**
 * So sánh hai chuỗi bất kể độ dài mà không rò rỉ thời gian xử lý,
 * bằng cách hash SHA-256 trước rồi so sánh digest có độ dài cố định.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

export { SESSION_COOKIE, SESSION_TTL_SECONDS };
