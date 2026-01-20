import {
  CallControls,
  CallingState,
  SpeakerLayout,
  useCallStateHooks,
  useCall,
} from "@stream-io/video-react-sdk";
import { Loader2Icon, MessageSquareIcon, UsersIcon, XIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Channel, Chat, MessageInput, MessageList, Thread, Window } from "stream-chat-react";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import "stream-chat-react/dist/css/v2/index.css";

function VideoCallUI({ chatClient, channel }) {
  const navigate = useNavigate();
  const { useCallCallingState, useParticipantCount } = useCallStateHooks();
  const call = useCall();
  const callingState = useCallCallingState();
  const participantCount = useParticipantCount();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [permissionError, setPermissionError] = useState(null);

  // Monitor device states and show helpful messages
  useEffect(() => {
    if (!call || callingState !== CallingState.JOINED) {
      return;
    }

    // Check device states after call is joined
    const checkDevices = () => {
      try {
        const cameraEnabled = call.camera?.state?.status === 'enabled';
        const microphoneEnabled = call.microphone?.state?.status === 'enabled';

        // Don't show error immediately - give devices time to enable
        // Only show helpful message if devices are still disabled after some time
        const timer = setTimeout(() => {
          if (!call) return;
          
          const stillCameraDisabled = call.camera?.state?.status !== 'enabled';
          const stillMicDisabled = call.microphone?.state?.status !== 'enabled';

          if (stillCameraDisabled && stillMicDisabled) {
            setPermissionError("Camera and microphone are off. Click the camera and microphone buttons in the controls below to enable them.");
          } else if (stillCameraDisabled) {
            setPermissionError("Camera is off. Click the camera button in the controls below to enable it.");
          } else if (stillMicDisabled) {
            setPermissionError("Microphone is off. Click the microphone button in the controls below to enable it.");
          } else {
            setPermissionError(null);
          }
        }, 3000); // Wait 3 seconds before showing message

        return () => clearTimeout(timer);
      } catch (error) {
        console.error("Error checking device states:", error);
      }
    };

    const cleanup = checkDevices();
    return cleanup;
  }, [callingState, call]);

  if (callingState === CallingState.JOINING) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2Icon className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
          <p className="text-lg">Joining call...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex gap-3 relative str-video">
      {permissionError && (
        <div className="fixed top-4 right-4 alert alert-warning shadow-lg max-w-md z-50">
          <div>
            <span>{permissionError}</span>
          </div>
          <div className="flex-none">
            <button onClick={() => setPermissionError(null)} className="btn btn-sm">
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col gap-3">
        {/* Participants count badge and Chat Toggle */}
        <div className="flex items-center justify-between gap-2 bg-base-100 p-3 rounded-lg shadow">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-primary" />
            <span className="font-semibold">
              {participantCount} {participantCount === 1 ? "participant" : "participants"}
            </span>
          </div>
          {chatClient && channel && (
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`btn btn-sm gap-2 ${isChatOpen ? "btn-primary" : "btn-ghost"}`}
              title={isChatOpen ? "Hide chat" : "Show chat"}
            >
              <MessageSquareIcon className="size-4" />
              Chat
            </button>
          )}
        </div>

        <div className="flex-1 bg-base-300 rounded-lg overflow-hidden relative">
          <SpeakerLayout />
        </div>

        <div className="bg-base-100 p-3 rounded-lg shadow flex justify-center">
          <CallControls onLeave={() => navigate("/dashboard")} />
        </div>
      </div>

      {/* CHAT SECTION */}

      {chatClient && channel && (
        <div
          className={`flex flex-col rounded-lg shadow overflow-hidden bg-[#272a30] transition-all duration-300 ease-in-out ${
            isChatOpen ? "w-80 opacity-100" : "w-0 opacity-0"
          }`}
        >
          {isChatOpen && (
            <>
              <div className="bg-[#1c1e22] p-3 border-b border-[#3a3d44] flex items-center justify-between">
                <h3 className="font-semibold text-white">Session Chat</h3>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="Close chat"
                >
                  <XIcon className="size-5" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden stream-chat-dark">
                <Chat client={chatClient} theme="str-chat__theme-dark">
                  <Channel channel={channel}>
                    <Window>
                      <MessageList />
                      <MessageInput />
                    </Window>
                    <Thread />
                  </Channel>
                </Chat>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
export default VideoCallUI;
