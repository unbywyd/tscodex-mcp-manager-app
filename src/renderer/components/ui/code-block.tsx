import * as React from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
  showCopy?: boolean;
}

export function CodeBlock({ code, language = 'json', className, showCopy = true }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple JSON syntax highlighting
  const highlightJSON = (json: string): React.ReactNode => {
    try {
      const formatted = JSON.stringify(JSON.parse(json), null, 2);
      return highlightSyntax(formatted);
    } catch {
      return highlightSyntax(json);
    }
  };

  const highlightSyntax = (text: string): React.ReactNode => {
    // Split by different token types
    const lines = text.split('\n');

    return lines.map((line, lineIndex) => {
      const tokens: React.ReactNode[] = [];
      let remaining = line;
      let keyIndex = 0;

      while (remaining.length > 0) {
        // Match strings (keys and values)
        const stringMatch = remaining.match(/^"([^"\\]|\\.)*"/);
        if (stringMatch) {
          const str = stringMatch[0];
          // Check if it's a key (followed by colon)
          const afterString = remaining.slice(str.length);
          const isKey = afterString.trimStart().startsWith(':');

          tokens.push(
            <span key={`${lineIndex}-${keyIndex++}`} className={isKey ? 'text-blue-400' : 'text-emerald-400'}>
              {str}
            </span>
          );
          remaining = remaining.slice(str.length);
          continue;
        }

        // Match numbers
        const numberMatch = remaining.match(/^-?\d+\.?\d*([eE][+-]?\d+)?/);
        if (numberMatch) {
          tokens.push(
            <span key={`${lineIndex}-${keyIndex++}`} className="text-amber-400">
              {numberMatch[0]}
            </span>
          );
          remaining = remaining.slice(numberMatch[0].length);
          continue;
        }

        // Match booleans and null
        const boolMatch = remaining.match(/^(true|false|null)/);
        if (boolMatch) {
          tokens.push(
            <span key={`${lineIndex}-${keyIndex++}`} className="text-teal-400">
              {boolMatch[0]}
            </span>
          );
          remaining = remaining.slice(boolMatch[0].length);
          continue;
        }

        // Match brackets and braces
        const bracketMatch = remaining.match(/^[\[\]{}:,]/);
        if (bracketMatch) {
          tokens.push(
            <span key={`${lineIndex}-${keyIndex++}`} className="text-gray-400">
              {bracketMatch[0]}
            </span>
          );
          remaining = remaining.slice(1);
          continue;
        }

        // Match whitespace
        const whitespaceMatch = remaining.match(/^\s+/);
        if (whitespaceMatch) {
          tokens.push(<span key={`${lineIndex}-${keyIndex++}`}>{whitespaceMatch[0]}</span>);
          remaining = remaining.slice(whitespaceMatch[0].length);
          continue;
        }

        // Fallback: take one character
        tokens.push(<span key={`${lineIndex}-${keyIndex++}`}>{remaining[0]}</span>);
        remaining = remaining.slice(1);
      }

      return (
        <div key={lineIndex} className="leading-relaxed">
          {tokens}
        </div>
      );
    });
  };

  return (
    <div className={cn('relative group', className)}>
      {showCopy && (
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded bg-bg-tertiary hover:bg-bg-hover transition-colors opacity-0 group-hover:opacity-100"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Copy className="w-4 h-4 text-gray-400" />
          )}
        </button>
      )}
      <pre className="bg-bg-tertiary rounded-md p-4 overflow-x-auto text-sm font-mono custom-scrollbar">
        <code>{language === 'json' ? highlightJSON(code) : code}</code>
      </pre>
    </div>
  );
}
