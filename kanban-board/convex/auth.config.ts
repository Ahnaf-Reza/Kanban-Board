export default {
  providers: [
    {
      domain: process.env.CONVEX_BETTER_AUTH_DOMAIN || "https://kanban-board-gules-three.vercel.app/api/auth",
      applicationID: "convex",
    },
  ],
};
