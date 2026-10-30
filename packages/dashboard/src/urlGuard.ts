import dns from "node:dns/promises";
import net from "node:net";

/**
 * Checks an export URL before it is stored or polled. In production the URL must be https and must not point at
 * a loopback, private or link-local address (cloud metadata lives on 169.254.169.254). Both rules can be relaxed:
 * PULSE_ALLOW_HTTP=1 allows http://, and PULSE_ALLOWED_HOSTS (comma separated hostnames) exempts trusted hosts,
 * for example a service name on your private network. Outside production nothing is blocked.
 */
const isStrict = () => process.env.NODE_ENV === "production";

const allowedHosts = (): Set<string> =>
  new Set(
    (process.env.PULSE_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );

const isPrivateV4 = (ip: string): boolean => {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
};

const isPrivateAddress = (ip: string): boolean => {
  if (net.isIPv4(ip)) return isPrivateV4(ip);
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]);
  return v6 === "::" || v6 === "::1" || v6.startsWith("fe80:") || v6.startsWith("fc") || v6.startsWith("fd");
};

/** Returns an error message when the URL must not be used, or null when it is fine. */
export async function checkExportUrl(rawUrl: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "exportUrl must be a full, valid URL";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "exportUrl must use http:// or https://";
  if (!isStrict()) return null;

  if (url.protocol === "http:" && process.env.PULSE_ALLOW_HTTP !== "1") {
    return "exportUrl must use https:// in production (set PULSE_ALLOW_HTTP=1 to allow http://)";
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (allowedHosts().has(host)) return null;

  let addresses: string[];
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await dns.lookup(host, { all: true })).map((entry) => entry.address);
    } catch {
      return "exportUrl host could not be resolved";
    }
  }
  if (addresses.some(isPrivateAddress)) {
    return "exportUrl points at a private or loopback address (add its hostname to PULSE_ALLOWED_HOSTS to allow it)";
  }
  return null;
}
