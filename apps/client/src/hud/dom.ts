/**
 * Looks up an element and checks it is the kind we expect. A missing or
 * mistyped element is a bug in the page, so it throws instead of carrying on
 * with a half-wired screen.
 */
export function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  kind: new () => T,
): T {
  const element = root.querySelector(selector);
  if (element === null) {
    throw new Error(`The page is missing the element "${selector}"`);
  }
  if (!(element instanceof kind)) {
    throw new Error(`The element "${selector}" is not a ${kind.name}`);
  }
  return element;
}
