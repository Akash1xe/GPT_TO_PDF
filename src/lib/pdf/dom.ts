export function el<K extends keyof HTMLElementTagNameMap>(document: Document, tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function appendText(parent: Node, value: string): void {
  parent.appendChild(parent.ownerDocument!.createTextNode(value));
}
