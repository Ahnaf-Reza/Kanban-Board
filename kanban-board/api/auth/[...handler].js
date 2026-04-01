import { toNodeHandler } from "better-auth/node";

function writeJson(res, statusCode, payload) {
	res.writeHead(statusCode, { "content-type": "application/json" });
	res.end(JSON.stringify(payload));
}

export default async function authHandler(req, res) {
	let handler;

	try {
		const authModule = await import("./authConfig.mjs");
		handler = toNodeHandler(authModule.auth);
	} catch (error) {
		const path = req.url ?? "";
		if (path.includes("get-session")) {
			writeJson(res, 200, null);
			return;
		}

		const message = error instanceof Error ? error.message : "Unknown auth init error";
		writeJson(res, 500, {
			error: "AUTH_INIT_FAILED",
			message,
		});
		return;
	}

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
