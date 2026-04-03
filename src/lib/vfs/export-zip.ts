import JSZip from 'jszip';
import { listAll, readFile, type VFSNode } from '@/lib/vfs/vfs-db';

/**
 * Builds a ZIP archive from the entire VFS and triggers a browser download.
 */
export async function exportWorkspaceAsZip(zipName = 'workspace.zip'): Promise<void> {
  const zip = new JSZip();
  const allNodes = await listAll();

  // Sort so files come in a nice order
  const files = allNodes.filter((n: VFSNode) => n.type === 'file');

  for (const file of files) {
    const data = await readFile(file.path);
    // Strip leading "/" for zip paths
    const zipPath = file.path.startsWith('/') ? file.path.slice(1) : file.path;

    if (data instanceof Blob) {
      zip.file(zipPath, data);
    } else if (typeof data === 'string') {
      zip.file(zipPath, data);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(url);
}
