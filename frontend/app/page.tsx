"use client";
import { useRef } from "react";
import { useWebSocket } from "@/app/hooks/useWebSocket";
import { useSystemStore } from "@/app/store/systemStore";
import SystemGraph from "@/app/components/SystemGraph";
import StatsBar from "@/app/components/StatsBar";
import ModeSelector from "@/app/components/ModeSelector";
import Timeline from "@/app/components/Timeline";
import ComparisonView from "@/app/components/ComparisonView";
import EventFeed from "@/app/components/EventFeed";
import CliHistory from "@/app/components/CliHistory";
import PulseBar from "@/app/components/PulseBar";

export default function Home() {
  const { requestHistory, requestSimulation, requestReplay, requestCliHistory } = useWebSocket();
  const { mode, graphData } = useSystemStore();
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
        <h1 className="text-sm font-semibold tracking-wide text-gray-100">
          System Mirror
        </h1>
        <span className="text-xs text-gray-600">/ real-time OS digital twin</span>
      </header>

      {/* Stats (hidden in CLI mode to maximise space) */}
      {mode !== "cli" && <StatsBar />}

      {/* Mode selector */}
      <ModeSelector onSimulate={requestSimulation} />

      {/* Main canvas */}
      <div className="flex flex-1 overflow-hidden" ref={containerRef}>
        {mode === "cli" ? (
          <CliHistory onLoad={requestCliHistory} />
        ) : mode === "comparison" ? (
          <ComparisonView onSimulate={requestSimulation} />
        ) : (
          <>
            <div className="flex-1 overflow-hidden">
              <SystemGraph
                data={graphData}
                width={
                  containerRef.current
                    ? containerRef.current.clientWidth - 288
                    : 900
                }
                height={containerRef.current?.clientHeight ?? 600}
                title={
                  mode === "live"
                    ? "Live System"
                    : mode === "history"
                    ? "History Replay"
                    : "Simulation"
                }
              />
            </div>
            <div className="w-72 shrink-0 overflow-hidden flex flex-col border-l border-gray-800">
              <EventFeed />
            </div>
          </>
        )}
      </div>

      {/* Timeline (history mode only) */}
      <Timeline
        onRequestHistory={requestHistory}
        onRequestReplay={requestReplay}
      />

      {/* Always-visible ambient pulse bar */}
      <PulseBar />
    </div>
  );
}
