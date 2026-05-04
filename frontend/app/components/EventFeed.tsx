"use client";
import { useSystemStore } from "@/app/store/systemStore";

const EVENT_COLORS: Record<string, string> = {
  FILE_ACCESSED: "text-blue-400",
  FILE_CREATED: "text-green-400",
  FILE_MODIFIED: "text-yellow-400",
  FILE_DELETED: "text-red-400",
  PROCESS_UPDATE: "text-indigo-400",
  PROCESS_DIED: "text-gray-500",
};

export default function EventFeed() {
  const { historyEvents, liveState, mode } = useSystemStore();

  // In live mode, derive recent events from file states
  const displayEvents =
    mode === "history"
      ? historyEvents.slice(-30).reverse()
      : liveState
      ? Object.values(liveState.files)
          .sort((a, b) => b.last_accessed - a.last_accessed)
          .slice(0, 20)
          .map((f) => ({
            type: f.event_type || "FILE_ACCESSED",
            path: f.path,
            timestamp: f.last_accessed,
          }))
      : [];

  return (
    <div className="flex flex-col h-full bg-gray-950 border-l border-gray-800">
      <div className="px-4 py-2.5 border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-widest">
        Event Feed
      </div>
      <div className="flex-1 overflow-y-auto">
        {displayEvents.map((ev, i) => {
          const ts = new Date(ev.timestamp * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          const colorClass = EVENT_COLORS[ev.type] ?? "text-gray-400";
          const path = "path" in ev ? (ev.path as string) : "";

          return (
            <div
              key={i}
              className="px-4 py-1.5 border-b border-gray-900 hover:bg-gray-900 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono ${colorClass} shrink-0`}>
                  {ev.type}
                </span>
                <span className="text-xs text-gray-600 shrink-0">{ts}</span>
              </div>
              {path && (
                <div className="text-xs text-gray-500 font-mono truncate mt-0.5">
                  {path}
                </div>
              )}
            </div>
          );
        })}
        {!displayEvents.length && (
          <div className="px-4 py-8 text-xs text-gray-600 text-center">
            No events yet…
          </div>
        )}
      </div>
    </div>
  );
}
