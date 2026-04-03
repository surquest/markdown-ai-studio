'use client';

import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '@/theme';
import { ConfigProvider } from '@/lib/context/ConfigContext';
import { VFSProvider } from '@/lib/context/VFSContext';

export default function Providers({
  children,
  defaultInstruction,
  examples,
  defaultDocument
}: {
  children: React.ReactNode;
  defaultInstruction: string;
  examples: string[];
  defaultDocument: string;
}) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ConfigProvider defaultInstruction={defaultInstruction} examples={examples} defaultDocument={defaultDocument}>
        <VFSProvider>
          {children}
        </VFSProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}
