'use client';

import { useCallback } from 'react';
import { useConfig } from '@/lib/context/ConfigContext';

interface VertexAIRequest {
  prompt: string;
  context?: string;
  systemInstruction?: string;
}

interface VertexAIResponse {
  text: string;
  error?: string;
}

export function useVertexAI() {
  const { aiConfig, auth, clearAuth, isTokenValid } = useConfig();

  const generate = useCallback(
    async ({ prompt, context, systemInstruction }: VertexAIRequest): Promise<VertexAIResponse> => {
      if (!isTokenValid()) {
        clearAuth();
        return { text: '', error: 'Token expired. Please sign in again.' };
      }

      if (!aiConfig.projectId) {
        return { text: '', error: 'Please configure your GCP Project ID in Settings.' };
      }

      const locationPrefix = aiConfig.location === 'global' ? '' : `${aiConfig.location}-`;
      const endpoint = `https://${locationPrefix}aiplatform.googleapis.com/v1/projects/${aiConfig.projectId}/locations/${aiConfig.location}/publishers/google/models/${aiConfig.modelId}:generateContent`;

      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      if (context) {
        contents.push({
          role: 'user',
          parts: [{ text: `Context:\n${context}\n\nRequest:\n${prompt}` }],
        });
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: prompt }],
        });
      }

      const sysInstruction = systemInstruction || aiConfig.systemInstruction;

      const body: Record<string, unknown> = {
        contents,
        generationConfig: {
          temperature: aiConfig.temperature,
          maxOutputTokens: 8192,
        },
      };

      if (sysInstruction) {
        body.systemInstruction = {
          parts: [{ text: sysInstruction }],
        };
      }

      if (aiConfig.thinkingLevel !== 'none') {
        body.generationConfig = {
          ...(body.generationConfig as Record<string, unknown>),
          thinkingConfig: {
            thinkingBudget: aiConfig.thinkingLevel === 'low' ? 1024 : aiConfig.thinkingLevel === 'medium' ? 4096 : 8192,
          },
        };
      }

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${auth.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (response.status === 401) {
          clearAuth();
          return { text: '', error: 'Authentication expired. Please sign in again.' };
        }

        if (response.status === 403) {
          return { text: '', error: 'Permission denied. Check your GCP project permissions.' };
        }

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const message = (errData as { error?: { message?: string } })?.error?.message || `API error: ${response.status}`;
          return { text: '', error: message };
        }

        const data = await response.json();
        const candidates = data.candidates;
        if (!candidates || candidates.length === 0) {
          return { text: '', error: 'No response generated.' };
        }

        const parts = candidates[0].content?.parts;
        if (!parts || parts.length === 0) {
          return { text: '', error: 'Empty response from model.' };
        }

        // Filter out thinking parts, only return text parts
        const textParts = parts.filter((p: { text?: string; thought?: boolean }) => !p.thought && p.text);
        const text = textParts.map((p: { text: string }) => p.text).join('');

        return { text };
      } catch (err) {
        return { text: '', error: `Network error: ${err instanceof Error ? err.message : 'Unknown error'}` };
      }
    },
    [aiConfig, auth.accessToken, clearAuth, isTokenValid]
  );

  return { generate };
}
