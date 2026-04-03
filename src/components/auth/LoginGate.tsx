'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Avatar,
  Stack,
} from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { useConfig } from '@/lib/context/ConfigContext';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token: string; expires_in: number; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const { clientId, setClientId, auth, setAuth, isTokenValid } = useConfig();
  const [inputClientId, setInputClientId] = useState(clientId);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    if (!inputClientId.trim()) {
      setError('Please enter a Google OAuth Client ID');
      return;
    }

    setClientId(inputClientId.trim());
    setError(null);
    setLoading(true);

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.google) {
        setError('Failed to load Google Identity Services');
        setLoading(false);
        return;
      }

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: inputClientId.trim(),
        scope: 'https://www.googleapis.com/auth/cloud-platform openid email profile',
        callback: (response) => {
          setLoading(false);
          if (response.error) {
            setError(`Authentication failed: ${response.error}`);
            return;
          }

          // Decode user info from access token via userinfo endpoint
          fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` },
          })
            .then((res) => res.json())
            .then((userInfo) => {
              setAuth({
                accessToken: response.access_token,
                expiresAt: Date.now() + response.expires_in * 1000,
                userEmail: userInfo.email || null,
                userName: userInfo.name || null,
                userPicture: userInfo.picture || null,
              });
            })
            .catch(() => {
              setAuth({
                accessToken: response.access_token,
                expiresAt: Date.now() + response.expires_in * 1000,
                userEmail: null,
                userName: null,
                userPicture: null,
              });
            });
        },
      });

      tokenClient.requestAccessToken();
    };
    script.onerror = () => {
      setError('Failed to load Google Identity Services script');
      setLoading(false);
    };
    document.head.appendChild(script);
  };

  if (auth.accessToken && isTokenValid()) {
    return <>{children}</>;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 480, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3} alignItems="center">
            <Typography variant="h4" fontWeight={700} textAlign="center">
              Markdown AI Studio
            </Typography>
            <Typography variant="body1" color="text.secondary" textAlign="center">
              A client-side Markdown editor with Vertex AI integration.
              Sign in with Google to get started.
            </Typography>
            <TextField
              fullWidth
              label="Google OAuth Client ID"
              placeholder="xxxx.apps.googleusercontent.com"
              value={inputClientId}
              onChange={(e) => setInputClientId(e.target.value)}
              helperText="Enter your Google Cloud OAuth 2.0 Client ID"
              error={!!error}
              size="small"
            />
            {error && (
              <Typography variant="body2" color="error">
                {error}
              </Typography>
            )}
            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={<GoogleIcon />}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
