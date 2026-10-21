/**
 * Measured profile of the signer avatar (public/avatar/signer.glb), in its own model space:
 * metres, +y up, +z toward the viewer, the avatar's left at +x. Generated offline from the
 * rest-pose mesh (body + suit, arm triangles excluded), so the solver knows where the body
 * surface is without ray-casting at runtime.
 *
 * DEPTH[iy][ix] is the front-most surface z in millimetres at x = X0 + ix*STEP,
 * y = Y0 + iy*STEP (null = no body there). It was dilated by one cell so cavities (mouth,
 * armpits) never let a hand sink into the body.
 */
export const PROFILE = { X0: -0.2, Y0: 0.8, STEP: 0.02, NX: 21, NY: 50 };

/** Landmarks measured from the rest pose (joints and mesh extremes). */
export const LANDMARKS = {
  crownY: 1.773,
  eye: { x: 0.0324, y: 1.6515, z: 0.127 },
  noseTip: { x: 0, y: 1.614, z: 0.1765 },
  mouthY: 1.585,
  chinY: 1.545,
  shoulder: { x: 0.1808, y: 1.398, z: 0.0201 },
  upperArm: 0.256,
  forearm: 0.254,
};

// prettier-ignore
export const DEPTH = [
  [117,132,135,138,138,138,132,123,110,88,null,93,115,127,134,136,136,136,135,127,116],
  [114,129,134,136,138,136,132,122,110,103,106,99,113,126,132,134,136,135,130,123,108],
  [112,125,132,134,136,134,131,122,115,118,120,120,116,125,129,132,134,132,127,121,99],
  [106,120,129,132,134,131,131,126,122,123,124,124,123,123,126,129,132,127,123,116,93],
  [96,113,120,129,131,131,126,124,125,126,127,126,125,123,123,126,127,123,118,109,87],
  [87,106,116,120,126,126,124,125,126,127,128,127,126,125,123,123,121,118,111,100,63],
  [76,97,111,116,119,123,124,125,127,128,128,128,126,125,124,120,117,114,106,96,null],
  [59,93,104,112,116,121,124,126,127,128,128,128,127,125,123,120,116,109,102,81,null],
  [null,85,100,110,116,121,128,134,138,140,141,141,139,136,131,124,116,107,96,73,null],
  [41,83,99,110,119,128,134,138,140,141,142,142,141,139,136,131,124,114,93,59,null],
  [null,82,100,110,119,127,133,137,140,142,144,144,142,140,137,131,122,111,97,62,null],
  [null,70,97,109,118,126,133,137,141,144,144,144,144,142,138,131,120,107,91,null,null],
  [null,null,91,105,116,125,132,137,141,144,144,144,144,142,138,131,118,102,79,null,null],
  [null,null,78,102,114,123,131,136,141,143,144,144,144,142,137,129,115,96,56,null,null],
  [null,null,49,96,112,122,130,136,140,143,143,144,143,141,136,127,111,90,null,null,null],
  [null,null,null,93,113,123,131,137,141,143,144,144,144,141,136,126,111,86,null,null,null],
  [null,null,null,90,112,125,133,139,142,144,144,144,143,141,135,124,109,83,null,null,null],
  [null,null,null,91,113,126,136,142,144,144,144,144,145,142,136,126,111,86,null,null,null],
  [null,null,null,90,123,136,148,153,151,148,147,149,151,154,149,136,123,91,null,null,null],
  [null,null,null,107,135,148,157,161,159,154,152,156,159,162,158,149,135,108,null,null,null],
  [null,null,null,124,147,157,165,168,165,160,158,161,165,168,165,158,148,124,null,null,null],
  [null,null,null,135,155,166,170,173,169,165,164,167,170,172,170,166,155,133,null,null,null],
  [null,null,109,150,166,177,180,179,177,175,174,175,177,181,181,177,166,152,125,null,null],
  [null,null,144,165,177,180,180,180,179,177,175,177,181,181,181,181,177,165,143,null,null],
  [null,40,147,171,176,178,180,179,177,175,174,175,177,181,181,178,176,166,147,19,null],
  [null,95,136,155,171,176,178,175,173,173,173,173,173,175,178,176,166,154,137,91,null],
  [91,110,123,140,155,162,165,162,160,158,158,158,160,162,165,163,154,140,123,108,null],
  [null,113,122,130,140,147,150,148,146,146,147,146,146,148,150,148,140,128,116,null,null],
  [null,null,113,122,130,135,138,137,137,137,136,136,136,137,139,135,128,117,111,null,null],
  [null,null,-69,-67,-69,124,127,127,127,127,127,127,126,126,125,122,117,111,-68,null,null],
  [null,null,-67,-62,-67,107,117,118,118,118,117,117,117,116,115,113,-66,-62,-66,null,null],
  [null,null,-62,-52,-61,95,107,107,107,108,108,108,107,106,105,95,-61,-52,-62,null,null],
  [null,null,-52,-52,78,79,95,96,97,98,100,97,97,96,95,81,81,-52,-52,null,null],
  [null,null,null,-48,59,78,79,84,85,87,89,87,85,83,81,81,62,-48,null,null,null],
  [null,null,null,-24,31,59,62,66,71,74,80,74,71,67,64,62,31,null,null,null,null],
  [null,null,null,null,-24,31,37,61,74,80,87,80,74,61,41,31,null,null,null,null,null],
  [null,null,null,null,null,null,null,61,80,136,147,136,80,61,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,70,136,148,155,148,136,70,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,128,148,155,158,155,148,128,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,101,140,144,158,165,158,144,140,101,null,null,null,null,null,null],
  [null,null,null,null,null,null,120,144,155,165,175,165,155,144,120,null,null,null,null,null,null],
  [null,null,null,null,null,43,129,143,151,175,175,175,151,143,129,43,null,null,null,null,null],
  [null,null,null,null,null,59,127,141,145,161,175,161,145,141,127,59,null,null,null,null,null],
  [null,null,null,null,null,null,129,145,150,158,161,158,150,145,129,null,null,null,null,null,null],
  [null,null,null,null,null,50,127,149,157,159,159,159,157,149,127,50,null,null,null,null,null],
  [null,null,null,null,null,null,119,143,152,157,159,157,152,143,119,null,null,null,null,null,null],
  [null,null,null,null,null,null,110,134,144,152,155,152,144,134,110,null,null,null,null,null,null],
  [null,null,null,null,null,null,84,117,134,144,147,144,134,117,84,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,84,117,129,133,129,117,84,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null,78,102,108,102,78,null,null,null,null,null,null,null,null],
];

/**
 * Torso volume for collision, measured from the rest-pose mesh (arms excluded): per height
 * y, the half-width and the back / front surface z near the midline. The torso is treated
 * as an elliptical cylinder through each slice; the head as a sphere.
 */
// prettier-ignore
export const TORSO = [
  // y,    halfW, back,   front
  [0.84, 0.190, -0.080, 0.128],
  [0.92, 0.185, -0.099, 0.130],
  [1.00, 0.174, -0.094, 0.142],
  [1.08, 0.145, -0.060, 0.144],
  [1.16, 0.136, -0.050, 0.145],
  [1.20, 0.140, -0.052, 0.165],
  [1.24, 0.155, -0.055, 0.176],
  [1.28, 0.180, -0.071, 0.182],
  [1.32, 0.178, -0.078, 0.160],
  [1.36, 0.168, -0.083, 0.130],
  [1.40, 0.158, -0.080, 0.113],
  [1.44, 0.130, -0.069, 0.092],
  [1.48, 0.095, -0.058, 0.075],
];
export const HEAD = { x: 0, y: 1.645, z: 0.035, r: 0.105 };
