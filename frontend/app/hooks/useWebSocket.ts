"use client";
import { useEffect, useRef, useCallback } from "react";
import { useSystemStore } from "@/app/store/systemStore";
import type { OSType } from "@/app/types/system";

const WS_URL = "ws://localhost:8765";

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const store = useSystemStore();

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => {
      store.setConnected(true);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };

    socket.onclose = () => {
      store.setConnected(false);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    socket.onerror = () => {
      socket.close();
    };

    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        handleMessage(msg);
      } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMessage(msg: Record<string, unknown>) {
    const { type } = msg;

    if (type === "INIT") {
      store.initState(msg as Parameters<typeof store.initState>[0]);
    } else if (type === "STATE_UPDATE") {
      store.applyUpdate(msg as Parameters<typeof store.applyUpdate>[0]);
    } else if (type === "HISTORY") {
      store.setHistoryEvents(msg.events as Parameters<typeof store.setHistoryEvents>[0]);
    } else if (type === "SIMULATION_RESULT") {
      store.setSimulation(msg as Parameters<typeof store.setSimulation>[0]);
    } else if (type === "REPLAY_FRAMES") {
      store.setReplayFrames(msg.frames as Parameters<typeof store.setReplayFrames>[0]);
    } else if (type === "FS_SCAN") {
      store.setFsScan(msg.files as Parameters<typeof store.setFsScan>[0]);
    }
  }

  const send = useCallback((data: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  const requestHistory = useCallback((start: number, end: number) => {
    send({ type: "GET_HISTORY", start, end });
  }, [send]);

  const requestSimulation = useCallback((os: OSType) => {
    send({ type: "SIMULATE", os });
  }, [send]);

  const requestReplay = useCallback((start: number, end: number) => {
    send({ type: "REPLAY", start, end });
  }, [send]);

  const requestFsScan = useCallback((path?: string) => {
    send({ type: "SCAN_FS", path });
  }, [send]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  return { send, requestHistory, requestSimulation, requestReplay, requestFsScan };
}
