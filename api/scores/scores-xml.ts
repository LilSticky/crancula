/** Lines of XML text, one element or text per line. */
export type Lines = readonly string[];

const INDENT = '  ';

/** The element `name` with its children indented one level; `attributes` is the text after the name, with its leading space. */
export function element(name: string, children: Lines, attributes = ''): Lines {
  return [`<${name}${attributes}>`, ...children.map((line) => INDENT + line), `</${name}>`];
}
