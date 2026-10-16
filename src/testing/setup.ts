// jsdom does not implement scrollIntoView; specs spy on it.
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => undefined;
}
