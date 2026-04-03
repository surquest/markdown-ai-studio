"use client";

import React, { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import Editor, { DiffEditor, type OnMount } from "@monaco-editor/react";
import type * as monacoType from "monaco-editor";
import {
  Popper,
  Paper,
  Button,
  ButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Snackbar,
  Alert,
  Fab,
  Tooltip,
  Box,
  Typography,
  IconButton,
} from "@mui/material";
import { AutoFixHigh, SmartToy, Close, Check } from "@mui/icons-material";
import { useVertexAI } from "@/lib/hooks/useVertexAI";
import { useConfig } from "@/lib/context/ConfigContext";

export interface MonacoWrapperHandle {
  scrollToLine: (line: number) => void;
}

interface MonacoWrapperProps {
  value: string;
  onChange: (value: string) => void;
  onDiffChange?: (value: string | null) => void;
  onScroll?: (
    scrollTop: number,
    scrollHeight: number,
    clientHeight: number,
  ) => void;
}

const MonacoWrapper = forwardRef<MonacoWrapperHandle, MonacoWrapperProps>(
  ({ value, onChange, onDiffChange, onScroll }, ref) => {
    const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor | null>(
    null,
  );
  const monacoRef = useRef<typeof monacoType | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [selectedRange, setSelectedRange] = useState<monacoType.Range | null>(
    null,
  );
  const [rewriteDialogOpen, setRewriteDialogOpen] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAiDiff, setPendingAiDiff] = useState<string | null>(null);
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const [debugPayload, setDebugPayload] = useState<{
    type: "generate" | "rewrite";
    prompt: string;
    context?: string;
    systemInstruction: string;
    execute: () => void;
  } | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info";
  }>({
    open: false,
    message: "",
    severity: "success",
  });
  const popperAnchorRef = useRef<HTMLDivElement | null>(null);

  const { generate } = useVertexAI();
  const { aiConfig } = useConfig();

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      editor.onDidChangeCursorSelection((e) => {
        const selection = e.selection;
        const text = editor.getModel()?.getValueInRange(selection) || "";

        if (text.trim().length > 0) {
          setSelectedText(text);
          setSelectedRange(
            new monaco.Range(
              selection.startLineNumber,
              selection.startColumn,
              selection.endLineNumber,
              selection.endColumn,
            ),
          );
          // Position the popper near the selection
          const coords = editor.getScrolledVisiblePosition({
            lineNumber: selection.startLineNumber,
            column: selection.startColumn,
          });
          if (coords && popperAnchorRef.current) {
            const editorDom = editor.getDomNode();
            if (editorDom) {
              const rect = editorDom.getBoundingClientRect();
              popperAnchorRef.current.style.position = "fixed";
              popperAnchorRef.current.style.left = `${rect.left + coords.left}px`;
              popperAnchorRef.current.style.top = `${rect.top + coords.top - 10}px`;
            }
            setAnchorEl(popperAnchorRef.current);
          }
        } else {
          setAnchorEl(null);
          setSelectedText("");
          setSelectedRange(null);
        }
      });

      editor.onDidScrollChange((e) => {
        if (onScroll) {
          const scrollHeight = editor.getScrollHeight();
          const clientHeight = editor.getLayoutInfo().height;
          onScroll(e.scrollTop, scrollHeight, clientHeight);
        }
      });
    },
    [onScroll],
  );

  useImperativeHandle(ref, () => ({
    scrollToLine: (line: number) => {
      if (editorRef.current) {
        editorRef.current.revealLineInCenter(line);
        editorRef.current.setPosition({ lineNumber: line, column: 1 });
        editorRef.current.focus();
      }
    }
  }));

  const executeRewrite = async (
    prompt: string,
    context: string,
    sysInst: string,
  ) => {
    setLoading(true);
    const result = await generate({
      prompt: prompt,
      context: context,
      systemInstruction: sysInst,
    });
    setLoading(false);

    if (result.error) {
      setSnackbar({ open: true, message: result.error, severity: "error" });
      return;
    }

    const editor = editorRef.current;
    if (!editor || !selectedRange) return;
    const model = editor.getModel();

    if (model) {
      const fullValue = model.getValue();
      const startOffset = model.getOffsetAt({
        lineNumber: selectedRange.startLineNumber,
        column: selectedRange.startColumn,
      });
      const endOffset = model.getOffsetAt({
        lineNumber: selectedRange.endLineNumber,
        column: selectedRange.endColumn,
      });

      const newContent =
        fullValue.substring(0, startOffset) +
        result.text +
        fullValue.substring(endOffset);
      setPendingAiDiff(newContent);
    }

    setRewriteDialogOpen(false);
    setRewriteInstruction("");
    setAnchorEl(null);
    setSnackbar({
      open: true,
      message: "Review the changes in Diff Editor",
      severity: "info",
    });
  };

  const handleRewrite = () => {
    if (!editorRef.current || !selectedRange || !rewriteInstruction.trim())
      return;

    const sysInst = `${aiConfig.systemInstruction}\n\nCRITICAL: You are currently acting as a rewrite assistant. \nThe user wants you to rewrite the specific text provided in the "Context" based on the "Request".\nReturn ONLY the rewritten text. Do NOT include any accompanying narration, explanation, or the original full context. Output NOTHING but the new markdown.`;

    if (aiConfig.debugMode) {
      setDebugPayload({
        type: "rewrite",
        prompt: rewriteInstruction,
        context: selectedText,
        systemInstruction: sysInst,
        execute: () => {
          setDebugModalOpen(false);
          executeRewrite(rewriteInstruction, selectedText, sysInst);
        },
      });
      setDebugModalOpen(true);
    } else {
      executeRewrite(rewriteInstruction, selectedText, sysInst);
    }
  };

  const executeGenerate = async (
    prompt: string,
    sysInst: string,
    editorPos: monacoType.Position,
  ) => {
    setLoading(true);
    const result = await generate({
      prompt,
      systemInstruction: sysInst,
    });
    setLoading(false);

    if (result.error) {
      setSnackbar({ open: true, message: result.error, severity: "error" });
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();

    if (editorPos && model) {
      const fullValue = model.getValue();
      const offset = model.getOffsetAt(editorPos);
      const newContent =
        fullValue.substring(0, offset) +
        result.text +
        fullValue.substring(offset);
      setPendingAiDiff(newContent);
    }

    setGenerateDialogOpen(false);
    setGeneratePrompt("");
    setSnackbar({
      open: true,
      message: "Review the generated content in Diff Editor",
      severity: "info",
    });
  };

  const handleGenerate = () => {
    if (!editorRef.current || !generatePrompt.trim()) return;

    const editor = editorRef.current;
    const position = editor.getPosition();
    const fullContent = editor.getValue();
    if (!position) return;

    const sysInst = `${aiConfig.systemInstruction}\n\nCRITICAL: You are currently acting as an inline text generator inside a markdown document. \nBelow is the existing markdown document content for context.\nYou must return ONLY the newly generated text that satisfies the user "Request" to be inserted exactly at the cursor position.\nDo NOT repeat the existing markdown content back to the user. Do NOT include any accompanying narration, explanation, or greetings. Output NOTHING but the newly generated text.\n\n--- CURRENT DOCUMENT CONTEXT ---\n${fullContent}\n--------------------------------`;

    if (aiConfig.debugMode) {
      setDebugPayload({
        type: "generate",
        prompt: generatePrompt,
        systemInstruction: sysInst,
        execute: () => {
          setDebugModalOpen(false);
          executeGenerate(generatePrompt, sysInst, position);
        },
      });
      setDebugModalOpen(true);
    } else {
      executeGenerate(generatePrompt, sysInst, position);
    }
  };

  // Clean up the popper when editor loses focus
  useEffect(() => {
    const handleClickOutside = () => {
      // Small delay to allow button clicks to register
      setTimeout(() => {
        if (!rewriteDialogOpen) {
          setAnchorEl(null);
        }
      }, 200);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [rewriteDialogOpen]);

useEffect(() => {
      onDiffChange?.(pendingAiDiff);
    }, [pendingAiDiff, onDiffChange]);

    const handleAcceptDiff = () => {
    if (pendingAiDiff !== null) {
      onChange(pendingAiDiff);
      setPendingAiDiff(null);
    }
  };

  const handleRejectDiff = () => {
    setPendingAiDiff(null);
  };

  return (
    <>
      <div
        ref={popperAnchorRef}
        style={{
          position: "fixed",
          width: 1,
          height: 1,
          pointerEvents: "none",
        }}
      />

      {/* Diff View */}
      {pendingAiDiff !== null && (
          <Box sx={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
              <DiffEditor
                language="markdown"
                original={value}
                modified={pendingAiDiff}
                theme="vs-light"
                options={{
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  wordWrap: "on",
                  originalEditable: false,
                  readOnly: false,
                  fontSize: 14,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 16 },
                }}
              />
            </Box>
            <Box
              sx={{
                position: "absolute",
                bottom: 24,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 1400,
                p: 1,
                bgcolor: "background.paper",
                borderRadius: "50px",
                boxShadow: 3,
                display: "flex",
                gap: 1,
              }}
            >
              <Tooltip title="Rollback">
                <IconButton 
                  onClick={handleRejectDiff}
                >
                  <Close />
                </IconButton>
              </Tooltip>
              <Tooltip title="Confirm Changes">
                <IconButton 
                  onClick={handleAcceptDiff}
                  variant="contained"
                  color="primary"
                >
                  <Check />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
      )}

      {/* Main Editor (hidden when Diff is active to preserve state) */}
      <Box
        sx={{
          display: pendingAiDiff === null ? "block" : "none",
          height: "100%",
        }}
      >
        <Editor
          height="100%"
          defaultLanguage="markdown"
          value={value}
          onChange={(val) => onChange(val || "")}
          onMount={handleEditorMount}
          theme="vs-light"
          options={{
            minimap: { enabled: false },
            wordWrap: "on",
            fontSize: 14,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            padding: { top: 16 },
          }}
        />
      </Box>

      {/* Floating Popper on selection */}
      {pendingAiDiff === null && (
        <Popper
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          placement="top-start"
          sx={{ zIndex: 1300 }}
        >
          <Paper elevation={3} sx={{ p: 0.5 }}>
            <ButtonGroup size="small" variant="outlined">
              <Button
                startIcon={<AutoFixHigh />}
                onClick={(e) => {
                  e.stopPropagation();
                  setRewriteDialogOpen(true);
                }}
              >
                Rewrite
              </Button>
            </ButtonGroup>
          </Paper>
        </Popper>
      )}

      {/* Generate FAB */}
      {pendingAiDiff === null && (
        <Tooltip title="Generate with AI" placement="left">
          <Fab
            color="primary"
            size="medium"
            onClick={() => setGenerateDialogOpen(true)}
            sx={{ position: "absolute", bottom: 24, right: 24, zIndex: 1200 }}
          >
            <SmartToy />
          </Fab>
        </Tooltip>
      )}

      {/* Rewrite Dialog */}
      <Dialog
        open={rewriteDialogOpen}
        onClose={() => setRewriteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Rewrite Selected Text</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={2}
            label="Instructions"
            placeholder="e.g., Make it more concise, Fix grammar, Translate to Spanish..."
            value={rewriteInstruction}
            onChange={(e) => setRewriteInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === "Enter") {
                if (!loading && rewriteInstruction.trim()) {
                  handleRewrite();
                }
              }
            }}
            sx={{ mt: 1 }}
            disabled={loading}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRewriteDialogOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRewrite}
            variant="contained"
            disabled={loading || !rewriteInstruction.trim()}
          >
            {loading ? <CircularProgress size={20} /> : "Rewrite"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generate Dialog */}
      <Dialog
        open={generateDialogOpen}
        onClose={() => setGenerateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Generate Content</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label="Prompt"
            placeholder="e.g., Write an introduction about..., Add a table comparing..., Create a mermaid diagram..."
            value={generatePrompt}
            onChange={(e) => setGeneratePrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === "Enter") {
                if (!loading && generatePrompt.trim()) {
                  handleGenerate();
                }
              }
            }}
            sx={{ mt: 1 }}
            disabled={loading}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setGenerateDialogOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            variant="contained"
            disabled={loading || !generatePrompt.trim()}
          >
            {loading ? <CircularProgress size={20} /> : "Generate"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Debug Modal */}
      <Dialog
        open={debugModalOpen}
        onClose={() => setDebugModalOpen(false)}
        maxWidth="md"
        fullWidth
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key === "Enter") {
            if (debugModalOpen && debugPayload?.execute) {
              debugPayload.execute();
            }
          }
        }}
      >
        <DialogTitle>Debug: AI Request Payload</DialogTitle>
        <DialogContent dividers>
          {debugPayload && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" color="primary">
                  Model Settings:
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                  Model: {aiConfig.modelId} | Thinking: {aiConfig.thinkingLevel}{" "}
                  | Temp: {aiConfig.temperature.toFixed(1)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="primary">
                  Prompt:
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    p: 1,
                    bgcolor: "#f5f5f5",
                    borderRadius: 1,
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    fontSize: "0.8rem",
                  }}
                >
                  {debugPayload.prompt}
                </Box>
              </Box>
              {debugPayload.context && (
                <Box>
                  <Typography variant="subtitle2" color="primary">
                    Context (Selected Text):
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      p: 1,
                      bgcolor: "#f5f5f5",
                      borderRadius: 1,
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                      fontSize: "0.8rem",
                    }}
                  >
                    {debugPayload.context}
                  </Box>
                </Box>
              )}
              <Box>
                <Typography variant="subtitle2" color="primary">
                  System Instruction:
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    p: 1,
                    bgcolor: "#f5f5f5",
                    borderRadius: 1,
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    fontSize: "0.8rem",
                    maxHeight: 200,
                  }}
                >
                  {debugPayload.systemInstruction}
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDebugModalOpen(false)} color="error">
            Cancel Request
          </Button>
          <Button
            onClick={() => debugPayload?.execute()}
            variant="contained"
            color="warning"
          >
            Proceed with Execution
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
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
    </>
  );
});

MonacoWrapper.displayName = "MonacoWrapper";

export default MonacoWrapper;
