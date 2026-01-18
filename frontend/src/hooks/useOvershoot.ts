import { useEffect, useRef, useState, useCallback } from 'react';

// Types for Overshoot SDK
interface OvershootResult {
  result: string;
  timestamp?: string;
}

interface UseOvershootConfig {
  onDescription: (description: string, timestamp: string) => void;
  onError: (error: Error) => void;
  enabled: boolean;
  sourceType: 'camera' | 'video';
  videoFile?: File;
}

// Environment variables
const OVERSHOOT_API_KEY = import.meta.env.VITE_OVERSHOOT_API_KEY || '';
const OVERSHOOT_API_URL = import.meta.env.VITE_OVERSHOOT_API_URL || 'https://cluster1.overshoot.ai/api/v0.2';

// Check if Overshoot SDK is available
const hasOvershootSDK = () => typeof window !== 'undefined' && (window as any).RealtimeVision;

/**
 * The prompt tells Overshoot WHAT TO LOOK FOR in the video.
 * 
 * CHANGE THIS to adjust what triggers alerts!
 */
const OVERSHOOT_PROMPT = `Describe what you see in detail. Focus on:
- People: count, actions, any signs of distress or injury
- Vehicles: types, movements, any collisions or damage
- Hazards: smoke, fire, flames, spills, structural damage
- Medical: anyone lying down, unconscious, injured, or needing help
- Safety concerns: fights, aggressive behavior, suspicious activity

Be factual and specific. Describe what you ACTUALLY SEE.`;

/**
 * Mock descriptions for demo/testing
 */
const MOCK_NORMAL_DESCRIPTIONS = [
  'Street scene with pedestrians walking on sidewalk. Light vehicle traffic. Normal activity.',
  'Parking lot view. Several parked cars. One person walking toward building entrance.',
  'Intersection with traffic light. Cars waiting at red light. Pedestrians crossing.',
  'Office building entrance. People entering and exiting. Normal activity.',
];

export function useOvershoot(config: UseOvershootConfig) {
  const { onDescription, onError, enabled, sourceType, videoFile } = config;
  const [isActive, setIsActive] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [mode, setMode] = useState<'overshoot' | 'mock'>('mock');
  
  const visionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const mockIntervalRef = useRef<number | null>(null);
  const callbacksRef = useRef({ onDescription, onError });

  useEffect(() => {
    callbacksRef.current = { onDescription, onError };
  }, [onDescription, onError]);

  const initWithOvershoot = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      setHasPermission(true);

      if (hasOvershootSDK() && OVERSHOOT_API_KEY) {
        const RealtimeVision = (window as any).RealtimeVision;
        
        const vision = new RealtimeVision({
          apiUrl: OVERSHOOT_API_URL,
          apiKey: OVERSHOOT_API_KEY,
          prompt: OVERSHOOT_PROMPT,
          onResult: (result: OvershootResult) => {
            const timestamp = result.timestamp || new Date().toISOString();
            callbacksRef.current.onDescription(result.result, timestamp);
          },
          onError: (error: Error) => {
            callbacksRef.current.onError(error);
          }
        });

        await vision.start(stream);
        visionRef.current = vision;
        setMode('overshoot');
        setIsActive(true);
        console.log('✅ Overshoot SDK initialized');
      } else {
        console.log('⚠️ Overshoot not available, using mock mode');
        startMockMode();
      }
    } catch (error) {
      console.error('Camera init failed:', error);
      setHasPermission(false);
      callbacksRef.current.onError(error as Error);
    }
  }, []);

  const initWithVideo = useCallback(async (file: File) => {
    try {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.loop = true;
      videoElementRef.current = video;

      await video.play();

      if (hasOvershootSDK() && OVERSHOOT_API_KEY) {
        const RealtimeVision = (window as any).RealtimeVision;
        
        const vision = new RealtimeVision({
          apiUrl: OVERSHOOT_API_URL,
          apiKey: OVERSHOOT_API_KEY,
          prompt: OVERSHOOT_PROMPT,
          onResult: (result: OvershootResult) => {
            callbacksRef.current.onDescription(result.result, new Date().toISOString());
          },
          onError: (error: Error) => {
            callbacksRef.current.onError(error);
          }
        });

        await vision.start(video);
        visionRef.current = vision;
        setMode('overshoot');
        setIsActive(true);
      } else {
        startMockMode();
      }
    } catch (error) {
      console.error('Video init failed:', error);
      callbacksRef.current.onError(error as Error);
    }
  }, []);

  const startMockMode = useCallback(() => {
    setMode('mock');
    setIsActive(true);
    let index = 0;
    
    mockIntervalRef.current = window.setInterval(() => {
      const description = MOCK_NORMAL_DESCRIPTIONS[index % MOCK_NORMAL_DESCRIPTIONS.length];
      callbacksRef.current.onDescription(description, new Date().toISOString());
      index++;
    }, 2000);
    
    console.log('🎭 Mock mode started');
  }, []);

  const stopMockMode = useCallback(() => {
    if (mockIntervalRef.current !== null) {
      clearInterval(mockIntervalRef.current);
      mockIntervalRef.current = null;
    }
  }, []);

  const cleanup = useCallback(async () => {
    if (visionRef.current) {
      try { await visionRef.current.stop(); } catch (e) {}
      visionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoElementRef.current) {
      videoElementRef.current.pause();
      URL.revokeObjectURL(videoElementRef.current.src);
      videoElementRef.current = null;
    }
    stopMockMode();
    setIsActive(false);
  }, [stopMockMode]);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    if (sourceType === 'video' && videoFile) {
      initWithVideo(videoFile);
    } else {
      initWithOvershoot();
    }

    return () => { cleanup(); };
  }, [enabled, sourceType, videoFile, initWithOvershoot, initWithVideo, cleanup]);

  return { isActive, hasPermission, mode, cleanup };
}

export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export async function requestCameraPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch { return false; }
}