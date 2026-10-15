import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";

import app from "../src/app.js";
import User from "../src/models/User.js";
import Project from "../src/models/Project.js";
import Task from "../src/models/Task.js";

const TEST_JWT_SECRET = "taskflow-test-only-secret-do-not-use-in-production";
let mongoServer: MongoMemoryServer;

type TestUser = {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
};

type TestProject = {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
};

function cookieFor(userId: string): string {
  const token = jwt.sign({}, TEST_JWT_SECRET, {
    subject: userId,
    expiresIn: "1h",
  });
  return `token=${token}`;
}

async function createUser(label: string): Promise<TestUser> {
  const user = await User.create({
    name: `User ${label}`,
    email: `${label.toLowerCase()}-${new mongoose.Types.ObjectId().toString()}@example.test`,
    passwordHash: "test-only-password-hash",
  });
  return user as unknown as TestUser;
}

async function createProject(
  owner: TestUser,
  members: Array<{ user: TestUser; role: "admin" | "member" }> = []
): Promise<TestProject> {
  const project = await Project.create({
    name: `Project ${new mongoose.Types.ObjectId().toString().slice(-6)}`,
    description: "Authorization test project",
    owner: owner._id,
    members: [
      { user: owner._id, role: "admin" },
      ...members.map((member) => ({ user: member.user._id, role: member.role })),
    ],
  });
  return project as unknown as TestProject;
}

async function createTask(
  project: TestProject,
  createdBy: TestUser,
  overrides: Record<string, unknown> = {}
) {
  return Task.create({
    title: "Test task",
    description: "Authorization test task",
    project: project._id,
    createdBy: createdBy._id,
    status: "todo",
    priority: "medium",
    position: 0,
    ...overrides,
  });
}

beforeAll(async () => {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Project.deleteMany({}),
    Task.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe("TaskFlow AI authorization", () => {
  it("rejects project and task API requests without authentication", async () => {
    const projectsResponse = await request(app).get("/api/v1/projects");
    expect(projectsResponse.status).toBe(401);

    const tasksResponse = await request(app).get(
      `/api/v1/projects/${new mongoose.Types.ObjectId().toString()}/tasks`
    );
    expect(tasksResponse.status).toBe(401);
  });

  it("does not let a user read another user's private project", async () => {
    const userA = await createUser("a");
    const userB = await createUser("b");
    const privateProject = await createProject(userB);

    const response = await request(app)
      .get(`/api/v1/projects/${privateProject._id.toString()}`)
      .set("Cookie", cookieFor(userA._id.toString()));

    expect(response.status).toBe(404);
  });

  it("does not list another user's private project", async () => {
    const userA = await createUser("a");
    const userB = await createUser("b");
    await createProject(userB);

    const response = await request(app)
      .get("/api/v1/projects")
      .set("Cookie", cookieFor(userA._id.toString()));

    expect(response.status).toBe(200);
    expect(response.body.projects).toHaveLength(0);
  });

  it("does not let a user read another user's private task", async () => {
    const userA = await createUser("a");
    const userB = await createUser("b");
    const privateProject = await createProject(userB);
    const task = await createTask(privateProject, userB);

    const response = await request(app)
      .get(`/api/v1/tasks/${task._id.toString()}`)
      .set("Cookie", cookieFor(userA._id.toString()));

    expect(response.status).toBe(404);
  });

  it("allows a project member to edit and move a task", async () => {
    const owner = await createUser("owner");
    const member = await createUser("member");
    const project = await createProject(owner, [{ user: member, role: "member" }]);
    const task = await createTask(project, owner);
    const cookie = cookieFor(member._id.toString());

    const editResponse = await request(app)
      .patch(`/api/v1/tasks/${task._id.toString()}`)
      .set("Cookie", cookie)
      .send({ title: "Edited by member", priority: "high" });

    expect(editResponse.status).toBe(200);
    expect(editResponse.body.task.title).toBe("Edited by member");
    expect(editResponse.body.task.priority).toBe("high");

    const moveResponse = await request(app)
      .patch(`/api/v1/tasks/${task._id.toString()}/move`)
      .set("Cookie", cookie)
      .send({ status: "in_progress", position: 2 });

    expect(moveResponse.status).toBe(200);
    expect(moveResponse.body.task.status).toBe("in_progress");
    expect(moveResponse.body.task.position).toBe(2);
  });

  it("does not let a non-admin member delete another user's task", async () => {
    const owner = await createUser("owner");
    const member = await createUser("member");
    const project = await createProject(owner, [{ user: member, role: "member" }]);
    const task = await createTask(project, owner);

    const response = await request(app)
      .delete(`/api/v1/tasks/${task._id.toString()}`)
      .set("Cookie", cookieFor(member._id.toString()));

    expect(response.status).toBe(403);
    expect(await Task.exists({ _id: task._id })).not.toBeNull();
  });

  it("allows the task creator to delete their task", async () => {
    const owner = await createUser("owner");
    const member = await createUser("member");
    const project = await createProject(owner, [{ user: member, role: "member" }]);
    const task = await createTask(project, member);

    const response = await request(app)
      .delete(`/api/v1/tasks/${task._id.toString()}`)
      .set("Cookie", cookieFor(member._id.toString()));

    expect(response.status).toBe(200);
    expect(await Task.exists({ _id: task._id })).toBeNull();
  });

  it("does not let a non-admin member update or delete a project", async () => {
    const owner = await createUser("owner");
    const member = await createUser("member");
    const project = await createProject(owner, [{ user: member, role: "member" }]);
    const cookie = cookieFor(member._id.toString());

    const updateResponse = await request(app)
      .patch(`/api/v1/projects/${project._id.toString()}`)
      .set("Cookie", cookie)
      .send({ name: "Unauthorized rename" });

    expect(updateResponse.status).toBe(403);

    const deleteResponse = await request(app)
      .delete(`/api/v1/projects/${project._id.toString()}`)
      .set("Cookie", cookie);

    expect(deleteResponse.status).toBe(403);
    expect(await Project.exists({ _id: project._id })).not.toBeNull();
  });

  it("rejects assigning a task to a user who is not a project member", async () => {
    const owner = await createUser("owner");
    const outsider = await createUser("outsider");
    const project = await createProject(owner);

    const response = await request(app)
      .post(`/api/v1/projects/${project._id.toString()}/tasks`)
      .set("Cookie", cookieFor(owner._id.toString()))
      .send({ title: "Task with invalid assignee", assignee: outsider._id.toString() });

    expect(response.status).toBe(400);
    expect(await Task.countDocuments({ project: project._id })).toBe(0);
  });

  it("allows an authorized project member to create a task", async () => {
    const owner = await createUser("owner");
    const member = await createUser("member");
    const project = await createProject(owner, [{ user: member, role: "member" }]);

    const response = await request(app)
      .post(`/api/v1/projects/${project._id.toString()}/tasks`)
      .set("Cookie", cookieFor(member._id.toString()))
      .send({ title: "Member-created task", status: "todo", priority: "medium" });

    expect(response.status).toBe(201);
    expect(response.body.task.title).toBe("Member-created task");
    expect(response.body.task.createdBy.toString()).toBe(member._id.toString());
  });
});
