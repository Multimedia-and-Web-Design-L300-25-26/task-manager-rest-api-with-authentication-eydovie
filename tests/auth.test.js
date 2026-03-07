import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../src/app.js";

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("POST /api/auth/register", () => {
  it("should register a new user and not return password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@email.com", password: "123456" });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("email");
    expect(res.body).not.toHaveProperty("password");
  });

  it("should fail if email is already taken", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "duplicate@email.com", password: "123456" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "duplicate@email.com", password: "123456" });

    expect(res.statusCode).toBe(400);
  });

  it("should fail if email is missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ password: "123456" });

    expect(res.statusCode).toBe(400);
  });

  it("should fail if password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "nopass@email.com" });

    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("should login and return a JWT token", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@email.com", password: "123456" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  it("should fail with wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@email.com", password: "wrongpassword" });

    expect(res.statusCode).toBe(400);
  });

  it("should fail with non existent email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@email.com", password: "123456" });

    expect(res.statusCode).toBe(400);
  });
});
