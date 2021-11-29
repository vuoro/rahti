import { html, createRoot, ServerElement } from "@vuoro/rahti";

export default (element) => {
  const root = createRoot(element);

  return (effect, props, childHtml) => {
    let childFragment;
    if (childHtml) {
      childFragment = html["astro-fragment"]();
      childFragment.innerHTML = childHtml;
    }

    effect(root, props, childFragment);
  };
};
