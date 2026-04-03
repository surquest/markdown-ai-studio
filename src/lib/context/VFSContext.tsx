'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  type VFSNode,
  listAll,
  createFolder,
  writeFile,
  readFile,
  deleteNode,
  renameNode,
  isTextFile,
  normalisePath,
  parentPath,
  clearAll,
} from '@/lib/vfs/vfs-db';
import { useConfig } from '@/lib/context/ConfigContext';

// ─── Types ─────────────────────────────────────────────

export interface VFSTreeNode extends VFSNode {
  children: VFSTreeNode[];
}

interface VFSContextValue {
  /** Flat list of all nodes */
  nodes: VFSNode[];
  /** Hierarchical tree rooted at "/" */
  tree: VFSTreeNode;
  /** Currently selected file path (open in editor) */
  activeFile: string | null;
  /** Open a file in the editor */
  openFile: (path: string) => void;
  /** Close the active file */
  closeFile: () => void;
  /** Content of the active file (for text files) */
  activeContent: string | null;
  /** Update content for the active file (auto-saves) */
  setActiveContent: (content: string) => void;
  /** Create a new folder */
  addFolder: (folderPath: string) => Promise<void>;
  /** Create a new empty text file */
  addFile: (filePath: string, content?: string) => Promise<void>;
  /** Upload a File object into the VFS */
  uploadFile: (targetFolder: string, file: File) => Promise<void>;
  /** Delete a node */
  remove: (path: string) => Promise<void>;
  /** Rename / move a node */
  rename: (oldPath: string, newPath: string) => Promise<void>;
  /** Read raw file data (for image blob resolution etc.) */
  readFileData: (path: string) => Promise<string | Blob | undefined>;
  /** Clear entire workspace storage */
  clearWorkspace: () => Promise<void>;
  /** Force refresh the node list from IndexedDB */
  refresh: () => Promise<VFSNode[]>;
  /** Loading state */
  loading: boolean;
}

const VFSContext = createContext<VFSContextValue | undefined>(undefined);

// ─── Tree builder ──────────────────────────────────────

function buildTree(nodes: VFSNode[]): VFSTreeNode {
  const root: VFSTreeNode = {
    path: '/',
    name: 'workspace',
    type: 'folder',
    createdAt: 0,
    updatedAt: 0,
    children: [],
  };

  const map = new Map<string, VFSTreeNode>();
  map.set('/', root);

  // Sort so parents come before children
  const sorted = [...nodes].sort((a, b) => a.path.localeCompare(b.path));

  for (const node of sorted) {
    const treeNode: VFSTreeNode = { ...node, children: [] };
    map.set(node.path, treeNode);

    const parent = parentPath(node.path);
    const parentNode = map.get(parent);
    if (parentNode) {
      parentNode.children.push(treeNode);
    } else {
      // Orphan — attach to root
      root.children.push(treeNode);
    }
  }

  // Sort children: folders first, then alphabetical
  const sortChildren = (n: VFSTreeNode) => {
    n.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sortChildren);
  };
  sortChildren(root);

  return root;
}

// ─── Provider ──────────────────────────────────────────

export function VFSProvider({ children }: { children: ReactNode }) {
  const { defaultDocument } = useConfig();
  const [nodes, setNodes] = useState<VFSNode[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activeContent, setActiveContentState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const all = await listAll();
    setNodes(all);
    return all;
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await refresh();
      if (cancelled) return;
      if (all.length === 0) {
        // Initialize with default file
        await writeFile('/intro.md', defaultDocument, 'text/markdown');
        if (cancelled) return;
        const updated = await listAll();
        setNodes(updated);
        setActiveFile('/intro.md');
        setActiveContentState(defaultDocument);
      } else {
        const firstMd = all.find(n => n.type === 'file' && isTextFile(n.name) && n.name.endsWith('.md'));
        if (firstMd) {
          const data = await readFile(firstMd.path);
          if (!cancelled) {
            setActiveFile(firstMd.path);
            setActiveContentState(typeof data === 'string' ? data : '');
          }
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refresh, defaultDocument]);

  const tree = React.useMemo(() => buildTree(nodes), [nodes]);

  // ─── File operations ────────────────────────────────

  const openFile = useCallback(async (path: string) => {
    const norm = normalisePath(path);
    const data = await readFile(norm);
    setActiveFile(norm);
    setActiveContentState(typeof data === 'string' ? data : '');
  }, []);

  const closeFile = useCallback(() => {
    setActiveFile(null);
    setActiveContentState(null);
  }, []);

  // Auto-save with debounce
  const setActiveContent = useCallback(
    (content: string) => {
      setActiveContentState(content);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        if (activeFile) {
          await writeFile(activeFile, content);
          // Don't refresh full list on every keystroke, just update in place
        }
      }, 500);
    },
    [activeFile],
  );

  const addFolder = useCallback(
    async (folderPath: string) => {
      await createFolder(folderPath);
      await refresh();
    },
    [refresh],
  );

  const addFile = useCallback(
    async (filePath: string, content = '') => {
      const name = normalisePath(filePath).split('/').filter(Boolean).pop() || '';
      const mimeType = name.endsWith('.md')
        ? 'text/markdown'
        : name.endsWith('.json')
          ? 'application/json'
          : 'text/plain';
      await writeFile(filePath, content, mimeType);
      await refresh();
    },
    [refresh],
  );

  const uploadFile = useCallback(
    async (targetFolder: string, file: File) => {
      const folder = normalisePath(targetFolder);
      const filePath = folder === '/' ? `/${file.name}` : `${folder}/${file.name}`;

      if (isTextFile(file.name)) {
        const text = await file.text();
        await writeFile(filePath, text, file.type || 'text/plain');
      } else {
        await writeFile(filePath, file, file.type || 'application/octet-stream');
      }
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (path: string) => {
      const norm = normalisePath(path);
      if (activeFile === norm) {
        closeFile();
      }
      await deleteNode(norm);
      await refresh();
    },
    [activeFile, closeFile, refresh],
  );

  const renameFn = useCallback(
    async (oldPath: string, newPath: string) => {
      await renameNode(oldPath, newPath);
      if (activeFile === normalisePath(oldPath)) {
        setActiveFile(normalisePath(newPath));
      }
      await refresh();
    },
    [activeFile, refresh],
  );

  const readFileData = useCallback(async (path: string) => {
    return readFile(path);
  }, []);

  const clearWorkspace = useCallback(async () => {
    setActiveFile(null);
    setActiveContent("");
    await clearAll();
    await refresh();
  }, [refresh]);

  return (
    <VFSContext.Provider
      value={{
        nodes,
        tree,
        activeFile,
        openFile,
        closeFile,
        activeContent,
        setActiveContent,
        addFolder,
        addFile,
        uploadFile,
        remove,
        rename: renameFn,
        readFileData,
        clearWorkspace,
        refresh,
        loading,
      }}
    >
      {children}
    </VFSContext.Provider>
  );
}

export function useVFS() {
  const ctx = useContext(VFSContext);
  if (!ctx) throw new Error('useVFS must be used inside VFSProvider');
  return ctx;
}

/** Returns VFS context if available, or null when outside VFSProvider */
export function useOptionalVFS(): VFSContextValue | null {
  return useContext(VFSContext) ?? null;
}
