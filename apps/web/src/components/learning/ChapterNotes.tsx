function inlineCode(text: string) {
  return text.split(/(`[^`]+`)/).map((part, index) => part.startsWith("`") && part.endsWith("`") ? <code key={index}>{part.slice(1, -1)}</code> : part);
}

export function ChapterNotes({ text }: { text: string }) {
  return <div className="chapter-notes">{text.trim().split(/\n\s*\n/).map((block, index) => {
    const lines = block.trim().split("\n");
    const heading = lines[0].match(/^#{1,3}\s+(.+)$/);
    const content = heading ? lines.slice(1) : lines;
    if (heading && lines[0].startsWith("# ") && content.length === 0) return null;
    return <div key={index} className="flex flex-col gap-2">
      {heading && <h3 className="font-serif">{heading[1]}</h3>}
      {content.length > 0 && (content.every((line) => line.startsWith("- "))
        ? <ul>{content.map((line, item) => <li key={item}>{inlineCode(line.slice(2))}</li>)}</ul>
        : <p>{inlineCode(content.join(" "))}</p>)}
    </div>;
  })}</div>;
}
