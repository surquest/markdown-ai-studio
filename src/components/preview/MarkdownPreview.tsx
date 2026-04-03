"use client";

import React, { useEffect, useRef, useCallback, useId, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Box, Paper, Typography, useTheme } from "@mui/material";
import type { Components } from "react-markdown";
import mermaid from "mermaid";
import Script from "next/script";
import { useConfig } from "@/lib/context/ConfigContext";
import { useOptionalVFS } from "@/lib/context/VFSContext";
import { normalisePath } from "@/lib/vfs/vfs-db";

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
});

function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/:/g, "_");
  const theme = useTheme();

  useEffect(() => {
    let cancelled = false;

    const renderDiagram = async () => {
      if (!containerRef.current) return;
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: theme.palette.mode === 'dark' ? 'dark' : 'default',
          securityLevel: "loose",
        });
        const { svg } = await mermaid.render(`mermaid_${uniqueId}`, code);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = `<pre style="color: red;">Mermaid diagram error</pre>`;
        }
      }
    };

    renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [code, uniqueId]);

  return (
    <Box
      ref={containerRef}
      sx={{
        my: 2,
        display: "flex",
        justifyContent: "center",
        "& svg": { maxWidth: "100%" },
      }}
    />
  );
}

function DrawioBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const xml = code.trim();
    if (!xml) return;

    const config = JSON.stringify({ highlight: "#006EAF", nav: true, resize: true, xml });
    container.innerHTML = "";
    const div = document.createElement("div");
    div.className = "mxgraph";
    div.setAttribute("data-mxgraph", config);
    container.appendChild(div);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;

    const processElements = () => {
      if (typeof w.GraphViewer !== "undefined") {
        // GraphViewer.processElements re-scans, but only un-processed elements
        w.GraphViewer.processElements();
      }
    };

    if (typeof w.GraphViewer !== "undefined") {
      processElements();
    } else {
      // Script may not have loaded yet – poll until it's available
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (typeof w.GraphViewer !== "undefined") {
          clearInterval(interval);
          processElements();
        } else if (attempts > 100) {
          // ~10 s timeout
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [code]);

  return (
    <Box
      ref={containerRef}
      sx={{
        my: 2,
        width: "100%",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        overflow: "auto",
        "& .mxgraph": { maxWidth: "100%" },
      }}
    />
  );
}

function CodeSnippetBlock({ srcStr, content, overrideLang }: { srcStr: string, content: string, overrideLang?: string }) {
  const lang = overrideLang || getLanguageFromPath(srcStr) || '';
  const fileName = srcStr.split('/').pop() || srcStr;
  
  return (
    <Box sx={{ my: 2 }}>
      <Box sx={{
        bgcolor: 'action.hover',
        px: 2,
        py: 0.5,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        borderBottom: 'none',
        fontSize: '0.75rem',
        fontFamily: '"Fira Code", "Consolas", monospace',
        color: 'text.secondary',
      }}>
        {fileName}
      </Box>
      <Box
        component="pre"
        sx={{
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          p: 2,
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
          overflow: 'auto',
          fontSize: '0.875rem',
          fontFamily: '"Fira Code", "Consolas", monospace',
          m: 0,
        }}
      >
        <code className={lang ? `language-${lang}` : undefined}>{content}</code>
      </Box>
    </Box>
  );
}

// ─── VFS file resolver hook ──────────────────────────

/** Map from file extension to Monaco/code-block language id */
const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
  rb: 'ruby', php: 'php', swift: 'swift', sh: 'shell', bash: 'shell',
  yml: 'yaml', yaml: 'yaml', json: 'json', xml: 'xml', html: 'html',
  css: 'css', scss: 'scss', sql: 'sql', md: 'markdown', toml: 'toml',
  ini: 'ini', dockerfile: 'dockerfile', makefile: 'makefile',
  r: 'r', lua: 'lua', dart: 'dart', zig: 'zig', ex: 'elixir',
};

function getLanguageFromPath(path: string): string | undefined {
  const ext = path.split('.').pop()?.toLowerCase();
  return ext ? EXT_TO_LANGUAGE[ext] : undefined;
}

function isDrawioFile(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith('.drawio') || lower.endsWith('.drawio.xml');
}

function isCodeFile(path: string): boolean {
  return getLanguageFromPath(path) !== undefined;
}

function isImageFile(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext);
}

interface ResolvedFiles {
  imageUrls: Map<string, string>;
  textContents: Map<string, string>;
}

function useVFSFileResolver(
  markdown: string,
  activeFile: string | null,
  readFileData?: (path: string) => Promise<string | Blob | undefined>,
): ResolvedFiles {
  const [resolved, setResolved] = useState<ResolvedFiles>({ imageUrls: new Map(), textContents: new Map() });
  const revokeListRef = useRef<string[]>([]);

  useEffect(() => {
    if (!readFileData) return;

    const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const htmlImgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    const mkdocsSnippetRegex = /--8<--\s*(["'])(.+?)\1/g;
    
    const refs: string[] = [];
    let match: RegExpExecArray | null;
    
    while ((match = mdImgRegex.exec(markdown)) !== null) {
      const src = match[2];
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        refs.push(src);
      }
    }
    while ((match = htmlImgRegex.exec(markdown)) !== null) {
      const src = match[1];
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        refs.push(src);
      }
    }
    while ((match = mkdocsSnippetRegex.exec(markdown)) !== null) {
      const src = match[2];
      if (src && !src.startsWith('http')) {
        refs.push(src);
      }
    }

    if (refs.length === 0) {
      // Clear any previously resolved
      if (revokeListRef.current.length > 0) {
        for (const url of revokeListRef.current) URL.revokeObjectURL(url);
        revokeListRef.current = [];
        setResolved({ imageUrls: new Map(), textContents: new Map() });
      }
      return;
    }

    let cancelled = false;

    (async () => {
      const newImageUrls = new Map<string, string>();
      const newTextContents = new Map<string, string>();
      const toRevoke: string[] = [];

      for (const ref of refs) {
        let resolvedPath: string;
        if (ref.startsWith('/')) {
          resolvedPath = normalisePath(ref);
        } else if (activeFile) {
          const dir = activeFile.split('/').slice(0, -1).join('/') || '/';
          resolvedPath = normalisePath(dir + '/' + ref);
        } else {
          resolvedPath = normalisePath('/' + ref);
        }

        try {
          const data = await readFileData(resolvedPath);
          if (cancelled) return;

          // Draw.io or code files → store as text
          if (isDrawioFile(ref) || isCodeFile(ref)) {
            if (typeof data === 'string') {
              newTextContents.set(ref, data);
            } else if (data instanceof Blob) {
              newTextContents.set(ref, await data.text());
            }
          } else {
            // Image files → create blob URLs
            if (data instanceof Blob) {
              const url = URL.createObjectURL(data);
              newImageUrls.set(ref, url);
              toRevoke.push(url);
            } else if (typeof data === 'string') {
              const blob = new Blob([data], { type: 'image/svg+xml' });
              const url = URL.createObjectURL(blob);
              newImageUrls.set(ref, url);
              toRevoke.push(url);
            }
          }
        } catch {
          // File not found in VFS
        }
      }

      if (!cancelled) {
        for (const url of revokeListRef.current) URL.revokeObjectURL(url);
        revokeListRef.current = toRevoke;
        setResolved({ imageUrls: newImageUrls, textContents: newTextContents });
      }
    })();

    return () => { cancelled = true; };
  }, [markdown, activeFile, readFileData]);

  useEffect(() => {
    return () => {
      for (const url of revokeListRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  return resolved;
}

function createMarkdownComponents(resolvedFiles?: ResolvedFiles): Components {
  return {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const language = match ? match[1] : "";
      const codeString = String(children).replace(/\n$/, "");

      const snippetMatch = /^--8<--\s*(["'])(.+?)\1$/.exec(codeString.trim());
      if (snippetMatch && !codeString.includes('\n')) {
         const srcStr = snippetMatch[2];
         const content = resolvedFiles?.textContents.get(srcStr);
         if (content) {
            return <CodeSnippetBlock srcStr={srcStr} content={content} overrideLang={language} />;
         }
      }

      if (language === "mermaid") {
        return <MermaidBlock code={codeString} />;
      }

      if (language === "drawio") {
        return <DrawioBlock code={codeString} />;
      }

    if (language) {
      return (
        <Box
          component="pre"
          sx={{
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            p: 2,
            borderRadius: 1,
            overflow: "auto",
            fontSize: "0.875rem",
            fontFamily: '"Fira Code", "Consolas", monospace',
          }}
        >
          <code className={className} {...props}>
            {children}
          </code>
        </Box>
      );
    }

    return (
      <Box
        component="code"
        sx={{
          bgcolor: "action.selected",
          px: 0.75,
          py: 0.25,
          borderRadius: 0.5,
          fontSize: "0.875em",
          fontFamily: '"Fira Code", "Consolas", monospace',
        }}
        {...props}
      >
        {children}
      </Box>
    );
  },
  table({ children }) {
    return (
      <Box sx={{ overflowX: "auto", my: 2 }}>
        <Box
          component="table"
          sx={{
            borderCollapse: "collapse",
            width: "100%",
            "& th, & td": {
              border: "1px solid",
              borderColor: "divider",
              p: 1,
              textAlign: "left",
            },
            "& th": {
              bgcolor: "action.hover",
              fontWeight: 600,
            },
            "& tr:nth-of-type(even)": {
              bgcolor: "action.selected",
            },
          }}
        >
          {children}
        </Box>
      </Box>
    );
  },
  p({ children }) {
    const childArr = React.Children.toArray(children);

    // Check for MkDocs snippet macro
    if (childArr.length === 1 && typeof childArr[0] === "string") {
      const str = (childArr[0] as string).trim();
      const snippetMatch = /^--8<--\s*(["'])(.+?)\1$/.exec(str);
      if (snippetMatch) {
         const srcStr = snippetMatch[2];
         const content = resolvedFiles?.textContents.get(srcStr);
         if (content) {
            return <CodeSnippetBlock srcStr={srcStr} content={content} />;
         }
         return <Box component="span" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>Snippet file not found: {srcStr}</Box>;
      }
    }

    // Detect if children include an img element that will render as a block
    // (drawio diagram or code file embed). In react-markdown v10, node prop
    // is not available, so we check the src prop directly.
    const hasBlockChild = childArr.some((child) => {
      if (!React.isValidElement(child)) return false;
      const src = (child.props as Record<string, unknown>).src;
      if (typeof src === 'string') {
        return isDrawioFile(src) || (isCodeFile(src) && !isImageFile(src));
      }
      return false;
    });
    if (hasBlockChild) {
      return <Box sx={{ my: 2 }}>{children}</Box>;
    }
    return <Typography sx={{ mb: 2, lineHeight: 1.6, "&:last-child": { mb: 0 } }}>{children}</Typography>;
  },
  img({ src, alt, ...props }) {
    const srcStr = typeof src === 'string' ? src : undefined;

    // Draw.io file from VFS
    if (srcStr && isDrawioFile(srcStr)) {
      const content = resolvedFiles?.textContents.get(srcStr);
      if (content) return <DrawioBlock code={content} />;
      return <Box component="span" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>Draw.io file not found: {srcStr}</Box>;
    }

    // Code file from VFS
    if (srcStr && isCodeFile(srcStr) && !isImageFile(srcStr)) {
      const content = resolvedFiles?.textContents.get(srcStr);
      if (content) {
        return <CodeSnippetBlock srcStr={srcStr} content={content} />;
      }
      return <Box component="span" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>Code file not found: {srcStr}</Box>;
    }

    // Regular image
    const resolved = srcStr && resolvedFiles ? resolvedFiles.imageUrls.get(srcStr) : undefined;
    return (
      <Box
        component="img"
        src={resolved || srcStr || src}
        alt={alt || ""}
        sx={{ maxWidth: "100%", height: "auto", borderRadius: 1 }}
        {...props}
      />
    );
  },
  blockquote({ children }) {
    return (
      <Box
        component="blockquote"
        sx={{
          borderLeft: "4px solid",
          borderColor: "primary.main",
          pl: 2,
          ml: 0,
          my: 2,
          color: "text.secondary",
          fontStyle: "italic",
        }}
      >
        {children}
      </Box>
    );
  },
  };
}

interface MarkdownPreviewProps {
  /** Markdown content. When omitted, reads from VFS context. */
  content?: string;
  previewRef?: React.RefObject<HTMLDivElement | null>;
}

export default function MarkdownPreview({
  content: contentProp,
  previewRef,
}: MarkdownPreviewProps) {
  const { appConfig } = useConfig();

  // VFS integration: use VFS context when content is not provided
  const vfs = useOptionalVFS();
  const isVFSMode = contentProp === undefined;
  const effectiveContent = isVFSMode ? (vfs?.activeContent ?? '') : contentProp;

  // VFS file resolution (images, drawio, code files)
  const vfsActiveFile = isVFSMode ? (vfs?.activeFile ?? null) : null;
  const resolvedFiles = useVFSFileResolver(
    effectiveContent,
    vfsActiveFile,
    vfs?.readFileData,
  );

  const hasResolved = resolvedFiles.imageUrls.size > 0 || resolvedFiles.textContents.size > 0;
  const components = useMemo(
    () => createMarkdownComponents(hasResolved ? resolvedFiles : undefined),
    [resolvedFiles, hasResolved],
  );

  const [directFileUrl, setDirectFileUrl] = useState<string | null>(null);

  // When a non-markdown image/drawio file is selected directly, load it.
  useEffect(() => {
    if (!isVFSMode || !vfs?.activeFile || vfs.activeFile.endsWith('.md') || vfs.activeFile.endsWith('.markdown')) {
      setDirectFileUrl(null);
      return;
    }
    
    let cancelled = false;
    if (isImageFile(vfs.activeFile)) {
      vfs.readFileData(vfs.activeFile).then(data => {
        if (cancelled) return;
        if (data instanceof Blob) {
          setDirectFileUrl(URL.createObjectURL(data));
        } else if (typeof data === 'string') {
          const blob = new Blob([data], { type: 'image/svg+xml' });
          setDirectFileUrl(URL.createObjectURL(blob));
        }
      });
    }
    return () => {
      cancelled = true;
      if (directFileUrl) URL.revokeObjectURL(directFileUrl);
    };
  }, [isVFSMode, vfs?.activeFile, vfs?.readFileData]);

  // In VFS mode, handle non-markdown files
  if (isVFSMode && vfs?.activeFile) {
    const file = vfs.activeFile;
    const isMarkdown = file.endsWith('.md') || file.endsWith('.markdown');
    
    if (!isMarkdown) {
      const isImg = isImageFile(file);
      const isDrawio = isDrawioFile(file);
      
      // If it's a drawio file, we DO NOT exit early anymore since we want it 
      // rendering in the standard markdown preview block alongside XML Editor
      if (!isImg && !isDrawio) return null;

      // Drawio rendering wrapper when a diagram is opened directly
      if (isDrawio) {
        return (
          <>
            <Script src={appConfig.drawioViewerUrl} strategy="afterInteractive" />
            <Paper
              ref={previewRef}
              elevation={0}
              sx={{ height: "100%", overflow: "auto", p: 3, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}
            >
              <DrawioBlock code={vfs.activeContent ?? ''} />
            </Paper>
          </>
        );
      }

      // Standalone Image Views
      return (
        <Paper
          ref={previewRef}
          elevation={0}
          sx={{ height: "100%", overflow: "auto", p: 3, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}
        >
          {directFileUrl ? (
            <Box 
              component="img" 
              src={directFileUrl} 
              sx={{ maxWidth: '100%', height: 'auto' }} 
            />
          ) : null}
        </Paper>
      );
    }
  }

  return (
    <>
      <Script
        src={appConfig.drawioViewerUrl}
        strategy="afterInteractive"
      />
      <Paper
      ref={previewRef}
      elevation={0}
      sx={{
        height: "100%",
        overflow: "auto",
        p: 3,
        "& h1": {
          fontSize: "2rem",
          fontWeight: 700,
          mt: 3,
          mb: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          pb: 1,
        },
        "& h2": { fontSize: "1.5rem", fontWeight: 600, mt: 2.5, mb: 1 },
        "& h3": { fontSize: "1.25rem", fontWeight: 600, mt: 2, mb: 0.75 },
        "& h4": { fontSize: "1.1rem", fontWeight: 600, mt: 1.5, mb: 0.5 },
        "& h5": { fontSize: "1rem", fontWeight: 600, mt: 1.5, mb: 0.5 },
        "& h6": { fontSize: "0.875rem", fontWeight: 600, mt: 1.5, mb: 0.5 },
        "& p": { lineHeight: 1.7, mb: 1.5 },
        "& ul, & ol": { pl: 3, mb: 1.5 },
        "& li": { lineHeight: 1.7, mb: 0.5 },
        "& a": {
          color: "primary.main",
          textDecoration: "none",
          "&:hover": { textDecoration: "underline" },
        },
        "& hr": { border: "none", borderTop: "1px solid", borderColor: "divider", my: 3 },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {effectiveContent}
      </ReactMarkdown>
    </Paper>
    </>
  );
}

// Outline Sidebar component
interface OutlineItem {
  level: number;
  text: string;
  id: string;
  line: number;
}

export function parseOutline(markdown: string): OutlineItem[] {
  const lines = markdown.split(/\r?\n/);
  const outline: OutlineItem[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    const match = /^[ \t]{0,3}(#{1,6})\s+(.+)$/.exec(line);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/[#*_`\[\]]/g, "").trim();
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
      outline.push({ level, text, id, line: i + 1 });
    }
  }

  return outline;
}

interface OutlineSidebarProps {
  markdown: string;
  previewRef: React.RefObject<HTMLDivElement | null>;
  onItemClick?: (line: number) => void;
}

export function OutlineSidebar({ markdown, previewRef, onItemClick }: OutlineSidebarProps) {
  const outline = parseOutline(markdown);

  const handleClick = useCallback(
    (id: string, line: number) => {
      // Find heading elements in the preview
      if (previewRef.current) {
        const headings = previewRef.current.querySelectorAll(
          "h1, h2, h3, h4, h5, h6",
        );
        for (const heading of headings) {
          const headingId = heading.textContent
            ?.trim()
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-");
          if (headingId === id) {
            heading.scrollIntoView({ behavior: "smooth", block: "start" });
            break;
          }
        }
      }
      
      // Let parent know to scroll the editor
      if (onItemClick) {
        onItemClick(line);
      }
    },
    [previewRef],
  );

  return (
    <Box
      sx={{
        p: 1.5,
        overflow: "auto",
        borderLeft: "1px solid",
        borderColor: "divider",
        minWidth: 200,
        maxWidth: 260,
        fontSize: "0.8rem",
      }}
    >
      <Box
        sx={{
          fontWeight: 600,
          mb: 1,
          fontSize: "0.75rem",
          textTransform: "uppercase",
          color: "text.secondary",
        }}
      >
        Outline
      </Box>
      {outline.length === 0 ? (
        <Box
          sx={{
            color: "text.disabled",
            fontSize: "0.75rem",
            fontStyle: "italic",
          }}
        >
          No headings found
        </Box>
      ) : (
        outline.map((item, i) => (
          <Box
            key={`${item.id}-${i}`}
            onClick={() => handleClick(item.id, item.line)}
            sx={{
              pl: (item.level - 1) * 1.5,
              py: 0.4,
              cursor: "pointer",
              borderRadius: 0.5,
              color: "text.primary",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              "&:hover": {
                bgcolor: "action.hover",
                color: "primary.main",
              },
            }}
          >
            {item.text}
          </Box>
        ))
      )}
    </Box>
  );
}
