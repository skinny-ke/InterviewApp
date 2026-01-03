import { chatClient, streamClient } from "../lib/stream.js";
import Session from "../models/Session.js";

export async function createSession(req, res) {
  try {
    const { problem, difficulty } = req.body;
    const userId = req.user._id;
    const clerkId = req.user.clerkId;

    console.log(`Create session attempt: userId=${userId}, clerkId=${clerkId}, problem=${problem}, difficulty=${difficulty}`);

    if (!problem || !difficulty) {
      return res.status(400).json({ message: "Problem and difficulty are required" });
    }

    // generate a unique call id for stream video
    const callId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    console.log(`Generated callId: ${callId}`);

    // create session in db
    const session = await Session.create({ problem, difficulty, host: userId, callId });
    console.log(`Session created in DB: ${session._id}`);

    // create stream video call
    try {
      console.log(`Creating Stream video call: callId=${callId}, clerkId=${clerkId}`);
      await streamClient.video.call("default", callId).getOrCreate({
        data: {
          created_by_id: clerkId,
          custom: { problem, difficulty, sessionId: session._id.toString() },
        },
      });
      console.log(`Stream video call created successfully: ${callId}`);
    } catch (streamError) {
      console.error("Stream video call creation failed:", streamError);
      console.error("Stream error details:", streamError.response?.data || streamError.message);
      // Clean up the database session if Stream call creation fails
      await Session.findByIdAndDelete(session._id);
      return res.status(500).json({
        message: "Failed to create video room. Please try again.",
        details: streamError.message
      });
    }

    // chat messaging
    try {
      console.log(`Creating Stream chat channel: callId=${callId}, clerkId=${clerkId}`);
      const channel = chatClient.channel("messaging", callId, {
        name: `${problem} Session`,
        created_by_id: clerkId,
        members: [clerkId],
      });

      await channel.create();
      console.log(`Stream chat channel created successfully: ${callId}`);
    } catch (chatError) {
      console.error("Stream chat channel creation failed:", chatError);
      console.error("Chat error details:", chatError.response?.data || chatError.message);
      // Clean up the database session and Stream call if chat creation fails
      await Session.findByIdAndDelete(session._id);
      try {
        await streamClient.video.call("default", callId).delete({ hard: true });
      } catch (cleanupError) {
        console.error("Failed to cleanup Stream call:", cleanupError);
      }
      return res.status(500).json({
        message: "Failed to create chat room. Please try again.",
        details: chatError.message
      });
    }

    console.log(`Session created successfully: ${session._id}`);
    res.status(201).json({ session });
  } catch (error) {
    console.error("Error in createSession controller:", error);
    console.error("Full error stack:", error.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getActiveSessions(_, res) {
  try {
    const sessions = await Session.find({ status: "active" })
      .populate("host", "name profileImage email clerkId")
      .populate("participant", "name profileImage email clerkId")
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({ sessions });
  } catch (error) {
    console.log("Error in getActiveSessions controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getMyRecentSessions(req, res) {
  try {
    const userId = req.user._id;

    // get sessions where user is either host or participant
    const sessions = await Session.find({
      status: "completed",
      $or: [{ host: userId }, { participant: userId }],
    })
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({ sessions });
  } catch (error) {
    console.log("Error in getMyRecentSessions controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getSessionById(req, res) {
  try {
    const { id } = req.params;

    const session = await Session.findById(id)
      .populate("host", "name email profileImage clerkId")
      .populate("participant", "name email profileImage clerkId");

    if (!session) return res.status(404).json({ message: "Session not found" });

    res.status(200).json({ session });
  } catch (error) {
    console.log("Error in getSessionById controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function joinSession(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const clerkId = req.user.clerkId;

    console.log(`Join session attempt: userId=${userId}, clerkId=${clerkId}, sessionId=${id}`);

    const session = await Session.findById(id);

    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.status !== "active") {
      return res.status(400).json({ message: "Cannot join a completed session" });
    }

    console.log(`Session host: ${session.host.toString()}, userId: ${userId.toString()}`);

    if (session.host.toString() === userId.toString()) {
      console.log("Host trying to join their own session");
      return res.status(400).json({ message: "Host cannot join their own session as participant" });
    }

    // check if session is already full - has a participant
    if (session.participant) return res.status(409).json({ message: "Session is full" });

    session.participant = userId;
    await session.save();

    try {
      const channel = chatClient.channel("messaging", session.callId);
      await channel.addMembers([clerkId]);
    } catch (chatError) {
      console.error("Failed to add member to chat channel:", chatError);
      // Revert the participant addition
      session.participant = null;
      await session.save();
      return res.status(500).json({
        message: "Failed to add user to session chat",
        details: chatError.message
      });
    }

    res.status(200).json({ session });
  } catch (error) {
    console.error("Error in joinSession controller:", error);
    console.error("Full error stack:", error.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function endSession(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const session = await Session.findById(id);

    if (!session) return res.status(404).json({ message: "Session not found" });

    // check if user is the host
    if (session.host.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the host can end the session" });
    }

    // check if session is already completed
    if (session.status === "completed") {
      return res.status(400).json({ message: "Session is already completed" });
    }

    // delete stream video call
    try {
      const call = streamClient.video.call("default", session.callId);
      await call.delete({ hard: true });
    } catch (streamError) {
      console.error("Failed to delete Stream video call:", streamError);
      // Continue with chat deletion and database update even if Stream call deletion fails
    }

    // delete stream chat channel
    try {
      const channel = chatClient.channel("messaging", session.callId);
      await channel.delete();
    } catch (chatError) {
      console.error("Failed to delete Stream chat channel:", chatError);
      // Continue with database update even if chat deletion fails
    }

    session.status = "completed";
    await session.save();

    res.status(200).json({ session, message: "Session ended successfully" });
  } catch (error) {
    console.error("Error in endSession controller:", error);
    console.error("Full error stack:", error.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
