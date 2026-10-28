import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDb() {
  mongoose.set("strictQuery", true);
  // Reuse the active connection in Vercel's warm serverless instances.
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!globalThis.__inkloomMongoConnect) {
    globalThis.__inkloomMongoConnect = mongoose.connect(env.mongoUri).catch((err) => {
      globalThis.__inkloomMongoConnect = undefined;
      throw err;
    });
  }
  await globalThis.__inkloomMongoConnect;
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
