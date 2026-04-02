import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins/jwt";
import { dash } from "@better-auth/infra";
import { createSqliteAdapter } from "../../better-auth-server/src/sqliteAdapter.mjs";

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

function getRequiredEnv(name) {
	const raw = process.env[name];
	if (typeof raw === "string" && raw.trim().length > 0) {
		return raw.trim();
	}

	throw new Error(`${name} is required in the runtime environment.`);
}

function getConvexUrl() {
	const url = getTrimmedEnv("VITE_CONVEX_URL", "");
	if (!url) {
		console.error(
			"VITE_CONVEX_URL is not set. Auth will use SQLite for persistence."
		);
		return null;
	}
	return url;
}

function resolveDefaultBaseUrl() {
	const vercelUrl = getTrimmedEnv("VERCEL_URL", "");
	if (vercelUrl) {
		return `https://${vercelUrl}/api/auth`;
	}

	return "http://localhost:3000/api/auth";
}

function resolveTrustedOrigins(baseUrl) {
	const defaultTrustedOrigins = (() => {
		try {
			const authOrigin = new URL(baseUrl).origin;
			return [authOrigin, "http://localhost:5173", "http://localhost:4173"];
		} catch {
			return ["http://localhost:5173", "http://localhost:4173"];
		}
	})();

	const configured = getCsvEnv("BETTER_AUTH_TRUSTED_ORIGINS", "");
	if (configured.length === 0) {
		return defaultTrustedOrigins;
	}

	return Array.from(new Set([...defaultTrustedOrigins, ...configured]));
}

const baseURL = getTrimmedEnv("BETTER_AUTH_URL", resolveDefaultBaseUrl());
const jwtIssuer = getTrimmedEnv("BETTER_AUTH_JWT_ISSUER", baseURL);
const trustedOrigins = resolveTrustedOrigins(baseURL);
const betterAuthSecret = getRequiredEnv("BETTER_AUTH_SECRET");
const betterAuthApiKey = getTrimmedEnv("BETTER_AUTH_API_KEY", "");
getConvexUrl();

const getDatabaseAdapter = () => createSqliteAdapter();

const plugins = [
	jwt({
		jwt: {
			issuer: jwtIssuer,
			audience: "convex",
			expirationTime: "15m",
		},
	}),
	dash({
		apiKey: betterAuthApiKey,
	}),
];

const hasGoogleOAuth = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
	baseURL,
	secret: betterAuthSecret,
	database: getDatabaseAdapter(),
	trustedOrigins,
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["google"],
			updateUserInfoOnLink: true,
		},
	},
	rateLimit: {
		enabled: true,
		window: 60,
		max: 100,
		customRules: {
			"/sign-in/**": {
				window: 60,
				max: 25,
			},
			"/callback/**": {
				window: 60,
				max: 25,
			},
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

export { baseURL, jwtIssuer };