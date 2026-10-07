import { serve } from "@hono/node-server";
import { app } from "./app";

const port = parseInt(process.env.PORT || "3000");

// --- Start server ---
console.log(`Feedback API listening on port ${port}`);
serve({ fetch: app.fetch, port });
