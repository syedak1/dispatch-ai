import { useEffect, useRef, useState, useCallback } from 'react';
import type { Alert } from '../types';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

/**
 * Hook for camera connections - sends Overshoot descriptions to backend
 */
export function useCameraSocket(cameraId: string) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_BASE_URL}/ws/camera/${cameraId}`);

    ws.onopen = () => {
      console.log(`[${cameraId}] Camera connected`);
      setConnected(true);
    };

    ws.onclose = () => {
      console.log(`[${cameraId}] Camera disconnected`);
      setConnected(false);
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
    };

    ws.onerror = (error) => {
      console.error(`[${cameraId}] Camera WebSocket error:`, error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Handle requests from backend (e.g., clip requests)
        if (data.type === 'request_clip') {
          console.log(`[${cameraId}] Clip requested for incident: ${data.incident_id}`);
          // Future: implement clip recording
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    wsRef.current = ws;
  }, [cameraId]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  const sendDescription = useCallback((description: string, timestamp?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'overshoot_result',
        description,
        timestamp: timestamp || new Date().toISOString()
      }));
    }
  }, []);

  const forceProcess = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'force_process'
      }));
    }
  }, []);

  return { connected, sendDescription, forceProcess };
}

/**
 * Hook for dispatcher dashboard - receives alerts, sends decisions
 */
export function useDispatcherSocket(onAlert: (alert: Alert) => void) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const onAlertRef = useRef(onAlert);

  // Keep callback reference fresh
  useEffect(() => {
    onAlertRef.current = onAlert;
  }, [onAlert]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_BASE_URL}/ws/dispatcher`);

    ws.onopen = () => {
      console.log('Dispatcher connected');
      setConnected(true);
    };

    ws.onclose = () => {
      console.log('Dispatcher disconnected');
      setConnected(false);
      reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
    };

    ws.onerror = (error) => {
      console.error('Dispatcher WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'alert') {
          onAlertRef.current(data.data as Alert);
        }
      } catch (e) {
        console.error('Failed to parse alert:', e);
      }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  const sendDecision = useCallback((incidentId: string, decision: 'confirm' | 'reject', reason?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: decision,
        incident_id: incidentId,
        reason,
        dispatcher_id: 'dispatcher_1', // Could be dynamic based on auth
        timestamp: new Date().toISOString()
      }));
    }
  }, []);

  return { connected, sendDecision };
}