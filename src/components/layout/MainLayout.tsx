"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Tooltip,
  Avatar,
  Box,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Snackbar,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import {
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  NoteAdd as NoteAddIcon,
  ViewSidebar as ViewSidebarIcon,
} from "@mui/icons-material";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import { useConfig } from "@/lib/context/ConfigContext";
import MarkdownPreview, {
  OutlineSidebar,
} from "@/components/preview/MarkdownPreview";
import SettingsDialog from "@/components/settings/SettingsDialog";

import type { MonacoWrapperHandle } from "@/components/editor/MonacoWrapper";

const MonacoWrapper = dynamic(
  () => import("@/components/editor/MonacoWrapper"),
  {
    ssr: false,
    loading: () => (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "text.secondary",
        }}
      >
        Loading editor...
      </Box>
    ),
  },
);

export default function MainLayout() {
  const { auth, clearAuth, defaultDocument } = useConfig();
  const [markdown, setMarkdown] = useState(defaultDocument);
  const [diffMarkdown, setDiffMarkdown] = useState<string | null>(null);

  const displayMarkdown = diffMarkdown !== null ? diffMarkdown : markdown;

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("markdown_content");
      if (stored) {
        setMarkdown(stored);
      }
    } catch (e) {}
  }, []);

  const handleMarkdownChange = useCallback((newMarkdown: string) => {
    setMarkdown(newMarkdown);
    try {
      localStorage.setItem("markdown_content", newMarkdown);
    } catch (e) {}
  }, []);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showOutline, setShowOutline] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [currentFileName, setCurrentFileName] = useState("document.md");
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info";
  }>({
    open: false,
    message: "",
    severity: "info",
  });
  const [isDragging, setIsDragging] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoWrapperHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEditorScroll = useCallback(
    (scrollTop: number, scrollHeight: number, clientHeight: number) => {
      if (!previewRef.current) return;
      const scrollFraction = scrollTop / (scrollHeight - clientHeight || 1);
      const previewScrollHeight =
        previewRef.current.scrollHeight - previewRef.current.clientHeight;
      previewRef.current.scrollTop = scrollFraction * previewScrollHeight;
    },
    [],
  );

  const handleNewDocument = () => {
    handleMarkdownChange("# New Document\n\n");
    setSnackbar({
      open: true,
      message: "New document created",
      severity: "info",
    });
  };

  const handleExport = () => {
    setExportDialogOpen(true);
  };

  const confirmExport = () => {
    if (!currentFileName.trim()) return;
    let finalName = currentFileName.trim();
    if (!finalName.toLowerCase().endsWith('.md')) {
      finalName += '.md';
    }

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = finalName;
    a.click();
    URL.revokeObjectURL(url);
    
    setExportDialogOpen(false);
    setSnackbar({
      open: true,
      message: "Document exported",
      severity: "success",
    });
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const processFile = (file: File) => {
    if (!file.name.match(/\.(md|markdown|txt)$/i)) {
      setSnackbar({
        open: true,
        message: "Only markdown or text files are supported",
        severity: "error",
      });
      return;
    }

    setCurrentFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        handleMarkdownChange(content);
        setSnackbar({
          open: true,
          message: `Loaded ${file.name}`,
          severity: "success",
        });
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset input to allow re-importing the same file
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleLogout = () => {
    clearAuth();
    setAnchorEl(null);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "relative",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(25, 118, 210, 0.12)",
            border: "4px dashed #1976d2",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <Typography variant="h4" color="primary">
            Drop Markdown File Here
          </Typography>
        </Box>
      )}

      {/* App Bar */}
      <AppBar
        position="static"
        color="default"
        elevation={0}
        sx={{ borderBottom: "1px solid #e0e0e0" }}
      >
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: "primary.main",
              mr: 2,
              fontSize: "1rem",
            }}
          >
            Markdown AI Studio
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <Tooltip title="Import Markdown">
            <IconButton onClick={handleImport}>
              <UploadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export Markdown">
            <IconButton onClick={handleExport}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle Outline">
            <IconButton
              onClick={() => setShowOutline(!showOutline)}
              color={showOutline ? "primary" : "default"}
            >
              <ViewSidebarIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings">
            <IconButton
              onClick={() => setSettingsOpen(true)}
              sx={{ mr: 1 }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title={auth.userEmail || "Account"}>
            <IconButton
              size="small"
              onClick={(e) => setAnchorEl(e.currentTarget)}
            >
              <Avatar
                src={auth.userPicture || undefined}
                alt={auth.userName || "User"}
                sx={{ width: 28, height: 28, fontSize: "0.8rem" }}
              >
                {auth.userName?.[0] || "U"}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            {auth.userName && (
              <MenuItem disabled>
                <ListItemText
                  primary={auth.userName}
                  secondary={auth.userEmail}
                />
              </MenuItem>
            )}
            {auth.userName && <Divider />}
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Sign Out</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, display: "flex", overflow: "hidden" }}>
        {/* Editor + Preview Split */}
        <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
          <PanelGroup orientation="horizontal">
            <Panel defaultSize={50} minSize={25}>
              <Box
                sx={{
                  height: "100%",
                  position: "relative",
                  borderRight: "1px solid",
                  borderColor: "divider",
                }}
              >
                <MonacoWrapper
                  ref={editorRef}
                  value={markdown}
                  onChange={handleMarkdownChange}
                  onScroll={handleEditorScroll}
                  onDiffChange={setDiffMarkdown}
                />
              </Box>
            </Panel>
            <PanelResizeHandle
              style={
                {
                  width: 6,
                  backgroundColor: "var(--mui-palette-divider)",
                  cursor: "col-resize",
                } as CSSProperties
              }
            />
            <Panel defaultSize={50} minSize={25}>
              <MarkdownPreview content={displayMarkdown} previewRef={previewRef} />
            </Panel>
          </PanelGroup>
        </Box>

        {/* Outline Sidebar */}
        {showOutline && (
          <OutlineSidebar
            markdown={displayMarkdown}
            previewRef={previewRef}
            onItemClick={(line) => editorRef.current?.scrollToLine(line)}       
          />
        )}
      </Box>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Export Dialog */}
      <Dialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Export Document</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="File Name"
            type="text"
            fullWidth
            variant="outlined"
            value={currentFileName}
            onChange={(e) => setCurrentFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                confirmExport();
              }
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmExport} variant="contained" color="primary">
            Export
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
