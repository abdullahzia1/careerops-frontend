import { marked } from "marked";
import { useMemo } from "react";

marked.setOptions({ gfm: true, breaks: false });

interface Props {
  markdown: string;
  className?: string;
}

export function MarkdownView({ markdown, className = "" }: Props) {
  const html = useMemo(() => marked(markdown) as string, [markdown]);

  return (
    <div
      className={`markdown-body ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
