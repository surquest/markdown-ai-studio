import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'markdown-ai-studio-vfs';
const DB_VERSION = 1;
const META_STORE = 'metadata';
const DATA_STORE = 'filedata';

export type VFSNodeType = 'file' | 'folder';

export interface VFSNode {
  /** Absolute path within the VFS, e.g. "/docs/readme.md" or "/images/" */
  path: string;
  name: string;
  type: VFSNodeType;
  /** MIME type for files, undefined for folders */
  mimeType?: string;
  /** Size in bytes for files */
  size?: number;
  createdAt: number;
  updatedAt: number;
}

/** Open (or create) the IndexedDB database */
function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'path' });
      }
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE);
      }
    },
  });
}

// ─── Helpers ──────────────────────────────────────────

/** Normalise a path: always leading /, no trailing / for files */
export function normalisePath(p: string): string {
  let out = p.replace(/\\/g, '/');
  if (!out.startsWith('/')) out = '/' + out;
  // collapse double /
  out = out.replace(/\/+/g, '/');
  // resolve . and .. segments
  const parts = out.split('/');
  const resolved: string[] = [];
  for (const seg of parts) {
    if (seg === '.') continue;
    if (seg === '..') { resolved.pop(); continue; }
    resolved.push(seg);
  }
  out = resolved.join('/') || '/';
  return out;
}

/** Return the parent folder path for a given path */
export function parentPath(p: string): string {
  const norm = normalisePath(p);
  if (norm === '/') return '/';
  const parts = norm.split('/').filter(Boolean);
  parts.pop();
  return parts.length === 0 ? '/' : '/' + parts.join('/');
}

/** Determine if a file is text-editable based on extension */
export function isTextFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const textExts = new Set([
    'md', 'markdown', 'txt', 'js', 'jsx', 'ts', 'tsx', 'json', 'yaml', 'yml',
    'xml', 'html', 'htm', 'css', 'scss', 'less', 'py', 'rb', 'java', 'c',
    'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'sh', 'bash', 'zsh', 'bat', 'ps1',
    'sql', 'graphql', 'toml', 'ini', 'cfg', 'env', 'csv', 'tsv', 'log',
    'svg', 'dockerfile', 'makefile', 'gitignore', 'editorconfig', 'drawio',
  ]);
  return textExts.has(ext) || name.startsWith('.');
}

/** Get Monaco language from file extension */
export function getMonacoLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    md: 'markdown', markdown: 'markdown', txt: 'plaintext',
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    json: 'json', yaml: 'yaml', yml: 'yaml', xml: 'xml',
    html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
    py: 'python', rb: 'ruby', java: 'java', c: 'c', cpp: 'cpp',
    cs: 'csharp', go: 'go', rs: 'rust', sh: 'shell', bash: 'shell',
    sql: 'sql', graphql: 'graphql', toml: 'ini', ini: 'ini',
    svg: 'xml', dockerfile: 'dockerfile', drawio: 'xml',
  };
  return map[ext] || 'plaintext';
}

// ─── CRUD Operations ──────────────────────────────────

/** Ensure all ancestor folders exist for a given path */
async function ensureAncestors(db: IDBPDatabase, filePath: string): Promise<void> {
  const parts = normalisePath(filePath).split('/').filter(Boolean);
  // All parts except the last one are ancestor folders
  for (let i = 1; i <= parts.length - 1; i++) {
    const folderPath = '/' + parts.slice(0, i).join('/');
    const existing = await db.get(META_STORE, folderPath);
    if (!existing) {
      const node: VFSNode = {
        path: folderPath,
        name: parts[i - 1],
        type: 'folder',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.put(META_STORE, node);
    }
  }
}

/** Create or update a folder */
export async function createFolder(folderPath: string): Promise<VFSNode> {
  const db = await getDB();
  const norm = normalisePath(folderPath);
  await ensureAncestors(db, norm + '/_');

  const existing = await db.get(META_STORE, norm);
  if (existing) return existing as VFSNode;

  const node: VFSNode = {
    path: norm,
    name: norm.split('/').filter(Boolean).pop() || '',
    type: 'folder',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.put(META_STORE, node);
  return node;
}

/** Write a file (text content as string, binary as Blob) */
export async function writeFile(
  filePath: string,
  data: string | Blob,
  mimeType?: string,
): Promise<VFSNode> {
  const db = await getDB();
  const norm = normalisePath(filePath);

  await ensureAncestors(db, norm);

  const size = typeof data === 'string' ? new Blob([data]).size : data.size;
  const now = Date.now();
  const existing = await db.get(META_STORE, norm) as VFSNode | undefined;

  const node: VFSNode = {
    path: norm,
    name: norm.split('/').filter(Boolean).pop() || '',
    type: 'file',
    mimeType: mimeType || existing?.mimeType || 'application/octet-stream',
    size,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite');
  await tx.objectStore(META_STORE).put(node);
  await tx.objectStore(DATA_STORE).put(data, norm);
  await tx.done;

  return node;
}

/** Read file data — returns string for text, Blob for binary */
export async function readFile(filePath: string): Promise<string | Blob | undefined> {
  const db = await getDB();
  return db.get(DATA_STORE, normalisePath(filePath));
}

/** Get metadata for a path */
export async function getNode(path: string): Promise<VFSNode | undefined> {
  const db = await getDB();
  return db.get(META_STORE, normalisePath(path)) as Promise<VFSNode | undefined>;
}

/** List direct children of a folder */
export async function listChildren(folderPath: string): Promise<VFSNode[]> {
  const db = await getDB();
  const norm = normalisePath(folderPath);
  const all = await db.getAll(META_STORE) as VFSNode[];

  return all.filter((n) => {
    if (n.path === norm) return false;
    return parentPath(n.path) === norm;
  });
}

/** Get all nodes in the VFS */
export async function listAll(): Promise<VFSNode[]> {
  const db = await getDB();
  return db.getAll(META_STORE) as Promise<VFSNode[]>;
}

/** Delete a node and its data. For folders, recursively deletes children. */
export async function deleteNode(path: string): Promise<void> {
  const db = await getDB();
  const norm = normalisePath(path);
  const all = await db.getAll(META_STORE) as VFSNode[];

  // Collect paths to delete: the node itself + any children (if folder)
  const toDelete = all
    .filter((n) => n.path === norm || n.path.startsWith(norm + '/'))
    .map((n) => n.path);

  const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite');
  for (const p of toDelete) {
    tx.objectStore(META_STORE).delete(p);
    tx.objectStore(DATA_STORE).delete(p);
  }
  await tx.done;
}

/** Rename / move a node (and children for folders) */
export async function renameNode(oldPath: string, newPath: string): Promise<void> {
  const db = await getDB();
  const normOld = normalisePath(oldPath);
  const normNew = normalisePath(newPath);
  const all = await db.getAll(META_STORE) as VFSNode[];

  // All affected nodes
  const affected = all.filter(
    (n) => n.path === normOld || n.path.startsWith(normOld + '/'),
  );

  const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite');
  for (const node of affected) {
    const newNodePath = normNew + node.path.slice(normOld.length);
    // Read old data
    const data = await tx.objectStore(DATA_STORE).get(node.path);

    // Delete old entries
    tx.objectStore(META_STORE).delete(node.path);
    tx.objectStore(DATA_STORE).delete(node.path);

    // Write new entries
    const updated: VFSNode = {
      ...node,
      path: newNodePath,
      name: newNodePath.split('/').filter(Boolean).pop() || '',
      updatedAt: Date.now(),
    };
    tx.objectStore(META_STORE).put(updated);
    if (data !== undefined) {
      tx.objectStore(DATA_STORE).put(data, newNodePath);
    }
  }

  // Ensure ancestors exist for new path
  await tx.done;
  await ensureAncestors(await getDB(), normNew);
}

/** Clear all data and metadata from the database completely */
export async function clearAll(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite');
  await tx.objectStore(META_STORE).clear();
  await tx.objectStore(DATA_STORE).clear();
  await tx.done;
}
