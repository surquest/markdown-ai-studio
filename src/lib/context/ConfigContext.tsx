'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import aiConfigJson from '@/lib/config/ai-config.json';
import appConfigJson from '@/lib/config/app-config.json';

export interface AIConfig {
  projectId: string;
  location: string;
  modelId: string;
  temperature: number;
  thinkingLevel: 'none' | 'low' | 'medium' | 'high';
  systemInstruction: string;
  debugMode: boolean;
}

export interface AppConfig {
  drawioViewerUrl: string;
}

export interface AuthState {
  accessToken: string | null;
  expiresAt: number | null;
  userEmail: string | null;
  userName: string | null;
  userPicture: string | null;
}

const defaultAuth: AuthState = {
  accessToken: null,
  expiresAt: null,
  userEmail: null,
  userName: null,
  userPicture: null,
};

interface ConfigContextValue {
  clientId: string;
  setClientId: (id: string) => void;
  aiConfig: AIConfig;
  setAIConfig: (config: AIConfig) => void;
  updateAIConfig: (partial: Partial<AIConfig>) => void;
  appConfig: AppConfig;
  setAppConfig: (config: AppConfig) => void;
  updateAppConfig: (partial: Partial<AppConfig>) => void;
  auth: AuthState;
  setAuth: (auth: AuthState) => void;
  clearAuth: () => void;
  isTokenValid: () => boolean;
  systemInstructionExamples: string[];
  defaultDocument: string;
}

export const AVAILABLE_MODELS = aiConfigJson.availableModels;

export const THINKING_LEVELS = aiConfigJson.thinkingLevels as unknown as readonly ['none', 'low', 'medium', 'high'];

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

export function ConfigProvider({
  children,
  defaultInstruction,
  examples,
  defaultDocument
}: {
  children: ReactNode;
  defaultInstruction: string;
  examples: string[];
  defaultDocument: string;
}) {
  const [clientId, setClientId] = useState(aiConfigJson.defaultConfig.oauthClientId || '');
  const [aiConfig, setAIConfig] = useState<AIConfig>({
    projectId: aiConfigJson.defaultConfig.projectId,
    location: aiConfigJson.defaultConfig.location,
    modelId: aiConfigJson.defaultConfig.modelId,
    temperature: aiConfigJson.defaultConfig.temperature,
    thinkingLevel: aiConfigJson.defaultConfig.thinkingLevel as AIConfig['thinkingLevel'],
    systemInstruction: defaultInstruction,
    debugMode: false,
  });
  const [appConfig, setAppConfig] = useState<AppConfig>({
    drawioViewerUrl: appConfigJson.defaultConfig.drawioViewerUrl,
  });
  const [auth, setAuth] = useState<AuthState>(defaultAuth);

  useEffect(() => {
    try {
      const storedAppConfig = localStorage.getItem('app_config');
      if (storedAppConfig) {
        setAppConfig(JSON.parse(storedAppConfig));
      }
    } catch (e) {
      console.error('Failed to load app config', e);
    }
  }, []);

  useEffect(() => {
    try {
      const storedAuth = sessionStorage.getItem('auth_state');
      if (storedAuth) {
        setAuth(JSON.parse(storedAuth));
      }
    } catch (e) {
      console.error('Failed to load auth from session storage', e);
    }
  }, []);

  const handleSetAuth = useCallback((newAuth: AuthState) => {
    setAuth(newAuth);
    try {
      sessionStorage.setItem('auth_state', JSON.stringify(newAuth));
    } catch (e) {
      console.error('Failed to save auth to session storage', e);
    }
  }, []);

  const updateAIConfig = useCallback((partial: Partial<AIConfig>) => {
    setAIConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const updateAppConfig = useCallback((partial: Partial<AppConfig>) => {
    setAppConfig((prev) => {
      const newConfig = { ...prev, ...partial };
      try {
        localStorage.setItem('app_config', JSON.stringify(newConfig));
      } catch (e) {
        console.error('Failed to save app config', e);
      }
      return newConfig;
    });
  }, []);

  const clearAuth = useCallback(() => {
    setAuth(defaultAuth);
    sessionStorage.removeItem('auth_state');
  }, []);

  const isTokenValid = useCallback(() => {
    if (!auth.accessToken || !auth.expiresAt) return false;
    return Date.now() < auth.expiresAt;
  }, [auth.accessToken, auth.expiresAt]);

  return (
    <ConfigContext.Provider
      value={{
        clientId,
        setClientId,
        aiConfig,
        setAIConfig,
        updateAIConfig,
        appConfig,
        setAppConfig,
        updateAppConfig,
        auth,
        setAuth: handleSetAuth,
        clearAuth,
        isTokenValid,
        systemInstructionExamples: examples,
        defaultDocument,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}
