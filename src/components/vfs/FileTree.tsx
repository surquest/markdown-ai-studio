'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Collapse,
  useTheme,
} from '@mui/material';
import {
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  Description as DescriptionIcon,
  CreateNewFolder as CreateNewFolderIcon,
  NoteAdd as NoteAddIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Download as DownloadAllIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { useVFS, type VFSTreeNode } from '@/lib/context/VFSContext';
import { isTextFile } from '@/lib/vfs/vfs-db';

// ─── File icon helper ──────────────────────────────────

function FileIconForName({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return <ImageIcon fontSize="small" sx={{ color: 'success.main' }} />;
  }
  if (['md', 'markdown', 'txt'].includes(ext)) {
    return <DescriptionIcon fontSize="small" sx={{ color: 'info.main' }} />;
  }
  return <FileIcon fontSize="small" sx={{ color: 'action.active' }} />;
}

// ─── Tree Node Component ──────────────────────────────

function TreeNode({
  node,
  depth,
  activeFile,
  onFileClick,
  onContextAction,
  onDropFiles,
}: {
  node: VFSTreeNode;
  depth: number;
  activeFile: string | null;
  onFileClick: (path: string) => void;
  onContextAction: (action: string, node: VFSTreeNode) => void;
  onDropFiles: (folderPath: string, files: FileList) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const theme = useTheme();

  const isFolder = node.type === 'folder';
  const isActive = activeFile === node.path;
  const isEditable = !isFolder && isTextFile(node.name);

  const handleClick = () => {
    if (isFolder) {
      setExpanded(!expanded);
    } else if (isEditable) {
      onFileClick(node.path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY });
  };

  const handleMenuAction = (action: string) => {
    setContextMenu(null);
    if (action === 'copyPath') {
      const isMedia = (() => {
        const lower = node.name.toLowerCase();
        if (lower.endsWith('.drawio') || lower.endsWith('.drawio.xml')) return true;
        const ext = lower.split('.').pop() || '';
        return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'drawio'].includes(ext);
      })();
      if (isMedia) {
        navigator.clipboard.writeText(`![${node.name}](${node.path})`);
      } else {
        navigator.clipboard.writeText(`--8<-- "${node.path}"`);
      }
      return;
    }
    onContextAction(action, node);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isFolder) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (!isFolder || !e.dataTransfer.files?.length) return;
    setExpanded(true);
    onDropFiles(node.path, e.dataTransfer.files);
  };

  return (
    <>
      <Box
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          pl: depth * 2,
          pr: 1,
          py: 0.4,
          cursor: 'pointer',
          borderRadius: 0.5,
          bgcolor: dragOver ? 'action.focus' : isActive ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: isActive ? 'action.selected' : 'action.hover' },
          userSelect: 'none',
          minHeight: 28,
          outline: dragOver ? '2px dashed' : 'none',
          outlineColor: dragOver ? 'primary.main' : undefined,
        }}
      >
        {isFolder && (
          expanded
            ? <ExpandMoreIcon sx={{ fontSize: 16, color: 'action.active' }} />
            : <ChevronRightIcon sx={{ fontSize: 16, color: 'action.active' }} />
        )}
        {!isFolder && <Box sx={{ width: 16 }} />}

        {isFolder ? (
          expanded
            ? <FolderOpenIcon fontSize="small" sx={{ color: 'warning.main' }} />
            : <FolderIcon fontSize="small" sx={{ color: 'warning.main' }} />
        ) : (
          <FileIconForName name={node.name} />
        )}

        <Typography
          variant="body2"
          noWrap
          sx={{
            fontSize: '0.8rem',
            fontWeight: isActive ? 600 : 400,
            color: isActive ? 'primary.main' : 'text.primary',
            flexGrow: 1,
          }}
        >
          {node.name}
        </Typography>
      </Box>

      {/* Context menu */}
      <Menu
        open={contextMenu !== null}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
      >
        {isFolder && (
          <MenuItem onClick={() => handleMenuAction('newFolder')}>
            <ListItemIcon><CreateNewFolderIcon fontSize="small" /></ListItemIcon>
            <ListItemText>New Folder</ListItemText>
          </MenuItem>
        )}
        {isFolder && (
          <MenuItem onClick={() => handleMenuAction('newFile')}>
            <ListItemIcon><NoteAddIcon fontSize="small" /></ListItemIcon>
            <ListItemText>New File</ListItemText>
          </MenuItem>
        )}
        {isFolder && (
          <MenuItem onClick={() => handleMenuAction('upload')}>
            <ListItemIcon><UploadIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Upload File</ListItemText>
          </MenuItem>
        )}
        {!isFolder && (
          <MenuItem onClick={() => handleMenuAction('copyPath')}>
            <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Copy Path</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => handleMenuAction('rename')}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('delete')}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Children */}
      {isFolder && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              onFileClick={onFileClick}
              onContextAction={onContextAction}
              onDropFiles={onDropFiles}
            />
          ))}
          {node.children.length === 0 && (
            <Typography
              variant="caption"
              sx={{ pl: (depth + 1) * 2 + 3, py: 0.5, color: 'text.disabled', display: 'block' }}
            >
              Empty folder
            </Typography>
          )}
        </Collapse>
      )}
    </>
  );
}

// ─── Main FileTree Component ───────────────────────────

export default function FileTree({ onExportZip }: { onExportZip: () => void }) {
  const { tree, activeFile, openFile, addFolder, addFile, uploadFile, remove, rename } = useVFS();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<{
    open: boolean;
    type: 'newFolder' | 'newFile' | 'rename';
    targetNode: VFSTreeNode | null;
    value: string;
  }>({ open: false, type: 'newFolder', targetNode: null, value: '' });
  const [uploadTarget, setUploadTarget] = useState('/');

  const handleContextAction = useCallback(
    (action: string, node: VFSTreeNode) => {
      switch (action) {
        case 'newFolder':
          setDialog({ open: true, type: 'newFolder', targetNode: node, value: '' });
          break;
        case 'newFile':
          setDialog({ open: true, type: 'newFile', targetNode: node, value: '' });
          break;
        case 'upload':
          setUploadTarget(node.path);
          uploadRef.current?.click();
          break;
        case 'rename':
          setDialog({ open: true, type: 'rename', targetNode: node, value: node.name });
          break;
        case 'delete':
          remove(node.path);
          break;
      }
    },
    [remove],
  );

  const handleDialogConfirm = async () => {
    if (!dialog.value.trim() || !dialog.targetNode) return;

    const parentDir = dialog.targetNode.type === 'folder'
      ? dialog.targetNode.path
      : dialog.targetNode.path.split('/').slice(0, -1).join('/') || '/';

    switch (dialog.type) {
      case 'newFolder': {
        const path = parentDir === '/' ? `/${dialog.value.trim()}` : `${parentDir}/${dialog.value.trim()}`;
        await addFolder(path);
        break;
      }
      case 'newFile': {
        const path = parentDir === '/' ? `/${dialog.value.trim()}` : `${parentDir}/${dialog.value.trim()}`;
        await addFile(path);
        break;
      }
      case 'rename': {
        const parent = dialog.targetNode.path.split('/').slice(0, -1).join('/') || '/';
        const newPath = parent === '/' ? `/${dialog.value.trim()}` : `${parent}/${dialog.value.trim()}`;
        await rename(dialog.targetNode.path, newPath);
        break;
      }
    }
    setDialog({ open: false, type: 'newFolder', targetNode: null, value: '' });
  };

  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await uploadFile(uploadTarget, files[i]);
    }
    e.target.value = '';
  };

  const handleRootNewFolder = () => {
    setDialog({ open: true, type: 'newFolder', targetNode: tree, value: '' });
  };

  const handleRootNewFile = () => {
    setDialog({ open: true, type: 'newFile', targetNode: tree, value: '' });
  };

  const handleRootUpload = () => {
    setUploadTarget('/');
    uploadRef.current?.click();
  };

  const handleDropFiles = useCallback(
    async (folderPath: string, files: FileList) => {
      for (let i = 0; i < files.length; i++) {
        await uploadFile(folderPath, files[i]);
      }
    },
    [uploadFile],
  );

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files?.length) {
      handleDropFiles('/', e.dataTransfer.files);
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        minWidth: 250,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1,
          py: 0.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          gap: 0.5,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', flexGrow: 1, letterSpacing: 0.5 }}>
          Files
        </Typography>
        <Tooltip title="New File">
          <IconButton size="small" onClick={handleRootNewFile}>
            <NoteAddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="New Folder">
          <IconButton size="small" onClick={handleRootNewFolder}>
            <CreateNewFolderIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Upload">
          <IconButton size="small" onClick={handleRootUpload}>
            <UploadIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Download All (ZIP)">
          <IconButton size="small" onClick={onExportZip}>
            <DownloadAllIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Tree */}
      <Box
        sx={{ flexGrow: 1, overflow: 'auto', py: 0.5 }}
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
      >
        {tree.children.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={0}
            activeFile={activeFile}
            onFileClick={openFile}
            onContextAction={handleContextAction}
            onDropFiles={handleDropFiles}
          />
        ))}
        {tree.children.length === 0 && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.disabled">
              No files yet
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Drop files here or use toolbar to add
            </Typography>
          </Box>
        )}
      </Box>

      {/* Hidden upload input */}
      <input
        ref={uploadRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleUploadChange}
      />

      {/* Name dialog */}
      <Dialog
        open={dialog.open}
        onClose={() => setDialog((prev) => ({ ...prev, open: false }))}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {dialog.type === 'newFolder' ? 'New Folder' : dialog.type === 'newFile' ? 'New File' : 'Rename'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Name"
            value={dialog.value}
            onChange={(e) => setDialog((prev) => ({ ...prev, value: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleDialogConfirm();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog((prev) => ({ ...prev, open: false }))}>Cancel</Button>
          <Button onClick={handleDialogConfirm} variant="contained">
            {dialog.type === 'rename' ? 'Rename' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
