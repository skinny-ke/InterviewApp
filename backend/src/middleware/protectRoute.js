import { requireAuth } from "@clerk/express";
import User from "../models/User.js";

export const protectRoute = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const clerkId = req.auth.userId;
      const clerkUser = req.auth;

      let user = await User.findOne({ clerkId });

      if (!user) {
        // Get user info from Clerk
        const userInfo = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
          headers: {
            Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (!userInfo.ok) {
          console.error("Failed to fetch user info from Clerk");
          return res.status(500).json({ message: "Failed to authenticate user" });
        }

        const userData = await userInfo.json();

        // Create user if not exists
        user = await User.create({
          clerkId,
          name: userData.first_name && userData.last_name
            ? `${userData.first_name} ${userData.last_name}`
            : userData.username || 'User',
          email: userData.email_addresses?.[0]?.email_address || `${clerkId}@clerk.local`,
          profileImage: userData.image_url || '',
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
