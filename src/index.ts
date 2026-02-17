import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";

const app = new Hono();

// --- Config ---
const port = parseInt(process.env.PORT || "3000");
const githubToken = process.env.GITHUB_TOKEN || "";
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "https://wibholmsolutions.com")
  .split(",")
  .map((o) => o.trim());

// --- CORS ---
app.use(
  "/api/*",
  cors({
    origin: allowedOrigins,
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

// --- Rate limiting (in-memory, per IP) ---
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateMap) {
    if (now > entry.resetAt) rateMap.delete(ip);
  }
}, 10 * 60 * 1000);

// --- Types ---
interface FeedbackBody {
  repo: string;
  title: string;
  description: string;
  type: "bug" | "feature" | "feedback";
  _hp?: string; // honeypot field
}

const typeToLabel: Record<string, string> = {
  bug: "bug",
  feature: "enhancement",
  feedback: "feedback",
};

// --- Health check ---
app.get("/api/feedback/health", (c) => {
  return c.json({ status: "ok", github: githubToken ? "configured" : "missing" });
});

// --- POST /api/feedback ---
app.post("/api/feedback", async (c) => {
  // Rate limiting
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return c.json({ error: "Rate limit exceeded. Try again later." }, 429);
  }

  // Parse body
  let body: FeedbackBody;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  // Honeypot check - if filled, silently succeed (bot trap)
  if (body._hp) {
    return c.json({ message: "Feedback received" }, 201);
  }

  // Validate required fields
  if (!body.repo || !body.title || !body.description || !body.type) {
    return c.json({ error: "Missing required fields: repo, title, description, type" }, 400);
  }

  if (!["bug", "feature", "feedback"].includes(body.type)) {
    return c.json({ error: "Invalid type. Must be: bug, feature, feedback" }, 400);
  }

  // Validate repo format
  if (!/^[\w-]+\/[\w-]+$/.test(body.repo)) {
    return c.json({ error: "Invalid repo format. Expected: owner/repo" }, 400);
  }

  // Build GitHub issue
  const labels = [typeToLabel[body.type], "from-app"].filter(Boolean);
  const issueBody = `${body.description}\n\n---\n*Submitted via feedback widget*`;

  // Create GitHub issue (or fallback to stdout)
  if (!githubToken) {
    console.log("[FALLBACK] GitHub token missing, logging feedback:");
    console.log(JSON.stringify({ repo: body.repo, title: body.title, labels, body: issueBody }));
    return c.json({ message: "Feedback logged (GitHub token not configured)" }, 201);
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${body.repo}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          title: body.title,
          body: issueBody,
          labels,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GitHub API error (${response.status}):`, errorText);
      return c.json({ error: "Failed to create issue" }, 502);
    }

    const issue = (await response.json()) as { html_url: string; number: number };
    console.log(`Issue created: ${issue.html_url}`);
    return c.json({ message: "Feedback received", issue_url: issue.html_url }, 201);
  } catch (err) {
    console.error("GitHub API request failed:", err);
    return c.json({ error: "Failed to create issue" }, 502);
  }
});

// --- Start server ---
console.log(`Feedback API listening on port ${port}`);
serve({ fetch: app.fetch, port });
