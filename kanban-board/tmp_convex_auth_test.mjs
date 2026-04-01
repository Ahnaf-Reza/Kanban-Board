import { ConvexHttpClient } from "convex/browser";

const convexUrl = "https://deafening-barracuda-313.eu-west-1.convex.cloud";
const email = `debug${Math.floor(Math.random() * 1e9)}@example.com`;
const password = "Passw0rd!123456";
const name = "Debug User";

const signup = await fetch("http://localhost:3000/api/auth/sign-up/email", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password, name }),
});

const setCookie = signup.headers.get("set-cookie");
if (!setCookie) throw new Error("No set-cookie from sign-up");

const cookieHeader = setCookie
  .split(",")
  .map((part) => part.split(";")[0])
  .join("; ");

const tokenResp = await fetch("http://localhost:3000/api/auth/token", {
  headers: { cookie: cookieHeader },
});
const tokenJson = await tokenResp.json();
if (!tokenJson.token) throw new Error(`No token returned: ${JSON.stringify(tokenJson)}`);

const client = new ConvexHttpClient(convexUrl);
client.setAuth(tokenJson.token);
const boardId = await client.mutation("board:bootstrapDefaultBoard", {});
console.log("mutation_ok boardId=", boardId);
