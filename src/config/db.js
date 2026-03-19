import mongoose from "mongoose";

export async function connectDB() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in environment variables");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");
}
