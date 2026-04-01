import { toNodeHandler } from "better-auth/node";
import { auth, baseURL, jwtIssuer } from "./authConfig.mjs";

const handler = toNodeHandler(auth);

export default handler;
export { auth, baseURL, jwtIssuer };
