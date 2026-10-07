const fs = require('fs');
const path = require('path');

// Simple markdown to HTML converter
function markdownToHtml(markdown) {
  let html = markdown;
  
  // Code blocks with language
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'text';
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    return `<pre><code class="language-${language}">${escapedCode}</code></pre>`;
  });
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Headers
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Lists
  html = html.replace(/^\s*[-*+] (.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Numbered lists
  html = html.replace(/^\s*\d+\. (.*$)/gim, '<li>$1</li>');
  
  // Tables
  html = html.replace(/^\|(.+)\|\s*\n\|[-|\s:]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm, (match, header, body) => {
    const headers = header.split('|').map(h => h.trim()).filter(h => h);
    const rows = body.trim().split('\n').map(row => 
      row.split('|').map(cell => cell.trim()).filter(cell => cell)
    );
    
    let table = '<table><thead><tr>';
    headers.forEach(h => table += `<th>${h}</th>`);
    table += '</tr></thead><tbody>';
    
    rows.forEach(row => {
      table += '<tr>';
      row.forEach(cell => table += `<td>${cell}</td>`);
      table += '</tr>';
    });
    
    table += '</tbody></table>';
    return table;
  });
  
  // Blockquotes
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
  
  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr>');
  
  // Paragraphs
  html = html.replace(/^\s*(?!<[a-z/])(.*$)/gim, (match, text) => {
    if (text.trim() && !text.match(/^<|^\s*$/)) {
      return `<p>${text}</p>`;
    }
    return text;
  });
  
  return html;
}

// Read markdown file
const markdownPath = path.join(__dirname, 'ANTWORTEN-AN-DESIGN-AGENT.md');
const markdown = fs.readFileSync(markdownPath, 'utf-8');

// Convert to HTML
const htmlContent = markdownToHtml(markdown);

// HTML template with TISCH design
const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TISCH - Antworten an den Design-Agenten</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
  <style>
    :root {
      --paper: #F2EAD3;
      --paper-dark: #E8DCC4;
      --ink: #2B2B28;
      --ink-light: #4A4A47;
      --accent-purple: #8B5CF6;
      --accent-red: #C4453B;
      --grid-line: #D4C5A9;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background-color: var(--paper);
      background-image: 
        linear-gradient(to right, var(--grid-line) 1px, transparent 1px),
        linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px);
      background-size: 24px 24px;
      color: var(--ink);
      line-height: 1.6;
      padding: 2rem;
    }
    
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: rgba(255, 251, 240, 0.95);
      padding: 3rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(43, 43, 40, 0.15);
    }
    
    h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      color: var(--accent-purple);
      border-bottom: 3px solid var(--accent-purple);
      padding-bottom: 0.5rem;
    }
    
    h2 {
      font-size: 2rem;
      margin-top: 3rem;
      margin-bottom: 1rem;
      color: var(--ink);
      border-bottom: 2px solid var(--grid-line);
      padding-bottom: 0.5rem;
    }
    
    h3 {
      font-size: 1.5rem;
      margin-top: 2rem;
      margin-bottom: 0.75rem;
      color: var(--ink);
    }
    
    h4 {
      font-size: 1.2rem;
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
      color: var(--ink-light);
    }
    
    p {
      margin-bottom: 1rem;
    }
    
    a {
      color: var(--accent-purple);
      text-decoration: none;
      border-bottom: 1px solid transparent;
      transition: border-color 0.2s;
    }
    
    a:hover {
      border-bottom-color: var(--accent-purple);
    }
    
    code {
      background: var(--paper-dark);
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 0.9em;
      color: var(--accent-red);
    }
    
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1rem 0;
      border: 1px solid var(--grid-line);
    }
    
    pre code {
      background: none;
      padding: 0;
      color: inherit;
      font-size: 0.85rem;
      line-height: 1.5;
    }
    
    ul, ol {
      margin-left: 2rem;
      margin-bottom: 1rem;
    }
    
    li {
      margin-bottom: 0.5rem;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      background: white;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(43, 43, 40, 0.1);
    }
    
    th {
      background: var(--accent-purple);
      color: white;
      padding: 0.75rem;
      text-align: left;
      font-weight: 600;
    }
    
    td {
      padding: 0.75rem;
      border-bottom: 1px solid var(--grid-line);
    }
    
    tr:last-child td {
      border-bottom: none;
    }
    
    tr:hover {
      background: var(--paper);
    }
    
    blockquote {
      border-left: 4px solid var(--accent-purple);
      padding-left: 1rem;
      margin: 1rem 0;
      color: var(--ink-light);
      font-style: italic;
    }
    
    hr {
      border: none;
      border-top: 2px solid var(--grid-line);
      margin: 2rem 0;
    }
    
    .toc {
      background: var(--paper-dark);
      padding: 1.5rem;
      border-radius: 6px;
      margin-bottom: 2rem;
      border: 1px solid var(--grid-line);
    }
    
    .toc h2 {
      margin-top: 0;
      font-size: 1.5rem;
    }
    
    .toc ul {
      list-style: none;
      margin-left: 0;
    }
    
    .toc li {
      margin-bottom: 0.5rem;
    }
    
    .toc a {
      color: var(--ink);
      font-weight: 500;
    }
    
    .meta {
      background: var(--paper-dark);
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 2rem;
      font-size: 0.9rem;
      color: var(--ink-light);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="meta">
      <strong>Von:</strong> Coding-Agent (Claude)<br>
      <strong>Datum:</strong> 06.10.2026<br>
      <strong>Bezug:</strong> Fragen zum Prototyp tisch-orchestrator.html
    </div>
    
    ${htmlContent}
  </div>
  
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script>hljs.highlightAll();</script>
</body>
</html>`;

// Write HTML file
const htmlPath = path.join(__dirname, 'ANTWORTEN-AN-DESIGN-AGENT.html');
fs.writeFileSync(htmlPath, html, 'utf-8');

console.log(`✓ HTML generated: ${htmlPath}`);
console.log(`  Open in browser: file://${htmlPath}`);
