/* The Lab's experiments run here, off the page's thread, so the page keeps
   drawing while a few minutes of world time are worked through. */
importScripts("physics.js", "lab-core.js");
self.onmessage = e => {
  try {
    const setup = self.LabCore.clean(self.WBPhysics, e.data.setup);
    let last = 0;
    const result = self.LabCore.experiment(self.WBPhysics, setup, e.data.plan, p => {
      if (p - last >= 0.01 || p === 1) { last = p; self.postMessage({ progress: p }); }
    });
    self.postMessage({ result });
  } catch (err) {
    self.postMessage({ error: String(err && err.message || err) });
  }
};
