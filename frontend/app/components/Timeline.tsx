"use client";
import { useState, useCallback } from "react";
import { useSystemStore } from "@/app/store/systemStore";

interface Props {
  onRequestHistory: (start: number, end: number) => void;
  onRequestReplay: (start: number, end: number) => void;
}

function formatTs(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString();
}

export default function Timeline({ onRequestHistory, onRequestReplay }: Props) {
  const { replayFrames, replayIndex, setReplayIndex, historyEvents, mode } =
    useSystemStore();

  const [windowMins, setWindowMins] = useState(10);

  const handleLoadHistory = useCallback(() => {
    const end = Date.now() / 1000;
    const start = end - windowMins * 60;
    onRequestHistory(start, end);
    onRequestReplay(start, end);
  }, [windowMins, onRequestHistory, onRequestReplay]);

  if (mode !== "history") return null;

  return (
    <div className="flex flex-col gap-3 px-5 py-3 bg-gray-900 border-t border-gray-800">
      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-widest">
          History
        </span>
        <select
          value={windowMins}
          onChange={(e) => setWindowMins(Number(e.target.value))}
          className="bg-gray-800 text-gray-200 text-xs rounded px-2 py-1 border border-gray-700"
        >
          <option value={5}>Last 5 min</option>
          <option value={10}>Last 10 min</option>
          <option value={30}>Last 30 min</option>
          <option value={60}>Last 1 hr</option>
        </select>
        <button
          onClick={handleLoadHistory}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded font-medium"
        >
          Load
        </button>
        <span className="text-xs text-gray-500">
          {historyEvents.length} events &nbsp;·&nbsp; {replayFrames.length} frames
        </span>
      </div>

      {replayFrames.length > 0 && (
        <div className="flex flex-col gap-1">
          <input
            type="range"
            min={0}
            max={replayFrames.length - 1}
            value={replayIndex}
            onChange={(e) => setReplayIndex(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{formatTs(replayFrames[0].timestamp)}</span>
            <span className="text-gray-300">
              {replayFrames[replayIndex]
                ? formatTs(replayFrames[replayIndex].timestamp)
                : ""}
            </span>
            <span>{formatTs(replayFrames[replayFrames.length - 1].timestamp)}</span>
          </div>
          {replayFrames[replayIndex] && (
            <div className="text-xs text-indigo-400 truncate">
              ↳ {replayFrames[replayIndex].event.type}
              {replayFrames[replayIndex].event.path
                ? ` — ${replayFrames[replayIndex].event.path}`
                : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
