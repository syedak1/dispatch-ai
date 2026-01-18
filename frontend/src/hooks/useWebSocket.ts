import { useEffect, useRef, useCallback, useState } from 'react';
import type { Alert } from '../types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export function useDispatcherSocket(onAlert: (alert: Alert) => void) {
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const wsUrl = BACKEND_URL.replace('http', 'ws') + '/ws/dispatcher';
    console.log('Connecting to:', wsUrl);
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('✅ Dispatcher WebSocket connected');
      setConnected(true);
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📩 Received:', data.type);
        
        if (data.type === 'alert') {
          onAlert(data.data);
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    ws.current.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    ws.current.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setConnected(false);
      
      // Reconnect after 3 seconds
      reconnectTimeout.current = setTimeout(() => {
        console.log('🔄 Reconnecting...');
        connect();
      }, 3000);
    };
  }, [onAlert]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  const sendDecision = useCallback((
    incidentId: string,
    decision: 'confirm' | 'reject',
    reason?: string
  ) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: decision,
        incident_id: incidentId,
        reason: reason || '',
        dispatcher_id: 'dispatcher_001'
      }));
      console.log(`📤 Sent ${decision} for ${incidentId}`);
    } else {
      console.error('WebSocket not connected');
    }
  }, []);

  return { connected, sendDecision };
}


export function useCameraSocket(cameraId: string) {
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsUrl = BACKEND_URL.replace('http', 'ws') + `/ws/camera/${cameraId}`;
    console.log('Camera connecting to:', wsUrl);
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log(`✅ Camera ${cameraId} connected`);
      setConnected(true);
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`📩 Camera ${cameraId} received:`, data.type);
        
        if (data.type === 'request_clip') {
          console.log('📹 Clip requested for incident:', data.incident_id);
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    ws.current.onclose = () => {
      console.log(`🔌 Camera ${cameraId} disconnected`);
      setConnected(false);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [cameraId]);

  const sendDescription = useCallback((description: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'overshoot_result',
        description,
        timestamp: new Date().toISOString()
      }));
    }
  }, []);

  return { connected, sendDescription };
}