import * as React from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { cn } from '../../lib/utils';

type CodeLanguage = 'json' | 'javascript' | 'typescript' | 'html' | 'markdown' | 'text';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: CodeLanguage;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minHeight?: string;
}

const languageCompartment = new Compartment();

function getLanguageExtension(lang: CodeLanguage) {
  switch (lang) {
    case 'json':
      return json();
    case 'javascript':
    case 'typescript':
      return javascript({ typescript: lang === 'typescript' });
    case 'html':
      return html();
    case 'markdown':
      return markdown();
    default:
      return [];
  }
}

export function CodeEditor({
  value,
  onChange,
  language = 'text',
  placeholder,
  className,
  disabled = false,
  minHeight = '150px',
}: CodeEditorProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const editorRef = React.useRef<EditorView | null>(null);
  const isInternalChange = React.useRef(false);

  React.useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isInternalChange.current) {
        const newValue = update.state.doc.toString();
        onChange(newValue);
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        oneDark,
        languageCompartment.of(getLanguageExtension(language)),
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
      isInternalChange.current = false;
    }
  }, [value]);

  // Update language when it changes
  React.useEffect(() => {
    if (editorRef.current) {
      editorRef.current.dispatch({
        effects: languageCompartment.reconfigure(getLanguageExtension(language)),
      });
    }
  }, [language]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'border border-border-default rounded-md overflow-hidden',
        disabled && 'opacity-50',
        className
      )}
    />
  );
}
