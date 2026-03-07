import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../src/app.js";

let mongoServer;
let token; // stores the JWT after login
let taskId; // stores a created task's ID for delete test

// runs once before all tests — sets up in-memory MongoDB
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // register and login a user to get a token
  await request(app)
    .post("/api/auth/register")
    .send({ email: "taskuser@email.com", password: "123456" });

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "taskuser@email.com", password: "123456" });

  token = loginRes.body.token;
});

// runs once after all tests — tears down in-memory MongoDB
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// ─────────────────────────────────────────────
// POST /api/tasks
// ─────────────────────────────────────────────
describe("POST /api/tasks", () => {
  it("should create a task for authenticated user", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "My first task" });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("_id");
    expect(res.body).toHaveProperty("title", "My first task");

    taskId = res.body._id; // save for delete test later
  });

  it("should reject request with no token", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .send({ title: "Should fail" });

    expect(res.statusCode).toBe(401);
  });

  it("should reject request with invalid token", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", "Bearer faketoken123")
      .send({ title: "Should also fail" });

    expect(res.statusCode).toBe(401);
  });
});

// ─────────────────────────────────────────────
// GET /api/tasks
// ─────────────────────────────────────────────
describe("GET /api/tasks", () => {
  it("should return only the authenticated users tasks", async () => {
    const res = await request(app)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("should not return another users tasks", async () => {
    // register and login a second user
    await request(app)
      .post("/api/auth/register")
      .send({ email: "otheruser@email.com", password: "123456" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "otheruser@email.com", password: "123456" });

    const otherToken = loginRes.body.token;

    // second user should have no tasks
    const res = await request(app)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(0);
  });

  it("should reject request with no token", async () => {
    const res = await request(app).get("/api/tasks");

    expect(res.statusCode).toBe(401);
  });
});

// ─────────────────────────────────────────────
// DELETE /api/tasks/:id
// ─────────────────────────────────────────────
describe("DELETE /api/tasks/:id", () => {
  it("should allow owner to delete their task", async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
  });

  it("should return 404 for a task that does not exist", async () => {
    const fakeId = "64b1f5f5f5f5f5f5f5f5f5f5";
    const res = await request(app)
      .delete(`/api/tasks/${fakeId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(404);
  });

  it("should reject delete with no token", async () => {
    const res = await request(app).delete(`/api/tasks/${taskId}`);

    expect(res.statusCode).toBe(401);
  });

  it("should return 404 if a different user tries to delete the task", async () => {
    const createRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Task to be stolen" });

    const newTaskId = createRes.body._id;

    // login as the other user
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "otheruser@email.com", password: "123456" });

    const otherToken = loginRes.body.token;

    // other user tries to delete it
    const res = await request(app)
      .delete(`/api/tasks/${newTaskId}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.statusCode).toBe(404);
  });
});
