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

      // Get user from Clerk SDK
      const clerkUser = await clerkClient.users.getUser(clerkId);

      // Try to upsert user by clerkId, but catch duplicate key errors and find existing user
      let user;
      try {
        user = await User.findOneAndUpdate(
          { clerkId },
          {
            clerkId,
            name: clerkUser.firstName && clerkUser.lastName
              ? `${clerkUser.firstName} ${clerkUser.lastName}`
              : clerkUser.username || "User",
            email: clerkUser.emailAddresses?.[0]?.emailAddress,
            profileImage: clerkUser.imageUrl || "",
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        // If duplicate key error (existing email), just find by clerkId or email
        if (err.code === 11000) {
          user = await User.findOne({ 
            $or: [{ clerkId }, { email: clerkUser.emailAddresses?.[0]?.emailAddress }]
          });
          if (!user) {
            // If still not found, create without email (fallback)
            user = await User.create({
              clerkId,
              name: clerkUser.firstName && clerkUser.lastName
                ? `${clerkUser.firstName} ${clerkUser.lastName}`
                : clerkUser.username || "User",
              email: clerkUser.emailAddresses?.[0]?.emailAddress || `clerk_${clerkId}@system.local`,
              profileImage: clerkUser.imageUrl || "",
            });
          }
        } else {
          throw err;
        }
      }

      req.user = user;
      next();
    } catch (err) {
      console.error("protectRoute error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
];
