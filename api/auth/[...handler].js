import handler from "../../kanban-board/api/auth/[...handler].js";

function getTrimmedEnv(name, fallback) {
	const raw = process.env[name];
	if (typeof raw === "string" && raw.trim().length > 0) {
		return raw.trim();
	}

	return fallback;
}

function writeJson(res, statusCode, payload) {
	res.writeHead(statusCode, { "content-type": "application/json" });
	res.end(JSON.stringify(payload));
}

function getAuthBaseUrl() {
	return getTrimmedEnv("BETTER_AUTH_URL", "https://kanban-board-gules-three.vercel.app/api/auth");
}

export default async function authHandler(req, res) {
	const host = req.headers.host ?? "kanban-board-gules-three.vercel.app";
	const url = new URL(req.url ?? "/", `https://${host}`);
	const baseURL = getAuthBaseUrl();
	const issuer = getTrimmedEnv("BETTER_AUTH_JWT_ISSUER", baseURL);

	if (
		url.pathname === "/api/auth/.well-known/openid-configuration" ||
		url.pathname === "/.well-known/openid-configuration"
	) {
		writeJson(res, 200, {
			issuer,
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
