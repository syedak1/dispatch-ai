import { useEffect, useRef, useState, useCallback } from 'react';
import type { Alert } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

// Camera WebSocket Hook
export function useCameraSocket(cameraId: string) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}/ws/camera/${cameraId}`);

    ws.onopen = () => {
      console.log(`[${cameraId}] Connected`);
      setConnected(true);
    };

    ws.onclose = () => {
      console.log(`[${cameraId}] Disconnected`);
      setConnected(false);
      reconnectRef.current = window.setTimeout(connect, 3000);
    };

    ws.onerror = (e) => console.error(`[${cameraId}] Error:`, e);

    wsRef.current = ws;
  }, [cameraId]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendDescription = useCallback((description: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'overshoot_result',
        description,
        timestamp: new Date().toISOString()
      }));
    }
  }, []);

  const sendFrame = useCallback((frameData: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'video_frame',
        frame: frameData,
        timestamp: new Date().toISOString()
      }));
    }
  }, []);

  const forceProcess = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'force_process' }));
    }
  }, []);

  return { connected, sendDescription, sendFrame, forceProcess, wsUrl: WS_URL };
}

// Dispatcher WebSocket Hook
export function useDispatcherSocket(
  onAlert: (alert: Alert) => void,
  onFrame?: (cameraId: string, frame: string) => void
) {
  const [connected, setConnected] = useState(false);
  const [cameras, setCameras] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const callbacksRef = useRef({ onAlert, onFrame });

  useEffect(() => {
    callbacksRef.current = { onAlert, onFrame };
  }, [onAlert, onFrame]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}/ws/dispatcher`);

    ws.onopen = () => {
      console.log('[Dispatcher] Connected');
      setConnected(true);
    };

    ws.onclose = () => {
      console.log('[Dispatcher] Disconnected');
      setConnected(false);
      reconnectRef.current = window.setTimeout(connect, 3000);
    };

    ws.onerror = (e) => console.error('[Dispatcher] Error:', e);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'alert':
            callbacksRef.current.onAlert(data.data);
            break;
          case 'camera_connected':
            setCameras(prev => [...new Set([...prev, data.camera_id])]);
            break;
          case 'camera_disconnected':
            setCameras(prev => prev.filter(c => c !== data.camera_id));
            break;
          case 'camera_list':
            setCameras(data.cameras || []);
            break;
          case 'video_frame':
            callbacksRef.current.onFrame?.(data.camera_id, data.frame);
            break;
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendDecision = useCallback((incidentId: string, decision: 'confirm' | 'reject', reason?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: decision,
        incident_id: incidentId,
        reason,
        timestamp: new Date().toISOString()
      }));
    }
  }, []);

  return { connected, sendDecision, cameras, wsUrl: WS_URL };
}