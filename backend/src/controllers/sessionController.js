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

    // create session in db with empty participants array
    const session = await Session.create({ 
      problem, 
      difficulty, 
      host: userId, 
      callId,
      participants: [] // Initialize with empty array
    });
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
      .populate("participants", "name profileImage email clerkId")
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
      $or: [{ host: userId }, { participants: userId }],
    })
      .populate("host", "name profileImage email clerkId")
      .populate("participants", "name profileImage email clerkId")
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
      .populate("participants", "name email profileImage clerkId");

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

    const session = await Session.findById(id).populate("participants", "_id clerkId");

    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.status !== "active") {
      return res.status(400).json({ message: "Cannot join a completed session" });
    }

    console.log(`Session host: ${session.host.toString()}, userId: ${userId.toString()}`);

    // Check if user is already the host
    if (session.host.toString() === userId.toString()) {
      console.log("Host accessing their own session - allowing rejoin");
      // Host can always rejoin their session
      const populatedSession = await Session.findById(id)
        .populate("host", "name profileImage email clerkId")
        .populate("participants", "name profileImage email clerkId");
      return res.status(200).json({ session: populatedSession, message: "Rejoined as host" });
    }

    // Check if user is already a participant
    const isAlreadyParticipant = session.participants.some(
      (p) => p._id.toString() === userId.toString()
    );
    
    if (isAlreadyParticipant) {
      console.log("User is already a participant - allowing rejoin");
      // Allow rejoin if already a participant
      const populatedSession = await Session.findById(id)
        .populate("host", "name profileImage email clerkId")
        .populate("participants", "name profileImage email clerkId");
      return res.status(200).json({ session: populatedSession, message: "Rejoined as participant" });
    }

    // Check if session is full
    const maxParticipants = session.maxParticipants || 10;
    if (session.participants.length >= maxParticipants) {
      return res.status(409).json({ message: `Session is full (max ${maxParticipants} participants)` });
    }

    // Add user to participants
    session.participants.push(userId);
    await session.save();

    try {
      const channel = chatClient.channel("messaging", session.callId);
      await channel.addMembers([clerkId]);
    } catch (chatError) {
      console.error("Failed to add member to chat channel:", chatError);
      // Revert the participant addition
      session.participants = session.participants.filter(
        (p) => p.toString() !== userId.toString()
      );
      await session.save();
      return res.status(500).json({
        message: "Failed to add user to session chat",
        details: chatError.message
      });
    }

    const populatedSession = await Session.findById(id)
      .populate("host", "name profileImage email clerkId")
      .populate("participants", "name profileImage email clerkId");

    res.status(200).json({ session: populatedSession });
  } catch (error) {
    console.error("Error in joinSession controller:", error);
    console.error("Full error stack:", error.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function leaveSession(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const clerkId = req.user.clerkId;

    const session = await Session.findById(id).populate("participants", "_id clerkId");

    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.status === "completed") {
      return res.status(400).json({ message: "Cannot leave a completed session" });
    }

    // Host cannot leave their own session - they must end it
    if (session.host.toString() === userId.toString()) {
      return res.status(400).json({ message: "Host cannot leave session. Use end session instead." });
    }

    // Remove user from participants if they are a participant
    const wasParticipant = session.participants.some(
      (p) => p._id.toString() === userId.toString()
    );

    if (!wasParticipant) {
      return res.status(400).json({ message: "You are not a participant in this session" });
    }

    session.participants = session.participants.filter(
      (p) => p._id.toString() !== userId.toString()
    );
    await session.save();

    // Remove user from chat channel
    try {
      const channel = chatClient.channel("messaging", session.callId);
      await channel.removeMembers([clerkId]);
    } catch (chatError) {
      console.error("Failed to remove member from chat channel:", chatError);
      // Continue even if chat removal fails
    }

    const populatedSession = await Session.findById(id)
      .populate("host", "name profileImage email clerkId")
      .populate("participants", "name profileImage email clerkId");

    res.status(200).json({ session: populatedSession, message: "Left session successfully" });
  } catch (error) {
    console.error("Error in leaveSession controller:", error);
    console.error("Full error stack:", error.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function removeParticipant(req, res) {
  try {
    const { id } = req.params;
    const { participantId } = req.body;
    const userId = req.user._id;

    const session = await Session.findById(id).populate("participants", "_id clerkId");

    if (!session) return res.status(404).json({ message: "Session not found" });

    // Only host can remove participants
    if (session.host.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the host can remove participants" });
    }

    if (!participantId) {
      return res.status(400).json({ message: "participantId is required" });
    }

    // Find the participant to remove
    const participant = session.participants.find(
      (p) => p._id.toString() === participantId
    );

    if (!participant) {
      return res.status(404).json({ message: "Participant not found in session" });
    }

    // Remove participant
    session.participants = session.participants.filter(
      (p) => p._id.toString() !== participantId
    );
    await session.save();

    // Remove participant from chat channel
    try {
      const channel = chatClient.channel("messaging", session.callId);
      await channel.removeMembers([participant.clerkId]);
    } catch (chatError) {
      console.error("Failed to remove member from chat channel:", chatError);
      // Continue even if chat removal fails
    }

    const populatedSession = await Session.findById(id)
      .populate("host", "name profileImage email clerkId")
      .populate("participants", "name profileImage email clerkId");

    res.status(200).json({ session: populatedSession, message: "Participant removed successfully" });
  } catch (error) {
    console.error("Error in removeParticipant controller:", error);
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

    const populatedSession = await Session.findById(id)
      .populate("host", "name profileImage email clerkId")
      .populate("participants", "name profileImage email clerkId");

    res.status(200).json({ session: populatedSession, message: "Session ended successfully" });
  } catch (error) {
    console.error("Error in endSession controller:", error);
    console.error("Full error stack:", error.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
