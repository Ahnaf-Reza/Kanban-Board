import { toNodeHandler } from "better-auth/node";
import { auth, baseURL, jwtIssuer } from "./authConfig.mjs";

const handler = toNodeHandler(auth);

function writeJson(res, statusCode, payload) {
	res.writeHead(statusCode, { "content-type": "application/json" });
	res.end(JSON.stringify(payload));
}

export default async function authHandler(req, res) {
	try {
		return await handler(req, res);
	} catch (error) {
		const path = req.url ?? "";
		if (path.includes("get-session")) {
			writeJson(res, 200, null);
			return;
		}

		const message = error instanceof Error ? error.message : "Unknown auth runtime error";
		writeJson(res, 500, {
			error: "AUTH_RUNTIME_FAILED",
			message,
		});
	}
}

export { auth, baseURL, jwtIssuer };
