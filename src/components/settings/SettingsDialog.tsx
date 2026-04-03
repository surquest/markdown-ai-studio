'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Typography,
  Box,
  Chip,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { useConfig, AVAILABLE_MODELS, THINKING_LEVELS } from '@/lib/context/ConfigContext';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { aiConfig, updateAIConfig, appConfig, updateAppConfig, systemInstructionExamples } = useConfig();
  const [localConfig, setLocalConfig] = useState(aiConfig);
  const [localAppConfig, setLocalAppConfig] = useState(appConfig);
  useEffect(() => {
    if (open) {
      setLocalConfig(aiConfig);
      setLocalAppConfig(appConfig);
    }
  }, [open, aiConfig, appConfig]);

  const handleSave = () => {
    updateAIConfig(localConfig);
    updateAppConfig(localAppConfig);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Typography variant="subtitle2" color="primary">
            AI Configuration
          </Typography>
          <TextField
            fullWidth
            label="GCP Project ID"
            value={localConfig.projectId}
            onChange={(e) => setLocalConfig((prev) => ({ ...prev, projectId: e.target.value }))}
            placeholder="my-gcp-project"
            size="small"
          />

          <TextField
            fullWidth
            label="Location"
            value={localConfig.location}
            onChange={(e) => setLocalConfig((prev) => ({ ...prev, location: e.target.value }))}
            placeholder="us-central1"
            size="small"
          />

          <FormControl fullWidth size="small">
            <InputLabel>Model</InputLabel>
            <Select
              value={localConfig.modelId}
              label="Model"
              onChange={(e) => setLocalConfig((prev) => ({ ...prev, modelId: e.target.value }))}
            >
              {AVAILABLE_MODELS.map((model) => (
                <MenuItem key={model} value={model}>
                  {model}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Thinking Level</InputLabel>
            <Select
              value={localConfig.thinkingLevel}
              label="Thinking Level"
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  thinkingLevel: e.target.value as typeof prev.thinkingLevel,
                }))
              }
            >
              {THINKING_LEVELS.map((level) => (
                <MenuItem key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'none' }}>
            <Typography variant="body2" gutterBottom>
              Temperature: {localConfig.temperature.toFixed(1)}
            </Typography>
            <Slider
              value={localConfig.temperature}
              onChange={(_, val) => setLocalConfig((prev) => ({ ...prev, temperature: val as number }))}
              min={0}
              max={2}
              step={0.1}
              marks={[
                { value: 0, label: '0' },
                { value: 1, label: '1' },
                { value: 2, label: '2' },
              ]}
            />
          </Box>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="System Instruction"
            value={localConfig.systemInstruction}
            onChange={(e) => setLocalConfig((prev) => ({ ...prev, systemInstruction: e.target.value }))}
            size="small"
          />

          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Preset instructions:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {systemInstructionExamples.map((example, i) => (
                <Chip
                  key={i}
                  label={example.substring(0, 40) + '...'}
                  size="small"
                  variant="outlined"
                  onClick={() => setLocalConfig((prev) => ({ ...prev, systemInstruction: example }))}
                />
              ))}
            </Box>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={localConfig.debugMode}
                onChange={(e) => setLocalConfig((prev) => ({ ...prev, debugMode: e.target.checked }))}
              />
            }
            label="Enable Debug Mode (UI prompt before AI execution)"
          />

          <Typography variant="subtitle2" color="primary" sx={{ mt: 2 }}>
            App Configuration
          </Typography>
          <TextField
            fullWidth
            label="Draw.io Viewer Script URL"
            value={localAppConfig.drawioViewerUrl}
            onChange={(e) => setLocalAppConfig((prev) => ({ ...prev, drawioViewerUrl: e.target.value }))}
            placeholder="https://www.draw.io/js/viewer.min.js"
            size="small"
            helperText="URL of the Draw.io viewer library script"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
