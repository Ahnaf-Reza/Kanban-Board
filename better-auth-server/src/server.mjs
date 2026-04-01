import "dotenv/config";
import { createServer } from "node:http";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.mjs";

const port = Number(process.env.PORT ?? 3000);
const authHandler = toNodeHandler(auth);
const authBaseUrl = process.env.BETTER_AUTH_URL ?? `http://localhost:${port}/api/auth`;
const publicAuthBaseUrl = process.env.BETTER_AUTH_PUBLIC_URL ?? authBaseUrl;
const authOrigin = new URL(authBaseUrl).origin;

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function getJwksPayload() {
  const jwksResponse = await fetch(`${authBaseUrl}/jwks`);
  const jwks = await jwksResponse.json();
  return {
    ok: jwksResponse.ok,
    jwks,
  };
}

const server = createServer(async (req, res) => {
  const host = req.headers.host ?? `localhost:${port}`;
  const url = new URL(req.url ?? "/", `http://${host}`);

  if (
    url.pathname === "/api/auth/.well-known/openid-configuration" ||
    url.pathname === "/.well-known/openid-configuration"
  ) {
    let algValues = ["EdDSA"];

    try {
      const { ok, jwks } = await getJwksPayload();
      if (ok && jwks && Array.isArray(jwks.keys)) {
        const discovered = jwks.keys
          .map((key) => (typeof key?.alg === "string" ? key.alg : null))
          .filter((alg) => Boolean(alg));

        if (discovered.length > 0) {
          algValues = Array.from(new Set(discovered));
        }
      }
    } catch {
      // Keep default algorithm list for discovery if JWKS lookup fails.
    }

    writeJson(res, 200, {
      issuer: publicAuthBaseUrl,
      jwks_uri: `${publicAuthBaseUrl}/.well-known/jwks.json`,
      token_endpoint: `${publicAuthBaseUrl}/api/auth/token`,
      authorization_endpoint: `${publicAuthBaseUrl}/api/auth/sign-in/social`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: algValues,
      claims_supported: ["sub", "iss", "aud", "email", "name", "image"],
    });
    return;
  }

  if (url.pathname === "/api/auth/.well-known/jwks.json" || url.pathname === "/.well-known/jwks.json") {
    try {
      const { ok, jwks } = await getJwksPayload();
      writeJson(res, ok ? 200 : 502, jwks);
    } catch {
      writeJson(res, 502, { error: "Unable to fetch JWKS" });
    }
    return;
  }

  if (url.pathname.startsWith("/api/auth")) {
    await authHandler(req, res);
    return;
  }

  if (url.pathname === "/health") {
    writeJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/") {
    writeJson(res, 200, {
      service: "better-auth-server",
      authBasePath: "/api/auth",
      authBaseUrl,
      publicAuthBaseUrl,
      authOrigin,
      sessionEndpoint: `${authBaseUrl}/get-session`,
      oidcDiscoveryEndpoint: `${publicAuthBaseUrl}/.well-known/openid-configuration`,
    });
    return;
  }

  writeJson(res, 404, { error: "Not Found" });
});

server.listen(port, () => {
  console.log(`Better Auth server running at http://localhost:${port}`);
  console.log("Auth base path: /api/auth");
});
