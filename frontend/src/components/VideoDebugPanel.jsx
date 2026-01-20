import { useState, useEffect } from "react";

export function VideoDebugPanel() {
  const [tests, setTests] = useState({
    mediaAccess: null,
    streamApiKey: null,
    streamClient: null,
    mediaDevices: null,
  });

  useEffect(() => {
    const runDiagnostics = async () => {
      const results = { ...tests };

      // Test 1: Media Access
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        results.mediaAccess = {
          status: "✅ PASS",
          tracks: stream.getTracks().map((t) => t.kind),
        };
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        results.mediaAccess = { status: "❌ FAIL", error: err.name };
      }

      // Test 2: Stream API Key
      const apiKey = import.meta.env.VITE_STREAM_API_KEY;
      results.streamApiKey = apiKey
        ? { status: "✅ PASS", value: apiKey.substring(0, 8) + "..." }
        : { status: "❌ FAIL", error: "API key not configured" };

      // Test 3: Media Devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((d) => d.kind === "videoinput");
        const mics = devices.filter((d) => d.kind === "audioinput");
        results.mediaDevices = {
          status: cameras.length > 0 && mics.length > 0 ? "✅ PASS" : "⚠️ WARNING",
          cameras: cameras.length,
          microphones: mics.length,
        };
      } catch (err) {
        results.mediaDevices = { status: "❌ FAIL", error: err.message };
      }

      setTests(results);
    };

    runDiagnostics();
  }, []);

  return (
    <div className="fixed bottom-4 right-4 card bg-base-100 shadow-xl max-w-sm border-2 border-primary">
      <div className="card-body p-3">
        <h3 className="card-title text-sm">🔧 Video Debug</h3>
        <div className="space-y-2 text-xs">
          {Object.entries(tests).map(([key, result]) => (
            <div key={key} className="flex items-start gap-2 p-2 bg-base-200 rounded">
              <div className="flex-1">
                <div className="font-mono font-bold">{result?.status || "..."}</div>
                <div className="text-xs opacity-70">
                  {key === "mediaAccess" && result?.tracks && `Tracks: ${result.tracks.join(", ")}`}
                  {key === "streamApiKey" && result?.value && `Key: ${result.value}`}
                  {key === "mediaDevices" &&
                    `📷 ${result?.cameras || 0} | 🎤 ${result?.microphones || 0}`}
                  {result?.error && `Error: ${result.error}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default VideoDebugPanel;
