import crypto from "crypto";

const ADMIN_COOKIE_NAME = "admin_session";
const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경 변수가 설정되지 않았습니다.`);
  return value;
}

function getAdminPassword(): string {
  return getEnvOrThrow("ADMIN_PASSWORD");
}

function getAdminSessionSecret(): string {
  // 쿠키 서명에 쓰는 secret. 기본적으로 ADMIN_PASSWORD를 fallback으로 사용하지만,
  // 운영에서는 ADMIN_SESSION_SECRET을 별도로 주는 것을 권장합니다.
  return (
    process.env.ADMIN_SESSION_SECRET ??
    getEnvOrThrow("ADMIN_PASSWORD")
  );
}

function hmacSign(data: string): string {
  const secret = getAdminSessionSecret();
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, "hex");
    const bBuf = Buffer.from(b, "hex");
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

export function verifyAdminPassword(password: string): boolean {
  return password === getAdminPassword();
}

export function createAdminSessionCookieValue(): string {
  const exp = Date.now() + ADMIN_SESSION_TTL_MS;
  const nonce = crypto.randomBytes(16).toString("hex");
  const data = `${exp}.${nonce}`;
  const signature = hmacSign(data);
  return `${data}.${signature}`;
}

export function verifyAdminSessionCookieValue(
  cookieValue: string | undefined | null,
): boolean {
  if (!cookieValue || typeof cookieValue !== "string") return false;

  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;

  const [expStr, nonce, signature] = parts;
  if (!expStr || !nonce || !signature) return false;

  const expMs = Number(expStr);
  if (!Number.isFinite(expMs)) return false;
  if (expMs <= Date.now()) return false;

  const data = `${expMs}.${nonce}`;
  const expectedSignature = hmacSign(data);
  return timingSafeEqualHex(signature, expectedSignature);
}

export function requireAdminSessionOrThrow(
  cookieValue: string | undefined | null,
): void {
  const ok = verifyAdminSessionCookieValue(cookieValue);
  if (!ok) {
    const err = new Error("관리자 인증에 실패했습니다.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err as any).statusCode = 401;
    throw err;
  }
}

export function getAdminCookieName(): string {
  return ADMIN_COOKIE_NAME;
}

export function getAdminSessionTtlMs(): number {
  return ADMIN_SESSION_TTL_MS;
}

