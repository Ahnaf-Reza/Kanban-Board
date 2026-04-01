import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins/jwt";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

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
			return [authOrigin, "https://**.vercel.app", "http://localhost:5173", "http://localhost:4173"];
		} catch {
			return ["https://**.vercel.app", "http://localhost:5173", "http://localhost:4173"];
		}
	})();

	const configured = getCsvEnv("BETTER_AUTH_TRUSTED_ORIGINS", "");
	if (configured.length === 0) {
		return defaultTrustedOrigins;
	}

	return Array.from(new Set([...defaultTrustedOrigins, ...configured]));
}

function getDatabaseUrl() {
	const candidates = [
		process.env.POSTGRES_PRISMA_URL,
		process.env.POSTGRES_URL,
		process.env.DATABASE_URL,
	];

	for (const value of candidates) {
		if (typeof value === "string" && value.trim().length > 0) {
			return value.trim();
		}
	}

	throw new Error(
		"A Postgres URL is required. Set DATABASE_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL) in the runtime environment."
	);
}

const baseURL = getTrimmedEnv("BETTER_AUTH_URL", resolveDefaultBaseUrl());
const jwtIssuer = getTrimmedEnv("BETTER_AUTH_JWT_ISSUER", baseURL);
const trustedOrigins = resolveTrustedOrigins(baseURL);

const databaseUrl = getDatabaseUrl();
const prisma =
	globalThis.__kanbanPrismaClient ??
	new PrismaClient({
		datasources: {
			db: {
				url: databaseUrl,
			},
		},
	});

globalThis.__kanbanPrismaClient = prisma;

const plugins = [
	jwt({
		jwt: {
			issuer: jwtIssuer,
			audience: "convex",
			expirationTime: "15m",
		},
	}),
];

const hasGoogleOAuth = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
	baseURL,
	secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-this",
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
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