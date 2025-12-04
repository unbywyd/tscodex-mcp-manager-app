import * as React from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter, Diagnostic } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { AlertCircle, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidChange?: (valid: boolean, error?: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minHeight?: string;
  showStatus?: boolean;
}

const languageCompartment = new Compartment();

export function JsonEditor({
  value,
  onChange,
  onValidChange,
  placeholder,
  className,
  disabled = false,
  minHeight = '150px',
  showStatus = true,
}: JsonEditorProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const editorRef = React.useRef<EditorView | null>(null);
  const isInternalChange = React.useRef(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isValid, setIsValid] = React.useState(true);

  // Validate JSON and update status
  const validateJson = React.useCallback((text: string) => {
    if (!text.trim()) {
      setError(null);
      setIsValid(true);
      onValidChange?.(true);
      return;
    }
    try {
      JSON.parse(text);
      setError(null);
      setIsValid(true);
      onValidChange?.(true);
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      setIsValid(false);
      onValidChange?.(false, message);
    }
  }, [onValidChange]);

  // Initial validation
  React.useEffect(() => {
    validateJson(value);
  }, []);

  React.useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isInternalChange.current) {
        const newValue = update.state.doc.toString();
        onChange(newValue);
        validateJson(newValue);
      }
    });

    // Custom JSON linter that provides detailed error info
    const jsonLinter = linter((view): Diagnostic[] => {
      const text = view.state.doc.toString();
      if (!text.trim()) return [];

      try {
        JSON.parse(text);
        return [];
      } catch (e) {
        const message = (e as Error).message;
        // Try to extract position from error message
        const posMatch = message.match(/position\s+(\d+)/i);
        const pos = posMatch ? parseInt(posMatch[1], 10) : 0;

        return [{
          from: Math.min(pos, text.length),
          to: Math.min(pos + 1, text.length),
          severity: 'error',
          message: message.replace(/^JSON\.parse:\s*/i, ''),
        }];
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        oneDark,
        languageCompartment.of(json()),
        lintGutter(),
        jsonLinter,
        updateListener,
        EditorView.editable.of(!disabled),
        EditorState.readOnly.of(disabled),
        EditorView.theme({
          '&': {
            backgroundColor: 'var(--bg-secondary)',
            minHeight,
          },
          '.cm-content': {
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            fontSize: '13px',
          },
          '.cm-gutters': {
            backgroundColor: 'var(--bg-tertiary)',
            borderRight: '1px solid var(--border-default)',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'var(--bg-hover)',
          },
          '&.cm-focused': {
            outline: 'none',
          },
          '.cm-lintRange-error': {
            backgroundImage: 'none',
            textDecoration: 'wavy underline #ef4444',
            textDecorationSkipInk: 'none',
          },
          '.cm-lint-marker-error': {
            content: '""',
          },
          '.cm-gutter-lint .cm-lint-marker': {
            width: '0.8em',
            height: '0.8em',
          },
          '.cm-gutter-lint .cm-lint-marker-error': {
            content: '"●"',
            color: '#ef4444',
          },
        }),
        placeholder ? EditorView.contentAttributes.of({ 'data-placeholder': placeholder }) : [],
      ],
    });

    editorRef.current = new EditorView({
      state,
      parent: containerRef.current,
    });

    return () => {
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, []);

  // Update content when value changes externally
  React.useEffect(() => {
    if (editorRef.current && value !== editorRef.current.state.doc.toString()) {
      isInternalChange.current = true;
      editorRef.current.dispatch({
        changes: {
          from: 0,
          to: editorRef.current.state.doc.length,
          insert: value,
        },
      });
      validateJson(value);
      isInternalChange.current = false;
    }
  }, [value, validateJson]);

  return (
    <div className={cn('space-y-1', className)}>
      <div
        ref={containerRef}
        className={cn(
          'border rounded-md overflow-hidden',
          isValid ? 'border-border-default' : 'border-red-500',
          disabled && 'opacity-50'
        )}
      />
      {showStatus && error && (
        <div className="flex items-start gap-1.5 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      )}
    </div>
  );
}
