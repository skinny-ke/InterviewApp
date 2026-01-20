import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { serve } from "inngest/express";
import { clerkMiddleware } from "@clerk/express";

import { ENV } from "./lib/env.js";
import { connectDB } from "./lib/db.js";
import { inngest, functions } from "./lib/inngest.js";

import chatRoutes from "./routes/chatRoutes.js";
import sessionRoutes from "./routes/sessionRoute.js";

const app = express();

// JSON middleware
app.use(express.json());

console.log("Backend CLIENT_URL:", ENV.CLIENT_URL);

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin} - Auth: ${req.headers.authorization ? 'Present' : 'None'}`);
  next();
});

// CORS setup
const allowedOrigins = [
  ENV.CLIENT_URL,                        // frontend URL from .env
  "http://localhost:5173",               // local dev
  "http://localhost:5174",
  "https://interview-app-rose.vercel.app",
  "https://interviewapp.pages.dev"
];

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true
}));

// Clerk middleware
app.use(clerkMiddleware());

// Routes
app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/chat", chatRoutes);
app.use("/api/sessions", sessionRoutes);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ msg: "API is up and running" });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Start server
const startServer = async () => {
  try {
    await connectDB();
    const host = process.env.HOST || "0.0.0.0";
    app.listen(ENV.PORT, host, () =>
      console.log(`Server is running on http://${host === "0.0.0.0" ? "localhost" : host}:${ENV.PORT}`)
    );
  } catch (error) {
    console.error("💥 Error starting the server", error);
    process.exit(1);
  }
};

startServer();
