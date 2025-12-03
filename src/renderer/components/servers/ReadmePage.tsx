import { ArrowLeft, ExternalLink } from 'lucide-react';

interface ReadmePageProps {
  serverName: string;
  readme: string;
  onBack: () => void;
}

/**
 * Simple markdown renderer for README display
 * Converts markdown to HTML with basic styling
 */
function renderMarkdown(markdown: string): string {
  let html = markdown;

  // Escape HTML to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (```lang\ncode\n```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="bg-bg-tertiary p-4 rounded-lg overflow-x-auto my-4"><code class="text-sm font-mono text-gray-300">${code.trim()}</code></pre>`;
  });

  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code class="bg-bg-tertiary px-1.5 py-0.5 rounded text-sm font-mono text-emerald-400">$1</code>');

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6 class="text-sm font-semibold text-white mt-6 mb-2">$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5 class="text-base font-semibold text-white mt-6 mb-2">$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4 class="text-lg font-semibold text-white mt-6 mb-3">$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="text-xl font-semibold text-white mt-8 mb-3">$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="text-2xl font-bold text-white mt-8 mb-4 pb-2 border-b border-border-default">$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1 class="text-3xl font-bold text-white mt-8 mb-4 pb-2 border-b border-border-default">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="font-bold"><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
  html = html.replace(/__(.+?)__/g, '<strong class="font-bold text-white">$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em class="italic">$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del class="line-through text-gray-500">$1</del>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 hover:underline">$1</a>');

  // Images ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-4" />');

  // Blockquotes
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="border-l-4 border-gray-600 pl-4 my-4 text-gray-400 italic">$1</blockquote>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="border-border-default my-8" />');
  html = html.replace(/^\*\*\*$/gm, '<hr class="border-border-default my-8" />');

  // Unordered lists
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li class="ml-6 list-disc text-gray-300">$1</li>');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-6 list-decimal text-gray-300">$1</li>');

  // Wrap consecutive li elements in ul/ol
  html = html.replace(/(<li class="ml-6 list-disc[^>]*>.*?<\/li>\n?)+/g, '<ul class="my-4 space-y-1">$&</ul>');
  html = html.replace(/(<li class="ml-6 list-decimal[^>]*>.*?<\/li>\n?)+/g, '<ol class="my-4 space-y-1">$&</ol>');

  // Paragraphs (lines that aren't special elements)
  html = html.split('\n\n').map(block => {
    // Don't wrap blocks that already have HTML tags
    if (block.trim().startsWith('<') || block.trim() === '') {
      return block;
    }
    // Join lines within a block
    const joined = block.replace(/\n(?!$)/g, ' ');
    if (joined.trim() && !joined.trim().startsWith('<')) {
      return `<p class="text-gray-300 leading-relaxed my-4">${joined}</p>`;
    }
    return joined;
  }).join('\n');

  return html;
}

export function ReadmePage({ serverName, readme, onBack }: ReadmePageProps) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-border-default bg-bg-secondary flex-shrink-0">
        <button
          onClick={onBack}
          className="btn-icon"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold">{serverName}</h1>
          <p className="text-sm text-gray-500">README</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          <article
            className="prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(readme) }}
          />
        </div>
      </div>
    </div>
  );
}
