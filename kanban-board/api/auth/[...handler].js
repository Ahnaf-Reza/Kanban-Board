import "dotenv/config";
import { toNodeHandler } from "better-auth/node";
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins/jwt";
import { memoryAdapter } from "@better-auth/memory-adapter";

const memoryDb = {
  user: [],
  session: [],
  account: [],
  verification: [],
  jwks: [],
};

function getCsvEnv(name, fallback) {
  const raw = process.env[name] ?? fallback;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function getTrimmedEnv(name, fallback) {
  const raw = process.env[name];
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }

  return fallback;
}

const baseURL = getTrimmedEnv("BETTER_AUTH_URL", "https://your-vercel-project.vercel.app/api/auth");
const jwtIssuer = getTrimmedEnv("BETTER_AUTH_JWT_ISSUER", baseURL);
const trustedOrigins = getCsvEnv(
  "BETTER_AUTH_TRUSTED_ORIGINS",
  "http://localhost:5173,http://localhost:4173"
);

const plugins = [
  jwt({
    jwt: {
      issuer: jwtIssuer,
      audience: "convex",
      expirationTime: "15m",
    },
  }),
];

const hasGoogleOAuth = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-this",
  database: memoryAdapter(memoryDb),
  trustedOrigins,
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      updateUserInfoOnLink: true,
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: hasGoogleOAuth
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined,
  plugins,
});

const handler = toNodeHandler(auth);

export default handler;
