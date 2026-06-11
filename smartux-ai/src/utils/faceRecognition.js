// ─────────────────────────────────────────────────────────────────────────────
//  faceRecognition.js — Real face recognition powered by face-api.js
//
//  Pipeline (all in-browser, no image ever leaves the device):
//    1. loadModels()        — lazy-load the TF.js weights from /models (once)
//    2. computeDescriptor() — detect a single face → 128-float descriptor
//    3. matchDescriptor()   — euclidean nearest-neighbour against enrolled faces
//
//  A "descriptor" is a 128-dimensional embedding. Two descriptors of the same
//  person are close (small euclidean distance); different people are far apart.
//  Below MATCH_THRESHOLD we consider it the same person.
// ─────────────────────────────────────────────────────────────────────────────

// face-api.js is loaded as a global <script> (public/face-api.min.js, wired in
// public/index.html) and exposed as window.faceapi. This avoids bundling its
// node-only `fs`/`path` env shims through CRA's webpack config (which has no
// node polyfills and would fail to compile).

// Distance below which two descriptors are treated as the same person.
// 0.6 is the value recommended by the face-api.js authors; we tighten it
// slightly to 0.55 to reduce false-accepts in an access-control context.
export const MATCH_THRESHOLD = 0.55;

const MODEL_URL = `${process.env.PUBLIC_URL || ""}/models`;

/** Resolve window.faceapi, waiting for the deferred <script> to finish loading. */
function getFaceApi(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (window.faceapi) return resolve(window.faceapi);
    const start = Date.now();
    const tick = () => {
      if (window.faceapi) return resolve(window.faceapi);
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("face-api.js introuvable (public/face-api.min.js non chargé)"));
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}

let modelsPromise = null;

/** Lazy-load the three models we need. Safe to call repeatedly — loads once. */
export function loadModels() {
  if (!modelsPromise) {
    modelsPromise = getFaceApi()
      .then((faceapi) =>
        Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
      )
      .catch((err) => {
        // Reset so a later retry can re-attempt the download
        modelsPromise = null;
        throw err;
      });
  }
  return modelsPromise;
}

/**
 * Detect the single most prominent face in a video/image element and return
 * its 128-float descriptor as a plain Array (JSON-serialisable).
 *
 * @param {HTMLVideoElement|HTMLImageElement} mediaEl
 * @returns {Promise<number[]|null>} descriptor, or null if no face detected
 */
export async function computeDescriptor(mediaEl) {
  await loadModels();
  const faceapi = await getFaceApi();
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  const detection = await faceapi
    .detectSingleFace(mediaEl, options)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detection) return null;
  return Array.from(detection.descriptor);
}

/** Euclidean distance between two equal-length numeric arrays. */
export function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Find the closest enrolled descriptor to `probe`.
 *
 * @param {number[]} probe                       — descriptor to identify
 * @param {Array<{staff_id:number, descriptor:number[]}>} enrolled
 * @returns {{ staff_id:number, distance:number, match:boolean } | null}
 */
export function matchDescriptor(probe, enrolled) {
  if (!probe || !enrolled?.length) return null;
  let best = null;
  for (const e of enrolled) {
    if (!Array.isArray(e.descriptor) || e.descriptor.length !== probe.length) continue;
    const distance = euclideanDistance(probe, e.descriptor);
    if (!best || distance < best.distance) best = { staff_id: e.staff_id, distance };
  }
  if (!best) return null;
  return { ...best, match: best.distance <= MATCH_THRESHOLD };
}
