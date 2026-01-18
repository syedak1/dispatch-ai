import { useEffect, useRef, useState, useCallback } from 'react';
import type { Alert } from '../types';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

/**
 * Hook for camera connections - sends descriptions to backend
 */
export function useCameraSocket(cameraId: string) {
  const [connected, setConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = `${WS_BASE_URL}/ws/camera/${cameraId}`;
    console.log(`[${cameraId}] Connecting to ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log(`[${cameraId}] Connected`);
      setConnected(true);
      setReconnectCount(0);
    };

    ws.onclose = (event) => {
      console.log(`[${cameraId}] Disconnected (code: ${event.code})`);
      setConnected(false);
      
      // Reconnect with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectCount), 30000);
      console.log(`[${cameraId}] Reconnecting in ${delay}ms...`);
      reconnectTimeoutRef.current = window.setTimeout(() => {
        setReconnectCount(prev => prev + 1);
        connect();
      }, delay);
    };

    ws.onerror = (error) => {
      console.error(`[${cameraId}] WebSocket error:`, error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`[${cameraId}] Received:`, data.type);
        
        if (data.type === 'request_clip') {
          console.log(`[${cameraId}] Clip requested for incident: ${data.incident_id}`);
        }
      } catch (e) {
        console.error(`[${cameraId}] Failed to parse message:`, e);
      }
    };

    wsRef.current = ws;
  }, [cameraId, reconnectCount]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendDescription = useCallback((description: string, timestamp?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'overshoot_result',
        description,
        timestamp: timestamp || new Date().toISOString()
      };
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  const forceProcess = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log(`[${cameraId}] Forcing buffer process`);
      wsRef.current.send(JSON.stringify({ type: 'force_process' }));
      return true;
    }
    return false;
  }, [cameraId]);

  const sendClipReady = useCallback((incidentId: string, clipUrl: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'clip_ready',
        incident_id: incidentId,
        url: clipUrl
      }));
      return true;
    }
    return false;
  }, []);

  return { 
    connected, 
    sendDescription, 
    forceProcess, 
    sendClipReady,
    reconnectCount,
    wsUrl: WS_BASE_URL
  };
}

/**
 * Hook for dispatcher dashboard - receives alerts, sends decisions
 */
export function useDispatcherSocket(onAlert: (alert: Alert) => void) {
  const [connected, setConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [connectedCameras, setConnectedCameras] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const onAlertRef = useRef(onAlert);

  useEffect(() => {
    onAlertRef.current = onAlert;
  }, [onAlert]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = `${WS_BASE_URL}/ws/dispatcher`;
    console.log(`[Dispatcher] Connecting to ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[Dispatcher] Connected');
      setConnected(true);
      setReconnectCount(0);
    };

    ws.onclose = (event) => {
      console.log(`[Dispatcher] Disconnected (code: ${event.code})`);
      setConnected(false);
      
      const delay = Math.min(1000 * Math.pow(2, reconnectCount), 30000);
      console.log(`[Dispatcher] Reconnecting in ${delay}ms...`);
      reconnectTimeoutRef.current = window.setTimeout(() => {
        setReconnectCount(prev => prev + 1);
        connect();
      }, delay);
    };

    ws.onerror = (error) => {
      console.error('[Dispatcher] WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[Dispatcher] Received:', data.type);
        
        switch (data.type) {
          case 'alert':
            console.log('[Dispatcher] New alert:', data.data?.id);
            onAlertRef.current(data.data as Alert);
            break;
          case 'camera_connected':
            console.log('[Dispatcher] Camera connected:', data.camera_id);
            setConnectedCameras(prev => [...prev.filter(c => c !== data.camera_id), data.camera_id]);
            break;
          case 'camera_disconnected':
            console.log('[Dispatcher] Camera disconnected:', data.camera_id);
            setConnectedCameras(prev => prev.filter(c => c !== data.camera_id));
            break;
          case 'camera_list':
            console.log('[Dispatcher] Camera list:', data.cameras);
            setConnectedCameras(data.cameras || []);
            break;
        }
      } catch (e) {
        console.error('[Dispatcher] Failed to parse message:', e);
      }
    };

    wsRef.current = ws;
  }, [reconnectCount]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendDecision = useCallback((incidentId: string, decision: 'confirm' | 'reject', reason?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: decision,
        incident_id: incidentId,
        reason,
        dispatcher_id: 'dispatcher_1',
        timestamp: new Date().toISOString()
      };
      console.log(`[Dispatcher] Sending decision: ${decision} for ${incidentId}`);
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  return { 
    connected, 
    sendDecision, 
    connectedCameras,
    reconnectCount,
    wsUrl: WS_BASE_URL
  };
}