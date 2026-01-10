import type { CookieOptions, Request } from "express";

// Known local hostnames (add your Tailscale hostname here)
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "vazal"]);

function isPrivateIP(host: string) {
  // Check for private IPv4 ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 100.64-127.x.x (CGNAT/Tailscale)
  const privateIPv4Patterns = [
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
    /^192\.168\.\d{1,3}\.\d{1,3}$/,
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/, // Tailscale CGNAT range
  ];
  return privateIPv4Patterns.some(pattern => pattern.test(host));
}

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname;
  // Treat localhost, known local hosts, and private IPs as local development
  const isLocal = LOCAL_HOSTS.has(hostname) || isPrivateIP(hostname);
  const isSecure = isSecureRequest(req);

  return {
    httpOnly: true,
    path: "/",
    // For local development, use 'lax' sameSite. For production HTTPS, use 'none'
    sameSite: isLocal ? "lax" : "none",
    // Only set secure flag if actually using HTTPS
    secure: isSecure,
  };
}
