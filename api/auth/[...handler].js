function writeJson(res, statusCode, payload) {
	res.writeHead(statusCode, { "content-type": "application/json" });
	res.end(JSON.stringify(payload));
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
		const message = error instanceof Error ? error.message : "Unknown auth startup error";
		writeJson(res, 500, {
			error: "AUTH_INIT_FAILED",
			message,
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

	return handler(req, res);
}
