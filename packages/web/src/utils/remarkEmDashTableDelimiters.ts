import type { Root } from 'mdast';
import type { Plugin } from 'unified';

const emDashDelimiter = /^ *\|?[ \t]*—-?(?:[ \t]*\|[ \t]*—-?)+[ \t]*\|?[ \t]*$/;

export const remarkEmDashTableDelimiters: Plugin<[], Root> = function () {
  return (tree, file) => {
    const source = file.toString();
    if (!source.includes('—')) return;

    // Keep the original line endings when reparsing the rendering source.
    const lines = source.split(/(\r\n|\r|\n)/);
    let changed = false;

    for (const node of tree.children) {
      if (node.type !== 'paragraph' || !node.position) continue;

      const headerIndex = (node.position.start.line - 1) * 2;
      const delimiterIndex = headerIndex + 2;
      const delimiter = lines[delimiterIndex];
      if (node.position.end.line <= node.position.start.line || !emDashDelimiter.test(delimiter)) continue;

      // Two hyphens work even when there is no leading pipe.
      const normalized = delimiter.replace(/—-?/g, '--');
      const candidate = this.parse(`${lines[headerIndex]}\n${normalized}`) as Root;
      if (candidate.children[0]?.type !== 'table') continue;

      lines[delimiterIndex] = normalized;
      changed = true;
    }

    // Parse the whole document so references outside the table still resolve.
    if (changed) return this.parse(lines.join('')) as Root;
  };
};
