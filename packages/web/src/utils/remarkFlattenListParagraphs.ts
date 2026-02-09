/**
 * Remark plugin to flatten all paragraph nodes inside list items
 * This makes lists render tightly like GitHub, even when there are blank lines
 */
import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, ListItem, Paragraph } from 'mdast';

/**
 * Flatten all paragraph nodes inside list items
 * This converts: listItem → paragraph → children
 * Into: listItem → children
 */
export const remarkFlattenListParagraphs: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'listItem', (node: ListItem) => {
      // Flatten all paragraphs in the list item
      const newChildren = [];

      for (const child of node.children) {
        if (child.type === 'paragraph') {
          // Extract paragraph children and add them directly to list item
          newChildren.push(...(child as Paragraph).children);
        } else {
          // Keep non-paragraph children as-is
          newChildren.push(child);
        }
      }

      node.children = newChildren as ListItem['children'];
    });
  };
};
