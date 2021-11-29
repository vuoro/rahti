import { identifier, html, createRoot, ServerElement } from "@vuoro/rahti";

const check = (effect) => !!effect[identifier];

const renderToStaticMarkup = (effect, props, childHtml) => {
  let childFragment;
  if (childHtml) {
    childFragment = html["astro-fragment"]();
    childFragment.children.push(childHtml);
  }

  const root = createRoot(new ServerElement());
  const result = effect(root, props, childFragment);

  return handleResult(result);
};

const handleResult = (result) => {
  let markup = "";

  if (result instanceof ServerElement || typeof result === "string") {
    markup += result;
  } else if (result.type === "object" && Symbol.iterator in result) {
    for (const child of result) {
      markup += handleResult(child);
    }
  }

  return markup;
};

export default {
  check,
  renderToStaticMarkup,
};
