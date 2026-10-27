import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { createApp } from "../src/app.js";
import { User, Workspace, WorkspaceMember, Draft, DraftRevision } from "../src/models/index.js";
import { ROLES, DRAFT_STATUS } from "../src/config/constants.js";

const uri = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/inkloom_test";
const app = createApp();
let available = true;

async function makeUser(email, role, workspace) {
  const user = await User.create({
    name: email,
    email,
    passwordHash: await bcrypt.hash("Password!123", 10),
    lastWorkspace: workspace._id,
  });
  await WorkspaceMember.create({ workspace: workspace._id, user: user._id, role });
  return user;
}

async function login(email) {
  const res = await request(app).post("/api/auth/login").send({ email, password: "Password!123" });
  return res.body.token;
}

describe("http integration", () => {
  before(async () => {
    try {
      await mongoose.connect(uri);
      await mongoose.connection.db.dropDatabase();
    } catch (err) {
      available = false;
      console.warn("Skipping HTTP tests; MongoDB unavailable:", err.message);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });

  it("registers, logs in, and rejects invalid login", async (t) => {
    if (!available) return t.skip();
    const reg = await request(app).post("/api/auth/register").send({
      name: "Ada",
      email: "ada@test.local",
      password: "Password!123",
      workspaceName: "Ada WS",
    });
    assert.equal(reg.status, 201);
    assert.ok(reg.body.token);

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${reg.body.token}`);
    assert.equal(me.status, 200);

    const bad = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@test.local", password: "wrong-pass" });
    assert.equal(bad.status, 401);

    const unauth = await request(app).get("/api/auth/me");
    assert.equal(unauth.status, 401);
  });

  it("enforces workspace isolation and role-restricted approvals", async (t) => {
    if (!available) return t.skip();
    const wsA = await Workspace.create({ name: "A", slug: "a-iso", createdBy: new mongoose.Types.ObjectId() });
    const wsB = await Workspace.create({ name: "B", slug: "b-iso", createdBy: new mongoose.Types.ObjectId() });
    const creatorA = await makeUser("ca@test.local", ROLES.CREATOR, wsA);
    const creatorB = await makeUser("cb@test.local", ROLES.CREATOR, wsB);
    const reviewerA = await makeUser("ra@test.local", ROLES.REVIEWER, wsA);
    const tokenA = await login("ca@test.local");
    const tokenB = await login("cb@test.local");
    const tokenR = await login("ra@test.local");

    const draft = await Draft.create({
      workspace: wsA._id,
      creator: creatorA._id,
      title: "Secret",
      contentType: "blog_post",
      originalContent: "Hello",
      currentContent: "Hello",
      status: DRAFT_STATUS.PENDING_APPROVAL,
      currentRevision: 1,
    });

    const cross = await request(app)
      .get(`/api/drafts/${draft._id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .set("X-Workspace-Id", String(wsA._id));
    assert.equal(cross.status, 403);

    const hidden = await request(app)
      .get(`/api/drafts/${draft._id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .set("X-Workspace-Id", String(wsB._id));
    assert.equal(hidden.status, 404);

    const creatorApprove = await request(app)
      .post(`/api/drafts/${draft._id}/approve`)
      .set("Authorization", `Bearer ${tokenA}`)
      .set("X-Workspace-Id", String(wsA._id))
      .send({ reason: "nope" });
    assert.equal(creatorApprove.status, 403);

    const ok = await request(app)
      .post(`/api/drafts/${draft._id}/approve`)
      .set("Authorization", `Bearer ${tokenR}`)
      .set("X-Workspace-Id", String(wsA._id))
      .send({ reason: "looks good" });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.draft.status, DRAFT_STATUS.APPROVED);
    void creatorB;
    void reviewerA;
  });

  it("runs draft submit, revision, changes, resubmit, reject, and audit", async (t) => {
    if (!available) return t.skip();
    const ws = await Workspace.create({ name: "Flow", slug: "flow-ws", createdBy: new mongoose.Types.ObjectId() });
    const creator = await makeUser("flowc@test.local", ROLES.CREATOR, ws);
    await makeUser("flowm@test.local", ROLES.MANAGER, ws);
    await makeUser("flowr@test.local", ROLES.REVIEWER, ws);
    const cToken = await login("flowc@test.local");
    const mToken = await login("flowm@test.local");
    const rToken = await login("flowr@test.local");
    const headers = (token) => ({ Authorization: `Bearer ${token}`, "X-Workspace-Id": String(ws._id) });

    const created = await request(app)
      .post("/api/drafts")
      .set(headers(cToken))
      .send({ title: "Flow draft", contentType: "blog_post", content: "NovaPay is ready." });
    assert.equal(created.status, 201);
    const id = created.body.draft._id;

    const edited = await request(app)
      .put(`/api/drafts/${id}`)
      .set(headers(cToken))
      .send({ content: "NovaPay is ready for review." });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.draft.currentRevision, 2);

    const revs = await request(app).get(`/api/drafts/${id}/revisions`).set(headers(cToken));
    assert.ok(revs.body.items.length >= 2);

    await Draft.findByIdAndUpdate(id, { status: DRAFT_STATUS.AI_REVIEWED, lastReviewedAt: new Date() });

    const submitted = await request(app).post(`/api/drafts/${id}/submit`).set(headers(cToken));
    assert.equal(submitted.body.draft.status, DRAFT_STATUS.PENDING_APPROVAL);

    const changes = await request(app)
      .post(`/api/drafts/${id}/request-changes`)
      .set(headers(mToken))
      .send({ reason: "Please soften the claim." });
    assert.equal(changes.status, 200);
    assert.equal(changes.body.draft.status, DRAFT_STATUS.CHANGES_REQUESTED);

    const resub = await request(app).post(`/api/drafts/${id}/submit`).set(headers(cToken));
    assert.equal(resub.body.draft.status, DRAFT_STATUS.RESUBMITTED);

    const rejected = await request(app)
      .post(`/api/drafts/${id}/reject`)
      .set(headers(rToken))
      .send({ reason: "Still too strong." });
    assert.equal(rejected.body.draft.status, DRAFT_STATUS.REJECTED);

    const audit = await request(app).get("/api/audit-logs").set(headers(cToken));
    assert.equal(audit.status, 403);

    await WorkspaceMember.updateOne({ workspace: ws._id, user: creator._id }, { role: ROLES.ADMIN });
    const adminToken = await login("flowc@test.local");
    const logs = await request(app).get("/api/audit-logs").set(headers(adminToken));
    assert.equal(logs.status, 200);
    assert.ok(logs.body.items.length > 0);
  });

  it("rejects invalid upload types via API", async (t) => {
    if (!available) return t.skip();
    const ws = await Workspace.create({ name: "Files", slug: "files-ws", createdBy: new mongoose.Types.ObjectId() });
    await makeUser("fileadmin@test.local", ROLES.ADMIN, ws);
    const token = await login("fileadmin@test.local");
    const res = await request(app)
      .post("/api/sources/upload")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Workspace-Id", String(ws._id))
      .attach("file", Buffer.from("not-a-pdf"), { filename: "malware.exe", contentType: "application/x-msdownload" });
    assert.equal(res.status, 400);
  });
});
