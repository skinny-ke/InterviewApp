import { requireAuth } from "@clerk/express";
import User from "../models/User.js";

export const protectRoute = [
  // Temporarily disable Clerk auth for testing
  // requireAuth(),
  async (req, res, next) => {
    try {
      // For testing, create a mock user if none exists
      let user = await User.findOne({ clerkId: "test-user-123" });

      if (!user) {
        user = await User.create({
          clerkId: "test-user-123",
          name: "Test User",
          email: "test@example.com",
          profileImage: "",
        });
      }

      // attach user to req
      req.user = user;

      next();
    } catch (error) {
      console.error("Error in protectRoute middleware", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
];
