export const getComponentRoots = (componentName: string): HTMLElement[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      `[data-component="${componentName}"]`
    )
  );

export const queryAll = <TElement extends Element = HTMLElement>(
  scope: ParentNode,
  selector: string
): TElement[] => Array.from(scope.querySelectorAll<TElement>(selector));

export const queryRequired = <TElement extends Element = HTMLElement>(
  scope: ParentNode,
  selector: string
): TElement => {
  const element = scope.querySelector<TElement>(selector);
  if (!element) {
    throw new Error(`Required element not found: ${selector}`);
  }
  return element;
};
