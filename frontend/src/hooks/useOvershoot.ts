import { useEffect, useRef, useCallback } from 'react';
import { RealtimeVision } from '@overshoot/sdk';

const OVERSHOOT_PROMPT = `You are an AI monitoring a live security camera feed for a 911 emergency dispatch system.

Your job: Analyze the video and describe what you observe with extreme clarity and precision.

FOCUS ON:
- People: Count, locations, visible conditions, behaviors, signs of distress or injury
- Vehicles: Types, movements, collisions, damage, smoke, leaking fluids
- Structures: Buildings, visible fire, smoke (color and density), structural damage
- Hazards: Debris, spills, downed power lines, broken glass, dangerous conditions
- Emergency indicators: Flames, smoke, unconscious persons, violent behavior, traffic accidents

CRITICAL RULES:
1. Be factual and objective - describe only what is visible
2. Use clear, concise emergency language
3. Prioritize life-safety observations
4. Include spatial context (location in frame, relative positions)
5. Note any changes from previous observations if significant

EMERGENCY FORMAT:
If you detect a potential emergency, start with: "⚠️ [EMERGENCY_TYPE]:" followed by details
Emergency types: FIRE, MEDICAL, COLLISION, ASSAULT, HAZMAT, STRUCTURAL

NORMAL FORMAT:
For routine scenes, simply describe what you see without the warning symbol.

Examples:
- "⚠️ COLLISION: Two-vehicle accident at intersection. Sedan and pickup truck. Front-end damage visible on both. Smoke from sedan engine. One person exiting sedan, mobile. Pickup driver still seated, airbag deployed."
- "Residential street. Two parked cars. One pedestrian walking small dog on sidewalk. Clear weather. No unusual activity."
- "⚠️ MEDICAL: Person lying motionless on ground near bus stop. Three bystanders surrounding. One person kneeling beside victim, another on phone."`;

interface UseOvershootConfig {
  onDescription: (description: string, timestamp: string) => void;
  onError?: (error: Error) => void;
  enabled: boolean;
}

export function useOvershoot({ onDescription, onError, enabled }: UseOvershootConfig) {
  const visionRef = useRef<RealtimeVision | null>(null);
  const isStartedRef = useRef(false);

  const startVision = useCallback(async () => {
    if (isStartedRef.current || !enabled) return;

    const apiKey = import.meta.env.VITE_OVERSHOOT_API_KEY;
    const apiUrl = import.meta.env.VITE_OVERSHOOT_API_URL;

    if (!apiKey || !apiUrl) {
      const error = new Error('Overshoot API credentials missing in environment variables');
      console.error('❌', error.message);
      onError?.(error);
      return;
    }

    try {
      console.log('🎥 Initializing Overshoot SDK...');

      visionRef.current = new RealtimeVision({
        apiUrl: apiUrl,
        apiKey: apiKey,
        prompt: OVERSHOOT_PROMPT,
        source: {
          type: 'camera',
          cameraFacing: 'environment'
        },
        processing: {
          clip_length_seconds: 3,  // 3-second clips for context
          delay_seconds: 3,         // New result every 3 seconds
          fps: 30,
          sampling_ratio: 0.15      // 15% of frames for balance
        },
        onResult: (result) => {
          const description = result.result || 'No description available';
          const timestamp = new Date().toISOString();

          console.log('📹 Overshoot result:', description);
          onDescription(description, timestamp);
        },
      });

      await visionRef.current.start();
      isStartedRef.current = true;
      console.log('✅ Overshoot SDK started');

    } catch (err) {
      console.error('❌ Overshoot initialization failed:', err);
      onError?.(err as Error);
      isStartedRef.current = false;
    }
  }, [enabled, onDescription, onError]);

  const stopVision = useCallback(async () => {
    if (visionRef.current && isStartedRef.current) {
      try {
        await visionRef.current.stop();
        console.log('🛑 Overshoot SDK stopped');
      } catch (err) {
        console.error('Error stopping Overshoot:', err);
      }
      isStartedRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      startVision();
    } else {
      stopVision();
    }

    return () => {
      stopVision();
    };
  }, [enabled, startVision, stopVision]);

  return {
    isActive: isStartedRef.current,
    updatePrompt: (newPrompt: string) => {
      if (visionRef.current && isStartedRef.current) {
        visionRef.current.updatePrompt(newPrompt);
      }
    }
  };
}