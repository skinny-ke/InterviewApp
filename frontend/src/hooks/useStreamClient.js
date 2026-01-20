import { useState, useEffect } from "react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";
import { initializeStreamClient, disconnectStreamClient } from "../lib/stream";
import { sessionApi } from "../api/sessions";

function useStreamClient(session, loadingSession, isHost, isParticipant) {
  const [streamClient, setStreamClient] = useState(null);
  const [call, setCall] = useState(null);
  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [isInitializingCall, setIsInitializingCall] = useState(true);

  useEffect(() => {
    let videoCall = null;
    let chatClientInstance = null;
    let isMounted = true;
    let retryTimer = null;

    const initCall = async () => {
      try {
        if (!session?.callId) {
          console.log("No callId available");
          if (isMounted) setIsInitializingCall(false);
          return;
        }
        
        if (session.status === "completed") {
          console.log("Session is completed");
          if (isMounted) setIsInitializingCall(false);
          return;
        }

        // Check host/participant status - if neither, wait and retry
        if (!isHost && !isParticipant) {
          console.log("User is neither host nor participant - will retry after join...");
          // Wait a bit longer for the session state to update after join
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(() => {
            if (isMounted && (!isHost && !isParticipant)) {
              console.log("Still not host/participant after wait - connection may fail");
              setIsInitializingCall(false);
            }
          }, 3000);
          return;
        }

        console.log("Fetching Stream token...");
        const { token, userId, userName, userImage } = await sessionApi.getStreamToken();
        console.log("✅ Stream token obtained");

        console.log("Initializing Stream client...");
        const client = await initializeStreamClient(
          {
            id: userId,
            name: userName,
            image: userImage,
          },
          token
        );

        if (!isMounted) return;
        setStreamClient(client);
        console.log("✅ Stream client initialized");

        videoCall = client.call("default", session.callId);
        console.log(`Joining call: ${session.callId}`);
        
        // Join the call - Stream SDK will handle permissions
        try {
          await videoCall.join({ 
            create: true,
          });
          console.log("✅ Call joined successfully");
          
          if (!isMounted) return;
          setCall(videoCall);
          
          // Enable devices after join - try to enable automatically
          // Note: Some browsers require user interaction first
          const enableDevices = async () => {
            try {
              console.log("Attempting to enable camera and microphone...");
              
              // Try to enable both devices
              // This will request browser permissions if not already granted
              const [cameraResult, micResult] = await Promise.allSettled([
                videoCall.camera.enable().catch(err => {
                  console.warn("Camera enable error:", err.message);
                  throw err;
                }),
                videoCall.microphone.enable().catch(err => {
                  console.warn("Microphone enable error:", err.message);
                  throw err;
                })
              ]);
              
              if (cameraResult.status === 'fulfilled') {
                console.log("✅ Camera enabled successfully");
              } else {
                console.warn("⚠️ Camera not enabled:", cameraResult.reason?.message);
              }
              
              if (micResult.status === 'fulfilled') {
                console.log("✅ Microphone enabled successfully");
              } else {
                console.warn("⚠️ Microphone not enabled:", micResult.reason?.message);
              }
              
            } catch (error) {
              console.warn("⚠️ Device enabling issue (user can enable manually):", error.message);
              // Don't throw - user can enable via UI controls
            }
          };
          
          // Wait a bit for call to be fully initialized, then try to enable devices
          setTimeout(enableDevices, 1500);
        } catch (joinError) {
          console.error("❌ Failed to join call:", joinError);
          toast.error(`Failed to join call: ${joinError.message}`);
          throw joinError;
        }

        // Initialize chat client
        console.log("Initializing chat client...");
        const apiKey = import.meta.env.VITE_STREAM_API_KEY;
        chatClientInstance = StreamChat.getInstance(apiKey);

        await chatClientInstance.connectUser(
          {
            id: userId,
            name: userName,
            image: userImage,
          },
          token
        );
        
        if (!isMounted) return;
        setChatClient(chatClientInstance);
        console.log("✅ Chat client connected");

        const chatChannel = chatClientInstance.channel("messaging", session.callId);
        await chatChannel.watch();
        
        if (!isMounted) return;
        setChannel(chatChannel);
        console.log("✅ Chat channel ready");
      } catch (error) {
        console.error("❌ Error initializing call:", error);
        console.error("Error details:", error.response?.data || error.message);
        toast.error("Failed to connect to video call. Please refresh and try again.");
      } finally {
        if (isMounted) {
          setIsInitializingCall(false);
        }
      }
    };

    if (session && !loadingSession) {
      initCall();
    }

    // cleanup - performance reasons
    return () => {
      isMounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      // iife
      (async () => {
        try {
          if (videoCall) {
            console.log("Leaving call...");
            await videoCall.leave();
          }
          if (chatClientInstance) {
            console.log("Disconnecting chat client...");
            await chatClientInstance.disconnectUser();
          }
          await disconnectStreamClient();
          console.log("✅ Cleanup completed");
        } catch (error) {
          console.error("Cleanup error:", error);
        }
      })();
    };
  }, [session?.callId, session?.status, loadingSession, isHost, isParticipant]);

  return {
    streamClient,
    call,
    chatClient,
    channel,
    isInitializingCall,
  };
}

export default useStreamClient;
