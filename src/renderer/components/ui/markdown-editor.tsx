import * as React from 'react';
import { Eye, Edit3 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Simple markdown to HTML converter for preview
function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return '';

  let html = markdown;

  // Escape HTML special chars first (but preserve our markdown)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (must be before other processing)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code (before other inline elements)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Unordered lists - collect consecutive items
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)(\n<li>[\s\S]*?<\/li>)*/g, (match) => {
    return '<ul>' + match.replace(/\n/g, '') + '</ul>';
  });

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-400 underline">$1</a>');

  // Paragraphs - split by double newlines, wrap non-block content
  const blocks = html.split(/\n\n+/);
  html = blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    // Don't wrap if already a block element
    if (/^<(h[1-6]|ul|ol|li|pre|blockquote|div)/.test(block)) {
      return block;
    }
    // Replace single newlines with <br> inside paragraphs
    return '<p>' + block.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');

  return html;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write markdown...',
  className,
  disabled = false,
}: MarkdownEditorProps) {
  const [mode, setMode] = React.useState<'edit' | 'preview'>('edit');

  return (
    <div className={cn('border border-border-default rounded-md overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-2 border-b border-border-default bg-bg-secondary">
        <span className="text-xs text-gray-500 px-2">
          Supports: # headings, **bold**, *italic*, `code`, - lists, {'>'} quotes
        </span>

        <div className="flex-1" />

        {/* Mode Toggle */}
        <div className="flex items-center gap-1 bg-bg-tertiary rounded p-0.5">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors',
              mode === 'edit' ? 'bg-bg-primary text-white' : 'text-gray-400 hover:text-white'
            )}
          >
            <Edit3 className="w-3 h-3" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors',
              mode === 'preview' ? 'bg-bg-primary text-white' : 'text-gray-400 hover:text-white'
            )}
          >
            <Eye className="w-3 h-3" />
            Preview
          </button>
        </div>
      </div>

      {/* Editor/Preview Content */}
      {mode === 'edit' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full p-3 bg-bg-secondary text-white placeholder-gray-400 font-mono text-sm min-h-[150px] resize-y focus:outline-none"
        />
      ) : (
        <div
          className="prose prose-invert prose-sm max-w-none p-3 min-h-[150px] [&_pre]:bg-bg-tertiary [&_pre]:p-3 [&_pre]:rounded [&_code]:bg-bg-tertiary [&_code]:px-1 [&_code]:rounded [&_blockquote]:border-l-2 [&_blockquote]:border-gray-500 [&_blockquote]:pl-3 [&_blockquote]:italic"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(value) }}
        />
      )}
    </div>
  );
}
