import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins/jwt";
import { memoryAdapter } from "@better-auth/memory-adapter";
import { dash } from "@better-auth/infra";

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

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000/api/auth";
const jwtIssuer = process.env.BETTER_AUTH_JWT_ISSUER ?? baseURL;
const trustedOrigins = getCsvEnv(
  "BETTER_AUTH_TRUSTED_ORIGINS",
  "http://localhost:5173,http://localhost:4173",
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

if (process.env.BETTER_AUTH_API_KEY) {
  plugins.push(dash());
}

const hasGoogleOAuth = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
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
