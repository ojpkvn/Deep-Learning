/* Shared model logic (used by the web page AND by the Node verification test).
 * Mirrors the notebook pipeline: decode -> tf.image.resize(224x224, bilinear, no antialias)
 * -> raw 0-255 float32 (EfficientNetB0 rescales inside the model) -> softmax over 4 classes. */
(function (root) {
  const CLASS_NAMES = ['laksa', 'mee_goreng', 'pho', 'ramen'];   // same order as the notebook (alphabetical)
  const INPUT_SIZE = 224;

  // Fetch model.json + weight shards ourselves (revalidating with the server, so a stale or partial cached copy
  // is never used), check the total size, then build the model from memory.
  async function fetchModelParts(url, cacheMode) {
    const base = url.slice(0, url.lastIndexOf('/') + 1);
    const jr = await fetch(url, { cache: cacheMode });
    if (!jr.ok) throw new Error('Request to ' + url + ' failed with status code ' + jr.status);
    const mj = await jr.json();
    const group = mj.weightsManifest[0];
    const parts = [];
    for (const p of group.paths) {
      const r = await fetch(base + p, { cache: cacheMode });
      if (!r.ok) throw new Error('Request to ' + base + p + ' failed with status code ' + r.status);
      parts.push(new Uint8Array(await r.arrayBuffer()));
    }
    const total = parts.reduce((n, a) => n + a.length, 0);
    const need = group.weights.reduce((n, w) => n + (w.shape.reduce((a, b) => a * b, 1)) * 4, 0);
    if (total !== need) throw new Error('weight files total ' + total + ' bytes but model.json needs ' + need);
    const all = new Uint8Array(total); let off = 0;
    for (const a of parts) { all.set(a, off); off += a.length; }
    return { mj, weights: all.buffer };
  }

  async function loadModel(url) {
    let parts;
    try { parts = await fetchModelParts(url, 'no-cache'); }
    catch (e) { parts = await fetchModelParts(url, 'reload'); }   // retry, bypassing every cache
    const { mj, weights } = parts;
    const model = await tf.loadGraphModel(tf.io.fromMemory({
      modelTopology: mj.modelTopology, weightSpecs: mj.weightsManifest[0].weights, weightData: weights,
      format: mj.format, generatedBy: mj.generatedBy, convertedBy: mj.convertedBy, signature: mj.signature
    }));
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
