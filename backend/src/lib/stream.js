import { StreamChat } from "stream-chat";
import { StreamClient } from "@stream-io/node-sdk";
import { ENV } from "./env.js";

const apiKey = ENV.STREAM_API_KEY;
const apiSecret = ENV.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
  console.error("STREAM_API_KEY or STREAM_API_SECRET is missing");
  throw new Error("Stream API credentials are not configured");
}

// Initialize Stream clients
let chatClientInstance = null;
let streamClientInstance = null;

try {
  chatClientInstance = StreamChat.getInstance(apiKey, apiSecret);
  console.log("✅ Stream Chat client initialized");
} catch (error) {
  console.error("❌ Failed to initialize Stream Chat client:", error);
  throw error;
}

try {
  streamClientInstance = new StreamClient(apiKey, apiSecret);
  console.log("✅ Stream Video client initialized");
} catch (error) {
  console.error("❌ Failed to initialize Stream Video client:", error);
  throw error;
}

export const chatClient = chatClientInstance; // will be used chat features
export const streamClient = streamClientInstance; // will be used for video calls

export const upsertStreamUser = async (userData) => {
  try {
    await chatClient.upsertUser(userData);
    console.log("Stream user upserted successfully:", userData);
  } catch (error) {
    console.error("Error upserting Stream user:", error);
  }
};

export const deleteStreamUser = async (userId) => {
  try {
    await chatClient.deleteUser(userId);
    console.log("Stream user deleted successfully:", userId);
  } catch (error) {
    console.error("Error deleting the Stream user:", error);
  }
};
