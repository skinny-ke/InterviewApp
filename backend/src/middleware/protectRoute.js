import { requireAuth } from "@clerk/express";
import User from "../models/User.js";

export const protectRoute = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const clerkId = req.auth.userId;

      let user = await User.findOne({ clerkId });

      if (!user) {
        // Create user if not exists - basic info, can be updated later
        user = await User.create({
          clerkId,
          name: 'User', // Placeholder, can be updated with actual name
          email: '',
          profileImage: '',
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
