"use client";

import React, { useEffect, useRef, useCallback, useId, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Box, Paper, useTheme } from "@mui/material";
import type { Components } from "react-markdown";
import mermaid from "mermaid";
import Script from "next/script";
import { useConfig } from "@/lib/context/ConfigContext";

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
  const theme = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;
    const xml = code.trim();
    const config = JSON.stringify({ highlight: theme.palette.primary.main, nav: true, resize: true, xml });
    containerRef.current.innerHTML = "";
    const div = document.createElement("div");
    div.className = "mxgraph";
    div.setAttribute("data-mxgraph", config);
    containerRef.current.appendChild(div);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (typeof w.GraphViewer !== "undefined") {
      w.GraphViewer.processElements();
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

function createMarkdownComponents(): Components {
  return {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const language = match ? match[1] : "";
      const codeString = String(children).replace(/\n$/, "");

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
  img({ src, alt, ...props }) {
    return (
      <Box
        component="img"
        src={src}
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
  content: string;
  previewRef?: React.RefObject<HTMLDivElement | null>;
}

export default function MarkdownPreview({
  content,
  previewRef,
}: MarkdownPreviewProps) {
  const { appConfig } = useConfig();
  const components = useMemo(() => createMarkdownComponents(), []);

  return (
    <>
      <Script
        src={appConfig.drawioViewerUrl}
        strategy="lazyOnload"
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
        {content}
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
