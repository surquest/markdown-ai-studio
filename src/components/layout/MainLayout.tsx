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
  NoteAdd as NoteAddIcon,
  ViewSidebar as ViewSidebarIcon,
  FolderCopy as FolderCopyIcon,
  DeleteSweep as DeleteSweepIcon,
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
import { useVFS } from "@/lib/context/VFSContext";
import FileTree from "@/components/vfs/FileTree";
import { exportWorkspaceAsZip } from "@/lib/vfs/export-zip";

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
  const { auth, clearAuth } = useConfig();
  const vfs = useVFS();
  
  const [diffMarkdown, setDiffMarkdown] = useState<string | null>(null);

  const effectiveMarkdown = diffMarkdown !== null ? diffMarkdown : (vfs.activeContent ?? "");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [showOutline, setShowOutline] = useState(true);
  const [showFileTree, setShowFileTree] = useState(true);
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
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoWrapperHandle>(null);

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

  const handleNewDocument = async () => {
    let finalName = "new-document";
    let index = 1;
    while (vfs.nodes.some(n => n.name === `${finalName}.md`)) {
      finalName = `new-document-${index++}`;
    }
    const path = `/${finalName}.md`;
    await vfs.addFile(path, "# New Document\n\n");
    setSnackbar({
      open: true,
      message: "New document created",
      severity: "info",
    });
  };

  const handleExport = () => {
    if (vfs.activeFile) {
      const activeFileName = vfs.activeFile.split('/').pop() || "document.md";
      setCurrentFileName(activeFileName);
    }
    setExportDialogOpen(true);
  };

  const confirmExport = () => {
    if (!currentFileName.trim()) return;
    let finalName = currentFileName.trim();
    if (!finalName.toLowerCase().endsWith('.md')) {
      finalName += '.md';
    }

    const blob = new Blob([effectiveMarkdown], { type: "text/markdown" });
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

  const handleClearWorkspace = async () => {
    await vfs.clearWorkspace();
    setClearDialogOpen(false);
    setSnackbar({
      open: true,
      message: "Workspace cleared successfully",
      severity: "success",
    });
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
    >

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

          <Tooltip title={showFileTree ? 'Hide Files' : 'Show Files'}>
            <IconButton
              onClick={() => setShowFileTree(!showFileTree)}
              color={showFileTree ? 'primary' : 'default'}
            >
              <FolderCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Clear Workspace">
            <IconButton onClick={() => setClearDialogOpen(true)} color="error">
              <DeleteSweepIcon fontSize="small" />
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
          <PanelGroup orientation="horizontal">
            {/* File Tree Sidebar */}
            {showFileTree && (
              <>
                <Panel defaultSize="250px" minSize="250px">
                  <Box sx={{ height: "100%", borderRight: "1px solid", borderColor: "divider" }}>
                    <FileTree onExportZip={() => exportWorkspaceAsZip()} />
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
              </>
            )}

            {/* Editor + Preview Split */}
            <Panel>
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
                  <MarkdownPreview content={diffMarkdown !== null ? diffMarkdown : undefined} previewRef={previewRef} />
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>

          {/* Outline Sidebar */}
          {showOutline && (
            <OutlineSidebar
              markdown={effectiveMarkdown}
              previewRef={previewRef}
              onItemClick={(line) => editorRef.current?.scrollToLine(line)}
            />
          )}
        </Box>

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

      {/* Clear Workspace Dialog */}
      <Dialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Clear Workspace</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete all files and folders in your workspace? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleClearWorkspace} variant="contained" color="error">
            Delete All
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
