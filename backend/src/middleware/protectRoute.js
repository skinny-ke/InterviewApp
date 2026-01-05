import { clerkClient, requireAuth } from "@clerk/express";
import User from "../models/User.js";

export const protectRoute = [
  requireAuth({
    onError: (err, req, res) => {
      return res.status(401).json({ message: "Unauthorized" });
    },
  }),
  async (req, res, next) => {
    try {
      const clerkId = req.auth.userId;

      let user = await User.findOne({ clerkId });

      if (!user) {
        // Get user from Clerk SDK (NOT fetch)
        const clerkUser = await clerkClient.users.getUser(clerkId);

        user = await User.create({
          clerkId,
          name: clerkUser.firstName && clerkUser.lastName
            ? `${clerkUser.firstName} ${clerkUser.lastName}`
            : clerkUser.username || "User",
          email: clerkUser.emailAddresses?.[0]?.emailAddress,
          profileImage: clerkUser.imageUrl || "",
        });
      }

      req.user = user;
      next();
    } catch (err) {
      console.error("protectRoute error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
];
