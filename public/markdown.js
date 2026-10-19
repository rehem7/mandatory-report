import { MarkdownIt, cjkFriendly } from "/vendor/markdown-it.js";

const markdown = new MarkdownIt({ html: false, breaks: true, linkify: false }).use(cjkFriendly);
const linkOpen = markdown.renderer.rules.link_open;
markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  tokens[index].attrSet("target", "_blank");
  tokens[index].attrSet("rel", "noopener noreferrer");
  return linkOpen ? linkOpen(tokens, index, options, env, renderer) : renderer.renderToken(tokens, index, options);
};
// AI text may contain image syntax; show its description without fetching remote media.
markdown.renderer.rules.image = (tokens, index, options, env, renderer) => markdown.utils.escapeHtml(renderer.renderInlineAsText(tokens[index].children, options, env));

export function renderMarkdown(value) {
  return `<div class="markdown-body">${markdown.render(String(value ?? ""))}</div>`;
}
