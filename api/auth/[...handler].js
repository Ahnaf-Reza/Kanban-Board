function writeJson(res, statusCode, payload) {
	res.writeHead(statusCode, { "content-type": "application/json" });
	res.end(JSON.stringify(payload));
}

function mapAuthError(error, fallbackCode) {
	const message = error instanceof Error ? error.message : "Unknown auth error";

	if (message.includes("BETTER_AUTH_SECRET is required")) {
		return {
			statusCode: 500,
			code: "AUTH_SECRET_MISSING",
			message,
			hint: "Set BETTER_AUTH_SECRET in Vercel Production env vars and redeploy.",
		};
	}

	if (message.includes("Failed to decrypt private key")) {
		return {
			statusCode: 500,
			code: "AUTH_SECRET_MISMATCH",
			message,
			hint: "BETTER_AUTH_SECRET does not match stored JWKS encryption. Restore old secret or clear jwks/session/verification, then redeploy.",
		};
	}

	if (message.includes("Postgres URL is required")) {
		return {
			statusCode: 500,
			code: "AUTH_DB_MISSING",
			message,
			hint: "Set POSTGRES_PRISMA_URL (or POSTGRES_URL / DATABASE_URL) in runtime env vars.",
		};
	}

	return {
		statusCode: 500,
		code: fallbackCode,
		message,
	};
}

export default async function authHandler(req, res) {
	let baseURL;
	let jwtIssuer;
	let handler;

	try {
		const config = await import("../../kanban-board/api/auth/authConfig.mjs");
		const authModule = await import("../../kanban-board/api/auth/[...handler].js");
		baseURL = config.baseURL;
		jwtIssuer = config.jwtIssuer;
		handler = authModule.default;
	} catch (error) {
		if ((req.url ?? "").includes("get-session")) {
			writeJson(res, 200, null);
			return;
		}

		const mapped = mapAuthError(error, "AUTH_INIT_FAILED");
		writeJson(res, mapped.statusCode, {
			error: mapped.code,
			message: mapped.message,
			hint: mapped.hint,
		});
		return;
	}

	const host = req.headers.host ?? "kanban-board-gules-three.vercel.app";
	const url = new URL(req.url ?? "/", `https://${host}`);

	if (
		url.pathname === "/api/auth/.well-known/openid-configuration" ||
		url.pathname === "/.well-known/openid-configuration"
	) {
		writeJson(res, 200, {
			issuer: jwtIssuer,
			jwks_uri: `${baseURL}/jwks`,
			authorization_endpoint: `${baseURL}/callback/google`,
			token_endpoint: `${baseURL}/token`,
			response_types_supported: ["code"],
			subject_types_supported: ["public"],
			id_token_signing_alg_values_supported: ["EdDSA"],
		});
		return;
	}

	if (
		url.pathname === "/api/auth/.well-known/jwks.json" ||
		url.pathname === "/.well-known/jwks.json"
	) {
		const jwksResponse = await fetch(`${baseURL}/jwks`);
		const jwks = await jwksResponse.json();
		writeJson(res, jwksResponse.ok ? 200 : 502, jwks);
		return;
	}

	try {
		return await handler(req, res);
	} catch (error) {
		if (url.pathname.endsWith("/get-session")) {
			// Secret rotation can invalidate existing signed session cookies.
			// Return null so clients can recover by re-authenticating.
			writeJson(res, 200, null);
			return;
		}

		const mapped = mapAuthError(error, "AUTH_RUNTIME_FAILED");
		writeJson(res, mapped.statusCode, {
			error: mapped.code,
			message: mapped.message,
			hint: mapped.hint,
		});
	}
}
