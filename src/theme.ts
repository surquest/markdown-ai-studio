'use client';

import { createTheme, ThemeOptions } from '@mui/material/styles';
import themeConfig from '@/lib/config/theme-config.json';

const theme = createTheme(themeConfig as ThemeOptions);

export default theme;
