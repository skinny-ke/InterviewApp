import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { sessionApi } from "../api/sessions";

export const useCreateSession = () => {
  const result = useMutation({
    mutationKey: ["createSession"],
    mutationFn: sessionApi.createSession,
    onSuccess: () => toast.success("Session created successfully!"),
    onError: (error) => {
      const errorMessage = error.response?.data?.message || "Failed to create session";
      toast.error(errorMessage);
      console.error("Session creation error:", error);
    },
  });

  return result;
};

export const useActiveSessions = () => {
  const result = useQuery({
    queryKey: ["activeSessions"],
    queryFn: sessionApi.getActiveSessions,
  });

  return result;
};

export const useMyRecentSessions = () => {
  const result = useQuery({
    queryKey: ["myRecentSessions"],
    queryFn: sessionApi.getMyRecentSessions,
  });

  return result;
};

export const useSessionById = (id) => {
  const result = useQuery({
    queryKey: ["session", id],
    queryFn: () => sessionApi.getSessionById(id),
    enabled: !!id,
    // Refetch less frequently to reduce unnecessary requests
    refetchInterval: 5000, // Every 5 seconds instead of 2
    staleTime: 2000, // Consider data stale after 2 seconds
  });

  return result;
};

export const useJoinSession = () => {
  const result = useMutation({
    mutationKey: ["joinSession"],
    mutationFn: sessionApi.joinSession,
    onSuccess: (data) => {
      // Only show toast if it's not a rejoin (message indicates rejoin)
      if (!data?.message || !data.message.includes("Rejoined")) {
        toast.success("Joined session successfully!");
      }
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to join session"),
  });

  return result;
};

export const useLeaveSession = () => {
  const result = useMutation({
    mutationKey: ["leaveSession"],
    mutationFn: sessionApi.leaveSession,
    onSuccess: () => toast.success("Left session successfully!"),
    onError: (error) => toast.error(error.response?.data?.message || "Failed to leave session"),
  });

  return result;
};

export const useEndSession = () => {
  const result = useMutation({
    mutationKey: ["endSession"],
    mutationFn: sessionApi.endSession,
    onSuccess: () => toast.success("Session ended successfully!"),
    onError: (error) => toast.error(error.response?.data?.message || "Failed to end session"),
  });

  return result;
};

export const useRemoveParticipant = () => {
  const result = useMutation({
    mutationKey: ["removeParticipant"],
    mutationFn: ({ sessionId, participantId }) => sessionApi.removeParticipant(sessionId, participantId),
    onSuccess: () => toast.success("Participant removed successfully!"),
    onError: (error) => toast.error(error.response?.data?.message || "Failed to remove participant"),
  });

  return result;
};
