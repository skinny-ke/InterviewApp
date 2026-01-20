import { useUser } from "@clerk/clerk-react";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { useEndSession, useJoinSession, useLeaveSession, useRemoveParticipant, useSessionById } from "../hooks/useSessions";
import { PROBLEMS } from "../data/problems";
import { executeCode } from "../lib/piston";
import Navbar from "../components/Navbar";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { getDifficultyBadgeClass } from "../lib/utils";
import { Loader2Icon, LogOutIcon, PhoneOffIcon, UserXIcon, XIcon } from "lucide-react";
import CodeEditorPanel from "../components/CodeEditorPanel";
import OutputPanel from "../components/OutputPanel";

import useStreamClient from "../hooks/useStreamClient";
import { StreamCall, StreamVideo } from "@stream-io/video-react-sdk";
import VideoCallUI from "../components/VideoCallUI";

function SessionPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useUser();
  const [output, setOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const joinAttempted = useRef(false);

  const { data: sessionData, isLoading: loadingSession, refetch } = useSessionById(id);

  const joinSessionMutation = useJoinSession();
  const endSessionMutation = useEndSession();
  const leaveSessionMutation = useLeaveSession();
  const removeParticipantMutation = useRemoveParticipant();

  const session = sessionData?.session;
  // Calculate host/participant status - support both new (participants) and legacy (participant) shapes
  const isHost = session?.host?.clerkId === user?.id;
  const participantList = session?.participants || [];
  const legacyParticipant = session?.participant;
  const isParticipant =
    participantList.some((p) => p?.clerkId === user?.id) ||
    legacyParticipant?.clerkId === user?.id ||
    false;
  const participants = participantList.length > 0 ? participantList : legacyParticipant ? [legacyParticipant] : [];
  const totalParticipants = 1 + participants.length; // host + participants

  // Memoize these values to avoid recalculating unnecessarily
  const { call, channel, chatClient, isInitializingCall, streamClient } = useStreamClient(
    session,
    loadingSession,
    isHost,
    isParticipant
  );

  // find the problem data based on session problem title
  const problemData = session?.problem
    ? Object.values(PROBLEMS).find((p) => p.title === session.problem)
    : null;

  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [code, setCode] = useState(problemData?.starterCode?.[selectedLanguage] || "");
  const [joinError, setJoinError] = useState(null);

  // auto-join or rejoin session if user should have access
  useEffect(() => {
    if (!session || !user || loadingSession) return;
    
    // Check if user is host or participant
    const userIsHost = session?.host?.clerkId === user?.id;
    const userIsParticipant = session?.participants?.some((p) => p?.clerkId === user?.id) || false;
    
    console.log(`SessionPage: session=${!!session}, user=${!!user}, loading=${loadingSession}, isHost=${userIsHost}, isParticipant=${userIsParticipant}`);
    
    // If user is host or participant, allow them to rejoin (for refresh scenario)
    if (userIsHost || userIsParticipant) {
      console.log("User is host or participant - allowing rejoin");
      setJoinError(null);
      return;
    }
    
    // Only attempt to join once per session (avoid loops)
    if (joinAttempted.current) return;
    joinAttempted.current = true;

    console.log("Attempting to auto-join session");
    joinSessionMutation.mutate(id, { 
      onSuccess: () => {
        console.log("✅ Join successful, refetching session data");
        setJoinError(null);
        refetch();
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message;
        console.log("❌ Join failed:", errorMessage);
        setJoinError(errorMessage || "Failed to join session");
        
        // If join fails with 409 (Session is full), show error
        if (error.response?.status === 409) {
          console.log("Session full (409)");
        }
      }
    });
  }, [session?._id, session?.host?.clerkId, session?.participants, user?.id, loadingSession, joinSessionMutation, id, refetch]);

  // redirect the "participant" when session ends
  useEffect(() => {
    if (!session || loadingSession) return;

    if (session.status === "completed") navigate("/dashboard");
  }, [session, loadingSession, navigate]);

  // update code when problem loads or changes
  useEffect(() => {
    if (problemData?.starterCode?.[selectedLanguage]) {
      setCode(problemData.starterCode[selectedLanguage]);
    }
  }, [problemData, selectedLanguage]);

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setSelectedLanguage(newLang);
    // use problem-specific starter code
    const starterCode = problemData?.starterCode?.[newLang] || "";
    setCode(starterCode);
    setOutput(null);
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput(null);

    const result = await executeCode(selectedLanguage, code);
    setOutput(result);
    setIsRunning(false);
  };

  const handleEndSession = () => {
    if (confirm("Are you sure you want to end this session? All participants will be notified.")) {
      // this will navigate the HOST to dashboard
      endSessionMutation.mutate(id, { onSuccess: () => navigate("/dashboard") });
    }
  };

  const handleLeaveSession = () => {
    if (confirm("Are you sure you want to leave this session?")) {
      leaveSessionMutation.mutate(id, { 
        onSuccess: () => {
          navigate("/dashboard");
        }
      });
    }
  };

  const handleRemoveParticipant = (participantId, participantName) => {
    if (confirm(`Are you sure you want to remove ${participantName} from this session?`)) {
      removeParticipantMutation.mutate(
        { sessionId: id, participantId },
        {
          onSuccess: () => {
            refetch();
          }
        }
      );
    }
  };

  return (
    <div className="h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="flex-1">
        <PanelGroup direction="horizontal">
          {/* LEFT PANEL - CODE EDITOR & PROBLEM DETAILS */}
          <Panel defaultSize={50} minSize={30}>
            <PanelGroup direction="vertical">
              {/* PROBLEM DSC PANEL */}
              <Panel defaultSize={50} minSize={20}>
                <div className="h-full overflow-y-auto bg-base-200">
                  {/* HEADER SECTION */}
                  <div className="p-6 bg-base-100 border-b border-base-300">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h1 className="text-3xl font-bold text-base-content">
                          {session?.problem || "Loading..."}
                        </h1>
                        {problemData?.category && (
                          <p className="text-base-content/60 mt-1">{problemData.category}</p>
                        )}
                        <p className="text-base-content/60 mt-2">
                          Host: {session?.host?.name || "Loading..."} •{" "}
                          {totalParticipants}/{session?.maxParticipants || 10} participants
                          {participants.length > 0 && (
                            <span className="ml-2 text-xs">
                              ({participants.map(p => p.name).join(", ")})
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`badge badge-lg ${getDifficultyBadgeClass(
                            session?.difficulty
                          )}`}
                        >
                          {session?.difficulty.slice(0, 1).toUpperCase() +
                            session?.difficulty.slice(1) || "Easy"}
                        </span>
                        {isHost && session?.status === "active" && (
                          <button
                            onClick={handleEndSession}
                            disabled={endSessionMutation.isPending}
                            className="btn btn-error btn-sm gap-2"
                          >
                            {endSessionMutation.isPending ? (
                              <Loader2Icon className="w-4 h-4 animate-spin" />
                            ) : (
                              <LogOutIcon className="w-4 h-4" />
                            )}
                            End Session
                          </button>
                        )}
                        {isParticipant && !isHost && session?.status === "active" && (
                          <button
                            onClick={handleLeaveSession}
                            disabled={leaveSessionMutation.isPending}
                            className="btn btn-warning btn-sm gap-2"
                          >
                            {leaveSessionMutation.isPending ? (
                              <Loader2Icon className="w-4 h-4 animate-spin" />
                            ) : (
                              <XIcon className="w-4 h-4" />
                            )}
                            Leave Session
                          </button>
                        )}
                        {session?.status === "completed" && (
                          <span className="badge badge-ghost badge-lg">Completed</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* problem desc */}
                    {problemData?.description && (
                      <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                        <h2 className="text-xl font-bold mb-4 text-base-content">Description</h2>
                        <div className="space-y-3 text-base leading-relaxed">
                          <p className="text-base-content/90">{problemData.description.text}</p>
                          {problemData.description.notes?.map((note, idx) => (
                            <p key={idx} className="text-base-content/90">
                              {note}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* examples section */}
                    {problemData?.examples && problemData.examples.length > 0 && (
                      <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                        <h2 className="text-xl font-bold mb-4 text-base-content">Examples</h2>

                        <div className="space-y-4">
                          {problemData.examples.map((example, idx) => (
                            <div key={idx}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="badge badge-sm">{idx + 1}</span>
                                <p className="font-semibold text-base-content">Example {idx + 1}</p>
                              </div>
                              <div className="bg-base-200 rounded-lg p-4 font-mono text-sm space-y-1.5">
                                <div className="flex gap-2">
                                  <span className="text-primary font-bold min-w-[70px]">
                                    Input:
                                  </span>
                                  <span>{example.input}</span>
                                </div>
                                <div className="flex gap-2">
                                  <span className="text-secondary font-bold min-w-[70px]">
                                    Output:
                                  </span>
                                  <span>{example.output}</span>
                                </div>
                                {example.explanation && (
                                  <div className="pt-2 border-t border-base-300 mt-2">
                                    <span className="text-base-content/60 font-sans text-xs">
                                      <span className="font-semibold">Explanation:</span>{" "}
                                      {example.explanation}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Constraints */}
                    {problemData?.constraints && problemData.constraints.length > 0 && (
                      <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                        <h2 className="text-xl font-bold mb-4 text-base-content">Constraints</h2>
                        <ul className="space-y-2 text-base-content/90">
                          {problemData.constraints.map((constraint, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="text-primary">•</span>
                              <code className="text-sm">{constraint}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Participants Section */}
                    {session && (
                      <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                        <h2 className="text-xl font-bold mb-4 text-base-content">Participants</h2>
                        <div className="space-y-3">
                          {/* Host */}
                          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                            <div className="flex items-center gap-3">
                              {session.host?.profileImage && (
                                <img
                                  src={session.host.profileImage}
                                  alt={session.host.name}
                                  className="w-10 h-10 rounded-full"
                                />
                              )}
                              <div>
                                <p className="font-semibold text-base-content">
                                  {session.host?.name || "Host"}
                                  <span className="ml-2 badge badge-primary badge-sm">Host</span>
                                </p>
                                <p className="text-xs text-base-content/60">{session.host?.email}</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Participants */}
                          {participants.map((participant) => (
                            <div
                              key={participant._id || participant.clerkId}
                              className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                {participant.profileImage && (
                                  <img
                                    src={participant.profileImage}
                                    alt={participant.name}
                                    className="w-10 h-10 rounded-full"
                                  />
                                )}
                                <div>
                                  <p className="font-semibold text-base-content">
                                    {participant.name || "Participant"}
                                  </p>
                                  <p className="text-xs text-base-content/60">{participant.email}</p>
                                </div>
                              </div>
                              {isHost && session?.status === "active" && (
                                <button
                                  onClick={() => handleRemoveParticipant(participant._id, participant.name)}
                                  disabled={removeParticipantMutation.isPending}
                                  className="btn btn-error btn-xs gap-1"
                                  title="Remove participant"
                                >
                                  {removeParticipantMutation.isPending ? (
                                    <Loader2Icon className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <UserXIcon className="w-3 h-3" />
                                  )}
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                          
                          {participants.length === 0 && (
                            <p className="text-base-content/60 text-sm italic">No participants yet</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Panel>

              <PanelResizeHandle className="h-2 bg-base-300 hover:bg-primary transition-colors cursor-row-resize" />

              <Panel defaultSize={50} minSize={20}>
                <PanelGroup direction="vertical">
                  <Panel defaultSize={70} minSize={30}>
                    <CodeEditorPanel
                      selectedLanguage={selectedLanguage}
                      code={code}
                      isRunning={isRunning}
                      onLanguageChange={handleLanguageChange}
                      onCodeChange={(value) => setCode(value)}
                      onRunCode={handleRunCode}
                    />
                  </Panel>

                  <PanelResizeHandle className="h-2 bg-base-300 hover:bg-primary transition-colors cursor-row-resize" />

                  <Panel defaultSize={30} minSize={15}>
                    <OutputPanel output={output} />
                  </Panel>
                </PanelGroup>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-2 bg-base-300 hover:bg-primary transition-colors cursor-col-resize" />

          {/* RIGHT PANEL - VIDEO CALLS & CHAT */}
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full bg-base-200 p-4 overflow-auto">
              {isInitializingCall ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Loader2Icon className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
                    <p className="text-lg">Connecting to video call...</p>
                  </div>
                </div>
              ) : joinError ? (
                <div className="h-full flex items-center justify-center">
                  <div className="card bg-base-100 shadow-xl max-w-md">
                    <div className="card-body items-center text-center">
                      <div className="w-24 h-24 bg-warning/10 rounded-full flex items-center justify-center mb-4">
                        <PhoneOffIcon className="w-12 h-12 text-warning" />
                      </div>
                      <h2 className="card-title text-2xl">Cannot Join Session</h2>
                      <p className="text-base-content/70">{joinError}</p>
                      <p className="text-sm text-base-content/60 mt-2">
                        {joinError === "Session is full" 
                          ? "This session already has a participant. Sessions can only have 2 people."
                          : ""}
                      </p>
                      <button 
                        onClick={() => navigate("/dashboard")}
                        className="btn btn-primary btn-sm mt-4"
                      >
                        Go to Dashboard
                      </button>
                    </div>
                  </div>
                </div>
              ) : !streamClient || !call ? (
                <div className="h-full flex items-center justify-center">
                  <div className="card bg-base-100 shadow-xl max-w-md">
                    <div className="card-body items-center text-center">
                      <div className="w-24 h-24 bg-error/10 rounded-full flex items-center justify-center mb-4">
                        <PhoneOffIcon className="w-12 h-12 text-error" />
                      </div>
                      <h2 className="card-title text-2xl">Connection Failed</h2>
                      <p className="text-base-content/70">Unable to connect to the video call</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full">
                  <StreamVideo client={streamClient}>
                    <StreamCall call={call}>
                      <VideoCallUI chatClient={chatClient} channel={channel} />
                    </StreamCall>
                  </StreamVideo>
                </div>
              )}
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default SessionPage;
