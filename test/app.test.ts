import { describe, it, expect } from "vitest";
import { app } from "../src/app";

describe("Feedback API", () => {
  it("GET /api/feedback/health returns 200", async () => {
    const res = await app.request("/api/feedback/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", github: "missing", service: "feedback-api" });
  });

  it("POST /api/feedback with valid body returns 201", async () => {
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.10" },
      body: JSON.stringify({ repo: "owner/repo", title: "Test", type: "bug" }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ message: "Feedback logged (GitHub token not configured)" });
  });

  it("POST /api/feedback missing repo returns 400", async () => {
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.11" },
      body: JSON.stringify({ title: "Test", type: "bug" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Missing required fields: repo, title, type" });
  });

  it("POST /api/feedback invalid type returns 400", async () => {
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.12" },
      body: JSON.stringify({ repo: "owner/repo", title: "Test", type: "other" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid type. Must be: bug, feature, feedback" });
  });

  it("POST /api/feedback invalid repo format returns 400", async () => {
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.13" },
      body: JSON.stringify({ repo: "not-a-valid-repo", title: "Test", type: "bug" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid repo format. Expected: owner/repo" });
  });

  it("POST /api/feedback with honeypot returns 201", async () => {
    const res = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.14" },
      body: JSON.stringify({ _hp: "spam" }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ message: "Feedback received" });
  });

  it("POST /api/feedback rate limiting after 5 requests", async () => {
    const res1 = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.99" },
      body: JSON.stringify({ repo: "owner/repo", title: "Test", type: "bug" }),
    });
    expect(res1.status).toBe(201);

    const res2 = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.99" },
      body: JSON.stringify({ repo: "owner/repo", title: "Test", type: "bug" }),
    });
    expect(res2.status).toBe(201);

    const res3 = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.99" },
      body: JSON.stringify({ repo: "owner/repo", title: "Test", type: "bug" }),
    });
    expect(res3.status).toBe(201);

    const res4 = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.99" },
      body: JSON.stringify({ repo: "owner/repo", title: "Test", type: "bug" }),
    });
    expect(res4.status).toBe(201);

    const res5 = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.99" },
      body: JSON.stringify({ repo: "owner/repo", title: "Test", type: "bug" }),
    });
    expect(res5.status).toBe(201);

    const res6 = await app.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.99" },
      body: JSON.stringify({ repo: "owner/repo", title: "Test", type: "bug" }),
    });
    expect(res6.status).toBe(429);
    expect(await res6.json()).toEqual({ error: "Rate limit exceeded. Try again later." });
  });
});
