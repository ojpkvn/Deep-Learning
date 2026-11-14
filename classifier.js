/* Shared model logic (used by the web page AND by the Node verification test).
 * Mirrors the notebook pipeline: decode -> tf.image.resize(224x224, bilinear, no antialias)
 * -> raw 0-255 float32 (EfficientNetB0 rescales inside the model) -> softmax over 4 classes. */
(function (root) {
  const CLASS_NAMES = ['laksa', 'mee_goreng', 'pho', 'ramen'];   // same order as the notebook (alphabetical)
  const INPUT_SIZE = 224;

  async function loadModel(url) {
    const model = await tf.loadGraphModel(url);
    // warm-up run so the first real prediction is fast
    tf.dispose(model.predict(tf.zeros([1, INPUT_SIZE, INPUT_SIZE, 3])));
    return model;
  }

  // pixels: [height, width, 3] tensor with values 0-255 (e.g. from tf.browser.fromPixels)
  function preprocess(pixels) {
    return tf.tidy(() =>
      // halfPixelCenters=true + alignCorners=false is exactly what Python's tf.image.resize does
      tf.image.resizeBilinear(pixels, [INPUT_SIZE, INPUT_SIZE], false, true).expandDims(0));
  }

  async function predict(model, pixels) {
    const x = preprocess(pixels);
    const out = model.predict(x);
    const probs = Array.from(await out.data());
    tf.dispose([x, out]);
    return CLASS_NAMES.map((name, i) => ({ name, p: probs[i] })).sort((a, b) => b.p - a.p);
  }

  root.Classifier = { CLASS_NAMES, INPUT_SIZE, loadModel, predict, preprocess };
})(typeof window !== 'undefined' ? window : globalThis);
