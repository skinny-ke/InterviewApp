import { requireAuth } from "@clerk/express";
import User from "../models/User.js";

export const protectRoute = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const clerkId = req.auth.userId;

      let user = await User.findOne({ clerkId });

      if (!user) {
        // Create user if not exists (you might want to get user data from Clerk)
        user = await User.create({
          clerkId,
          name: req.auth.user?.firstName + ' ' + req.auth.user?.lastName || 'Unknown',
          email: req.auth.user?.primaryEmailAddress?.emailAddress || '',
          profileImage: req.auth.user?.imageUrl || '',
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
