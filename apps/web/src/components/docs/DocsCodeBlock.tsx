'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function DocsCodeBlock({ code, lang, title }: { code: string; lang: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <figure className="my-5 rounded-xl border border-[#0B0F14]/10 bg-[#0B0F14] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <figcaption className="text-[11px] font-semibold text-white/60 font-mono-num truncate">
          {title ?? lang}
        </figcaption>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/60 hover:text-[#00E676] transition px-2 py-1 rounded-md hover:bg-white/5"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[12.5px] leading-relaxed text-[#E6FBF0] font-mono-num">
        <code>{code}</code>
      </pre>
    </figure>
  );
}

