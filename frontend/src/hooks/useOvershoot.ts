import { useEffect, useRef, useState, useCallback } from 'react';

// Overshoot SDK types
interface OvershootResult {
  result: string;
  timestamp?: string;
}

interface RealtimeVisionConfig {
  apiUrl: string;
  apiKey: string;
  prompt: string;
  onResult: (result: OvershootResult) => void;
  onError?: (error: Error) => void;
}

// We'll dynamically import the SDK or use a mock for development
interface RealtimeVision {
  start: (source?: MediaStream | HTMLVideoElement) => Promise<void>;
  stop: () => Promise<void>;
}

interface UseOvershootConfig {
  onDescription: (description: string, timestamp: string) => void;
  onError: (error: Error) => void;
  enabled: boolean;
  sourceType: 'camera' | 'video';
  videoFile?: File;
}

// Get API key from environment
const OVERSHOOT_API_KEY = import.meta.env.VITE_OVERSHOOT_API_KEY || '';
const OVERSHOOT_API_URL = import.meta.env.VITE_OVERSHOOT_API_URL || 'https://cluster1.overshoot.ai/api/v0.2';

export function useOvershoot(config: UseOvershootConfig) {
  const { onDescription, onError, enabled, sourceType, videoFile } = config;
  const [isActive, setIsActive] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const visionRef = useRef<RealtimeVision | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const callbacksRef = useRef({ onDescription, onError });

  // Keep callbacks fresh
  useEffect(() => {
    callbacksRef.current = { onDescription, onError };
  }, [onDescription, onError]);

  // Initialize Overshoot with camera
  const initWithCamera = useCallback(async () => {
    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Prefer back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      setHasPermission(true);

      // Check if Overshoot SDK is available
      if (typeof window !== 'undefined' && (window as any).RealtimeVision) {
        const RealtimeVision = (window as any).RealtimeVision;
        
        const vision = new RealtimeVision({
          apiUrl: OVERSHOOT_API_URL,
          apiKey: OVERSHOOT_API_KEY,
          prompt: 'Describe what you see in detail. Focus on: people, vehicles, any incidents, emergencies, smoke, fire, injuries, or unusual activity. Be factual and specific.',
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
        setIsActive(true);
        console.log('✅ Overshoot started with camera');
      } else {
        // Fallback: Use mock mode for development/testing
        console.log('⚠️ Overshoot SDK not loaded, using mock mode');
        startMockMode();
      }
    } catch (error) {
      console.error('Camera initialization failed:', error);
      setHasPermission(false);
      callbacksRef.current.onError(error as Error);
    }
  }, []);

  // Initialize Overshoot with video file
  const initWithVideo = useCallback(async (file: File) => {
    try {
      // Create video element for the file
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.loop = true;
      videoElementRef.current = video;

      await video.play();

      if (typeof window !== 'undefined' && (window as any).RealtimeVision) {
        const RealtimeVision = (window as any).RealtimeVision;
        
        const vision = new RealtimeVision({
          apiUrl: OVERSHOOT_API_URL,
          apiKey: OVERSHOOT_API_KEY,
          prompt: 'Describe what you see in detail. Focus on: people, vehicles, any incidents, emergencies, smoke, fire, injuries, or unusual activity. Be factual and specific.',
          onResult: (result: OvershootResult) => {
            const timestamp = result.timestamp || new Date().toISOString();
            callbacksRef.current.onDescription(result.result, timestamp);
          },
          onError: (error: Error) => {
            callbacksRef.current.onError(error);
          }
        });

        await vision.start(video);
        visionRef.current = vision;
        setIsActive(true);
        console.log('✅ Overshoot started with video file');
      } else {
        console.log('⚠️ Overshoot SDK not loaded, using mock mode with video');
        startMockMode();
      }
    } catch (error) {
      console.error('Video initialization failed:', error);
      callbacksRef.current.onError(error as Error);
    }
  }, []);

  // Mock mode for development when Overshoot SDK isn't loaded
  const mockIntervalRef = useRef<number | null>(null);
  
  const startMockMode = useCallback(() => {
    setIsActive(true);
    
    // Emit descriptions every 2 seconds
    mockIntervalRef.current = window.setInterval(() => {
      const mockDescriptions = [
        'Street scene with pedestrians walking. Light traffic visible. No apparent incidents.',
        'Parking lot view. Several vehicles parked. One person walking to their car.',
        'Intersection view. Traffic flowing normally. Pedestrian crossing signal active.',
        'Building entrance. People entering and exiting. Normal activity.',
      ];
      
      const description = mockDescriptions[Math.floor(Math.random() * mockDescriptions.length)];
      callbacksRef.current.onDescription(description, new Date().toISOString());
    }, 2000);
  }, []);

  const stopMockMode = useCallback(() => {
    if (mockIntervalRef.current !== null) {
      clearInterval(mockIntervalRef.current);
      mockIntervalRef.current = null;
    }
  }, []);

  // Cleanup function
  const cleanup = useCallback(async () => {
    // Stop Overshoot
    if (visionRef.current) {
      try {
        await visionRef.current.stop();
      } catch (e) {
        console.error('Error stopping Overshoot:', e);
      }
      visionRef.current = null;
    }

    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clean up video element
    if (videoElementRef.current) {
      videoElementRef.current.pause();
      URL.revokeObjectURL(videoElementRef.current.src);
      videoElementRef.current = null;
    }

    // Stop mock mode
    stopMockMode();

    setIsActive(false);
  }, [stopMockMode]);

  // Main effect - start/stop based on enabled state
  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    if (sourceType === 'video' && videoFile) {
      initWithVideo(videoFile);
    } else {
      initWithCamera();
    }

    return () => {
      cleanup();
    };
  }, [enabled, sourceType, videoFile, initWithCamera, initWithVideo, cleanup]);

  return {
    isActive,
    hasPermission,
    cleanup
  };
}

// Export a function to manually request camera permission
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch {
    return false;
  }
}

// Export function to check if running on mobile
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}