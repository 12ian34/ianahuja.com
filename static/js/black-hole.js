(function () {
  'use strict';

  var canvas = document.getElementById('relativity-canvas');
  if (!canvas) return;

  var wrap = canvas.parentElement;
  var glOpts = {
    antialias: false, depth: false, stencil: false, alpha: false,
    preserveDrawingBuffer: false, powerPreference: 'high-performance'
  };

  var gl = canvas.getContext('webgl2', glOpts);
  var isGL2 = !!gl;
  if (!gl) gl = canvas.getContext('webgl', glOpts) || canvas.getContext('experimental-webgl', glOpts);

  if (!gl) {
    wrap.innerHTML =
      '<p style="color:#94F3A6;text-align:center;padding:4em 1em">' +
      'your browser needs WebGL to render this black hole</p>';
    return;
  }

  // ─── HDR render target support ───
  // The multi-pass path (accumulation + bloom) needs float render targets.
  // Without them we fall back to a single direct-to-canvas pass.
  var hdr = null;
  if (isGL2) {
    if (gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))
      hdr = { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT, filter: gl.LINEAR };
  } else {
    var hfExt = gl.getExtension('OES_texture_half_float');
    if (hfExt && gl.getExtension('EXT_color_buffer_half_float')) {
      // Filtering half-float textures needs its own extension in WebGL1;
      // without it a LINEAR sampler makes the texture incomplete (renders black).
      var canFilter = !!gl.getExtension('OES_texture_half_float_linear');
      hdr = {
        internal: gl.RGBA, format: gl.RGBA, type: hfExt.HALF_FLOAT_OES,
        filter: canFilter ? gl.LINEAR : gl.NEAREST
      };
    }
  }

  // ─── DOM ───
  var slider = document.getElementById('distance-slider');
  var hudDistance = document.getElementById('hud-distance');
  var hudDilation = document.getElementById('hud-dilation');
  var hudAngle = document.getElementById('hud-angle');
  var hudClock = document.getElementById('hud-clock');
  var hudFov = document.getElementById('hud-fov');
  var hudThrust = document.getElementById('hud-thrust');
  var hudNote = document.getElementById('hud-note');
  var spinSlider = document.getElementById('spin-slider');
  var spinLabel = document.getElementById('spin-label');
  var distMinLabel = document.getElementById('dist-min-label');
  var massSelect = document.getElementById('mass-select');
  var fsButton = document.getElementById('relativity-fullscreen');

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Shared vertex shader ───
  var vsSrc = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aPos * 0.5 + 0.5;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  // ─── Scene shader: Kerr ray tracer ───
  var sceneSrc = [
    'precision highp float;',
    '',
    'uniform vec2 uRes;',
    'uniform float uDist;',
    'uniform float uTheta;',
    'uniform float uPhi;',
    'uniform float uTime;',
    'uniform vec2 uJitter;',
    'uniform float uFov;',       // radians per unit image radius
    'uniform sampler2D uPrev;',
    'uniform float uBlend;',
    'uniform samplerCube uSky;',
    'uniform float uSkyMix;',   // 0 until the star catalogue has loaded
    'uniform vec3 uGalX;',      // toward the galactic centre
    'uniform vec3 uGalY;',
    'uniform vec3 uGalZ;',      // galactic north pole
    'uniform float uSpin;',     // a, in geometric units (M = 0.5 so Rs = 1)
    'uniform float uIsco;',     // disk inner edge, moves inward with spin
    'uniform float uHorizon;',  // outer horizon r+ = M + sqrt(M^2 - a^2)
    'uniform float uOutward;',  // 1 once the camera has turned to face away
    'uniform float uExposure;', // observer's auto-exposure, see the JS side
    'uniform float uSteps;',    // integration budget, lowered on slow devices
    'uniform float uMwOct;',    // Milky Way fBm octaves, likewise
    '',
    '#define PI 3.14159265359',
    '#define MM 0.5',           // mass, chosen so that Rs = 2M = 1
    '#define STEPS 200',
    '#define DISK_OUT 12.0',
    '#define T_SCALE 10000.0',  // temperature normalisation (K)
    '#define DISK_GAIN 14.0',
    '#define DISK_SPIN 12.0',   // orbital rate scaling, for a watchable disk
    '',
    '// ─── Hash ───',
    'float hash(vec2 p) {',
    '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
    '}',
    '',
    '// ─── Value noise / fBm ───',
    'float hash3(vec3 p) {',
    '  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);',
    '}',
    '',
    'float vnoise(vec3 p) {',
    '  vec3 i = floor(p), f = fract(p);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  float a = mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x),',
    '                mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y);',
    '  float b = mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),',
    '                mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y);',
    '  return mix(a, b, f.z);',
    '}',
    '',
    'float fbm(vec3 p, float oct) {',
    '  float s = 0.0, a = 0.5;',
    '  for (int i = 0; i < 4; i++) {',
    '    if (float(i) >= oct) break;',
    '    s += a * vnoise(p);',
    '    p *= 2.03;',
    '    a *= 0.5;',
    '  }',
    '  return s;',
    '}',
    '',
    '// ─── Milky Way ───',
    '// Evaluated in galactic coordinates, so it lines up with the real star',
    '// catalogue baked into uSky: the band runs where the stars are dense.',
    'vec3 milkyWay(vec3 d) {',
    '  float sb = dot(d, uGalZ);',
    '  float b = asin(clamp(sb, -1.0, 1.0));',
    '  float lon = atan(dot(d, uGalY), dot(d, uGalX));',
    '',
    '  float band  = exp(-b * b / 0.030);',           // thin disc, sigma ~7 deg
    '  float halo  = exp(-b * b / 0.110);',           // thick disc
    '  float bulge = exp(-lon * lon / 0.30 - b * b / 0.045);',
    '',
    '  float n = fbm(d * 14.0, uMwOct);',
    '  float dust = fbm(d * 22.0 + 21.0, min(uMwOct, 3.0));',
    '',
    '  float v = band * (0.45 + 0.85 * n) + halo * 0.12 + bulge * 0.50;',
    '  v *= mix(1.0, 0.18, smoothstep(0.40, 0.72, dust));',  // dark dust lanes
    '',
    '  vec3 warm = vec3(1.00, 0.90, 0.74);',
    '  vec3 cool = vec3(0.72, 0.81, 1.00);',
    '  return max(v, 0.0) * 0.013 * mix(cool, warm, clamp(bulge * 1.6 + 0.22, 0.0, 1.0));',
    '}',
    '',
    '// ─── Sky ───',
    '// uSky is a cube map of 15,598 real stars from the HYG catalogue down to',
    '// magnitude 7, stored Reinhard-encoded so 8 bits carries Sirius and a',
    '// naked-eye-limit star in the same texture.',
    '//',
    '// lod widens the sky filter. Rays that graze the photon sphere are magnified',
    '// enormously and neighbouring pixels land on wildly different patches of sky,',
    '// so a point sample there is pure noise. Dropping to a coarser mip resolves',
    '// those regions into the smooth average sky instead of speckle. kBlur does',
    '// the same job for the procedural layer.',
    'vec3 sky(vec3 d, float lod, float kBlur) {',
    '  vec3 col = milkyWay(d);',
    '',
    '  vec4 t = textureCube(uSky, d, lod);',
    '  vec3 e = clamp(pow(t.rgb, vec3(2.2)), 0.0, 0.998);',
    '  col += (e / (1.0 - e)) * uSkyMix;',
    '',
    '  // Unresolved stars past the catalogue limit, so the sky is never empty',
    '  float u = atan(d.z, d.x) / PI;',
    '  float v = asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5;',
    '  float k = 90.0 * kBlur;',
    '  vec2 fuv = vec2(u, v) * 140.0;',
    '  vec2 iuv = floor(fuv);',
    '  for (int dx = -1; dx <= 1; dx++) {',
    '    for (int dy = -1; dy <= 1; dy++) {',
    '      vec2 g = iuv + vec2(float(dx), float(dy));',
    '      if (hash(g + 99.0) > 0.93) {',
    '        vec2 sp = g + vec2(hash(g + 11.0), hash(g + 22.0));',
    '        float e2 = length(fuv - sp);',
    '        col += exp(-e2 * e2 * k) * 0.16 * kBlur * mix(vec3(1, .9, .7), vec3(.7, .85, 1), hash(g + 33.0));',
    '      }',
    '    }',
    '  }',
    '',
    '  return col;',
    '}',
    '',
    '// ─── Blackbody colour (Planckian locus, Helland approximation) ───',
    '// Returns linear-light RGB normalised to unit luminance, so the colour',
    '// carries only chromaticity and brightness comes from the T^4 term.',
    'vec3 blackbody(float k) {',
    '  float t = clamp(k, 1000.0, 40000.0) / 100.0;',
    '  float r, g, b;',
    '  if (t <= 66.0) {',
    '    r = 1.0;',
    '    g = 0.3900816 * log(t) - 0.6318414;',
    '  } else {',
    '    r = 1.2929406 * pow(t - 60.0, -0.1332048);',
    '    g = 1.1298909 * pow(t - 60.0, -0.0755148);',
    '  }',
    '  if (t >= 66.0) b = 1.0;',
    '  else if (t <= 19.0) b = 0.0;',
    '  else b = 0.5432068 * log(t - 10.0) - 1.1962148;',
    '',
    '  vec3 c = clamp(vec3(r, g, b), 0.0, 1.0);',
    '  c = pow(c, vec3(2.2));  // sRGB fit -> linear light',
    '  return c / max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-4);',
    '}',
    '',
    '// ─── Accretion disk ───',
    '// g is the total redshift factor (gravitational + relativistic Doppler).',
    '// Since I_obs = g^4 * I_emit and I_emit ~ T_emit^4, the observed',
    '// brightness is simply (g * T_emit)^4 = T_obs^4 — beaming, gravitational',
    '// dimming and the colour shift all fall out of one number.',
    '// Prograde circular orbit angular rate in Kerr. Spin drags the whole disc',
    '// round faster; at a = 0 this is the Schwarzschild sqrt(M/r^3).',
    'float kepler(float r) { return sqrt(MM) / (pow(r, 1.5) + uSpin * sqrt(MM)); }',
    '',
    '// An orbiting hot spot, of the kind Sgr A* flares produce. Returns a bump',
    '// in 0..1 that rides the flow at its own radius, so it beams and redshifts',
    '// through the same g factor as the rest of the disk.',
    'float hotspot(float r, float ang, float sr, float phase, float width) {',
    '  float sa = phase - kepler(sr) * uTime * DISK_SPIN;',
    '  float da = ang - sa;',
    '  da = atan(sin(da), cos(da));',            // wrap to -PI..PI
    '  float dr = (r - sr) / width;',
    '  float dt = da * sr / (width * 2.2);',
    '  return exp(-(dr * dr + dt * dt));',
    '}',
    '',
    'vec3 diskColor(float r, float g, float ang) {',
    '  // Shakura-Sunyaev profile with a zero-torque inner boundary:',
    '  //   T(r) ~ r^(-3/4) * [1 - sqrt(r_in / r)]^(1/4)',
    '  float f = max(1.0 - sqrt(uIsco / r), 0.0);',
    '  float tEmit = T_SCALE * pow(r / uIsco, -0.75) * pow(f, 0.25);',
    '',
    '  // Hot spots raise the local temperature, and since brightness goes as the',
    '  // fourth power they flare hard and blue as they swing toward the camera.',
    '  tEmit *= 1.0 + 0.42 * hotspot(r, ang, uIsco * 1.45, 0.0, uIsco * 0.28)',
    '              + 0.30 * hotspot(r, ang, uIsco * 2.37, 2.4, uIsco * 0.38);',
    '',
    '  float tObs = g * tEmit;',
    '  float bright = pow(tObs / T_SCALE, 4.0);',
    '  vec3 col = blackbody(max(tObs, 900.0)) * bright * DISK_GAIN;',
    '',
    '  // Turbulence. The noise is sampled in the frame co-rotating with the gas,',
    '  // so differential rotation shears it: an eddy is wound into a trailing',
    '  // spiral by the inner disc outrunning the outer.',
    '  //',
    '  // The third axis advances at the local orbital rate, which gives every',
    '  // eddy a lifetime of a fraction of an orbit. Without that the shear',
    '  // accumulates forever and the disk winds itself into infinitely thin',
    '  // stripes; with it, structure forms, shears and dissolves, which is what',
    '  // a real turbulent disc does anyway.',
    '  float w = kepler(r) * DISK_SPIN;',
    '  float ph = ang + w * uTime;',
    '  vec3 q = vec3(cos(ph) * r, sin(ph) * r, w * uTime * 0.64) * 0.62;',
    '  col *= 0.42 + 1.20 * fbm(q, min(uMwOct, 3.0));',
    '  col *= 0.88 + 0.12 * sin(r * 6.0 + 1.7);',
    '',
    '  col *= smoothstep(DISK_OUT, DISK_OUT - 2.5, r);',
    '  return col;',
    '}',
    '',
    '// ─── Kerr geodesic, Hamiltonian form in Boyer-Lindquist ───',
    '// Schwarzschild let us conserve |r x v| and reduce the whole thing to an',
    '// acceleration depending only on position. Kerr has no such shortcut, so this',
    '// integrates the Hamiltonian equations directly.',
    '//',
    '// The metric is stationary and axisymmetric, so E = -p_t and L = p_phi are',
    '// conserved and phi never feeds back into the derivatives: it rides along as a',
    '// quadrature. That leaves four live variables, (r, theta, p_r, p_theta).',
    '//',
    '//   H = (1/2) g^uv p_u p_v = F / (2 Sigma)',
    '//   F = N/Delta + L^2/sin^2(theta) + Delta p_r^2 + p_theta^2',
    '//   N = -A E^2 + 4 M a r E L - a^2 L^2',
    'vec4 kerrRHS(vec4 y, float E, float L, float a, out float dph) {',
    '  float r = y.x, pr = y.z, pth = y.w;',
    '  float sn = sin(y.y), cs = cos(y.y);',
    '  // Keep the SIGN of sin(theta) and only floor its magnitude. An RK4 stage',
    '  // can straddle the pole, and dF/dtheta carries sin to odd powers, so using',
    '  // abs() here silently flips that term and corrupts every ray in the',
    '  // meridian plane: a fan of artefacts straight up the spin axis.',
    '  float s = (sn < 0.0 ? -1.0 : 1.0) * max(abs(sn), 1e-3);',
    '  float ss = s * s;',
    '  float a2 = a * a, r2 = r * r;',
    '  float Sig = r2 + a2 * cs * cs;',
    '  float Del = r2 - 2.0 * MM * r + a2;',
    '  Del = abs(Del) < 1e-7 ? 1e-7 : Del;',
    '  float ra2 = r2 + a2;',
    '  float A = ra2 * ra2 - a2 * Del * ss;',
    '',
    '  float N = -A * E * E + 4.0 * MM * a * r * E * L - a2 * L * L;',
    '  float F = N / Del + L * L / ss + Del * pr * pr + pth * pth;',
    '',
    '  float Delp = 2.0 * r - 2.0 * MM;',
    '  float Ap = 4.0 * r * ra2 - a2 * Delp * ss;',
    '  float Np = -Ap * E * E + 4.0 * MM * a * E * L;',
    '  float dFdr = (Np * Del - N * Delp) / (Del * Del) + Delp * pr * pr;',
    '  float dFdth = 2.0 * a2 * s * cs * E * E - 2.0 * L * L * cs / (s * ss);',
    '',
    '  dph = (2.0 * MM * a * r * E + (Del - a2 * ss) * L / ss) / (Sig * Del);',
    '  return vec4(',
    '    Del * pr / Sig,',
    '    pth / Sig,',
    '    -(dFdr  - 2.0 * r * F / Sig) / (2.0 * Sig),',
    '    -(dFdth + 2.0 * a2 * cs * s * F / Sig) / (2.0 * Sig)',
    '  );',
    '}',
    '',
    'vec3 aces(vec3 x) {',
    '  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);',
    '}',
    '',
    'void main() {',
    '  vec2 frag = gl_FragCoord.xy + uJitter;',
    '  vec2 uv = (frag - 0.5 * uRes) / uRes.y;',
    '',
    '  float a = uSpin;',
    '  float a2 = a * a;',
    '',
    '  // ─── Camera: a ZAMO ───',
    '  // A static observer cannot exist inside the ergosphere, which for a fast',
    '  // spin swallows the ISCO and everything near it, so the camera is instead a',
    '  // zero-angular-momentum observer: the locally non-rotating frame, dragged',
    '  // around with the hole, which stays valid all the way down to the horizon.',
    '  // At a = 0 it is exactly the static observer and nothing changes.',
    '  float rc = uDist, thc = uTheta;',
    '  float snc = sin(thc), csc = cos(thc);',
    '  float Sigc = rc * rc + a2 * csc * csc;',
    '  float Delc = rc * rc - 2.0 * MM * rc + a2;',
    '  float ra2c = rc * rc + a2;',
    '  float Ac = ra2c * ra2c - a2 * Delc * snc * snc;',
    '  float omega = 2.0 * MM * a * rc / Ac;',              // frame dragging rate
    '  float alpha = sqrt(max(Sigc * Delc / Ac, 1e-9));',   // lapse
    '  float varpi = sqrt(Ac / Sigc) * snc;',               // circumferential radius
    '',
    '  // ─── Lens ───',
    '  // Equidistant (fisheye) projection: the angle away from the forward axis is',
    '  // proportional to image radius. Close in the shadow spans more than 90',
    '  // degrees, which a rectilinear lens cannot represent at all, so the field of',
    '  // view opens as you descend and the projection has to follow.',
    '  float rpix = length(uv);',
    '  // Clamped at half a turn: on a very wide canvas at the widest field the',
    '  // corners would otherwise pass 180 degrees and fold back on themselves.',
    '  float ang = min(rpix * uFov, PI);',
    '  vec2 dir2 = rpix > 1e-6 ? uv / rpix : vec2(0.0, 1.0);',
    '  float ca = cos(ang), sa = sin(ang);',
    '',
    '  // Ray direction in the ZAMO orthonormal frame. Normally forward is -e_r,',
    '  // up is -e_theta and right is +e_phi (the way the hole spins). Inside the',
    '  // photon sphere the camera turns to face outward, which is a rotation of a',
    '  // half turn about the up axis, so forward and right both flip.',
    '  float fw = uOutward > 0.5 ? 1.0 : -1.0;',
    '  float nr  = fw * ca;',
    '  float nth = -sa * dir2.y;',
    '  float nph = -fw * sa * dir2.x;',
    '',
    '  // Conserved quantities, normalising the locally measured photon energy to 1.',
    '  //   L = varpi * n_phi,  E = alpha + omega L',
    '  // The omega term is frame dragging showing up directly in the ray setup:',
    '  // which way you look changes the photon energy at infinity.',
    '  float L = varpi * nph;',
    '  float E = alpha + omega * L;',
    '  vec4 y = vec4(rc, thc, nr * sqrt(Sigc / Delc), nth * sqrt(Sigc));',
    '  float ph = uPhi;',
    '',
    '  // Carter constant. Kerr geodesics have a third conserved quantity beyond',
    '  // energy and angular momentum, and it pins the polar motion exactly:',
    '  //   p_theta^2 = Theta(theta) = Q + cos^2(theta) (a^2 E^2 - L^2/sin^2(theta))',
    '  // Re-projecting p_theta onto that curve after every step is what keeps the',
    '  // spin axis stable. Boyer-Lindquist is singular there, and left to itself',
    '  // the integrator either explodes or stalls against a turning point it can',
    '  // never quite resolve, which paints a fan of artefacts up the axis.',
    '  float Qc = y.w * y.w - csc * csc * (a2 * E * E - L * L / (snc * snc));',
    '',
    '  vec3 color = vec3(0.0);',
    '  bool hit = false;',
    '  bool escaped = false;',
    '  float rmin = 1e9;',
    '  float rStop = uHorizon * 1.0006;',
    '',
    '  for (int i = 0; i < STEPS; i++) {',
    '    if (float(i) >= uSteps) break;',
    '    rmin = min(rmin, y.x);',
    '    if (y.x < rStop) { hit = true; break; }',
    '    if (y.x > 90.0) { escaped = true; break; }',
    '',
    '    float d1, d2, d3, d4;',
    '    vec4 k1 = kerrRHS(y, E, L, a, d1);',
    '',
    '    // Step bounded to a fraction of the local radius. Fourth-order accuracy',
    '    // buys much longer steps than the Verlet scheme this replaces, which is',
    '    // what keeps Kerr affordable at four derivative evaluations per step.',
    '    float speed = abs(k1.x) + y.x * abs(k1.y) + 1e-6;',
    '    float dl = clamp(0.055 * y.x / speed, 1e-5, 6.0);',
    '',
    '    // Two extra brakes. Boyer-Lindquist is singular on the polar axis, where',
    '    // the L^2/sin^3 term in dH/dtheta runs away, so never step more than a',
    '    // fraction of the remaining angle to the axis. And never step so far that',
    '    // r could jump straight through the horizon.',
    '    float sTh = max(abs(sin(y.y)), 1e-3);',
    '    dl = min(dl, 1.2 * (sTh + 0.15) / (abs(k1.y) + 1e-9));',
    '    dl = min(dl, 0.45 * max(y.x - uHorizon, 1e-4) / (abs(k1.x) + 1e-9));',
    '    // A ray passing close to the spin axis swings through nearly half a turn',
    '    // of phi in a very short interval: the one genuinely stiff part of',
    '    // Boyer-Lindquist. Capping the phi travelled per step is what resolves it,',
    '    // and it only bites for the handful of steps near the axis.',
    '    dl = min(dl, 0.12 / (abs(d1) + 1e-9));',
    '',
    '    vec4 k2 = kerrRHS(y + 0.5 * dl * k1, E, L, a, d2);',
    '    vec4 k3 = kerrRHS(y + 0.5 * dl * k2, E, L, a, d3);',
    '    vec4 k4 = kerrRHS(y + dl * k3, E, L, a, d4);',
    '    vec4 yn = y + (dl / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);',
    '    float phn = ph + (dl / 6.0) * (d1 + 2.0 * d2 + 2.0 * d3 + d4);',
    '',
    '    // ─── Accretion disk crossing (the equatorial plane, theta = PI/2) ───',
    '    float e0 = y.y - 0.5 * PI, e1 = yn.y - 0.5 * PI;',
    '    if (e0 * e1 < 0.0) {',
    '      float t = e0 / (e0 - e1);',
    '      float rd = mix(y.x, yn.x, t);',
    '',
    '      if (rd > uIsco && rd < DISK_OUT) {',
    '        // Redshift straight from the definition, g = (p.u_obs) / (p.u_emit).',
    '        // The camera side is 1 by our normalisation, and for a circular',
    '        // equatorial orbit p.u reduces to u^t (E - Omega L). This single',
    '        // expression carries gravitational shift, Doppler, beaming and frame',
    '        // dragging at once, and reduces to the Schwarzschild formula at a = 0.',
    '        float Om = kepler(rd);',
    '        float gtt = -(1.0 - 2.0 * MM / rd);',
    '        float gtp = -2.0 * MM * a / rd;',
    '        float gpp = rd * rd + a2 + 2.0 * MM * a2 / rd;',
    '        float den = -(gtt + 2.0 * Om * gtp + Om * Om * gpp);',
    '        float ut = inversesqrt(max(den, 1e-6));',
    '        float g = 1.0 / max(ut * (E - Om * L), 1e-4);',
    '        g = clamp(g, 0.02, 8.0);',
    '',
    '        color = diskColor(rd, g, mix(ph, phn, t));',
    '        hit = true;',
    '        break;',
    '      }',
    '    }',
    '',
    '    // A step that produced a non-finite state means the integrator fell',
    '    // through the horizon or off the axis. NaN fails every comparison, so',
    '    // this test catches it; either way the photon is gone.',
    '    if (!(yn.x > 0.0) || !(yn.y > -100.0)) { hit = true; break; }',
    '',
    '    y = yn;',
    '    ph = phn;',
    '',
    '    // Reflect across the polar axis rather than letting theta run out of',
    '    // range. Exact, because the metric does not depend on phi.',
    '    if (y.y < 0.0) { y.y = -y.y; y.w = -y.w; ph += PI; }',
    '    else if (y.y > PI) { y.y = 2.0 * PI - y.y; y.w = -y.w; ph += PI; }',
    '',
    '    // Snap p_theta back onto the Carter curve, keeping its direction. Theta',
    '    // below zero means the step overshot a turning point, so the ray is placed',
    '    // exactly at it and the next step turns it around.',
    '    float cT = cos(y.y), sT2 = max(abs(sin(y.y)), 1e-4);',
    '    float Th = Qc + cT * cT * (a2 * E * E - L * L / (sT2 * sT2));',
    '    y.w = Th > 0.0 ? sign(y.w) * sqrt(Th) : 0.0;',
    '  }',
    '',
    '  // Background stars, but only for rays that actually reached infinity.',
    '  // A ray that simply ran out of steps is one winding near the photon sphere;',
    '  // its direction is chaotic, so sampling the sky with it speckles the shadow',
    '  // edge. Those photons are captured, so they are drawn black.',
    '  if (!hit && escaped) {',
    '    // Recover an asymptotic cartesian direction from the final BL state.',
    '    float df; vec4 kf = kerrRHS(y, E, L, a, df);',
    '    float sn = sin(y.y), cs = cos(y.y);',
    '    float sp = sin(ph), cp = cos(ph);',
    '    vec3 er = vec3(sn * sp, cs, sn * cp);',
    '    vec3 et = vec3(cs * sp, -sn, cs * cp);',
    '    vec3 ep = vec3(cp, 0.0, -sp);',
    '    vec3 dir = normalize(kf.x * er + y.x * kf.y * et + y.x * sn * df * ep);',
    '',
    '    // Closest approach stands in for magnification: the nearer a ray came to',
    '    // the photon sphere, the more the sky is stretched behind it and the wider',
    '    // the sky has to be filtered to stay resolved.',
    '    float mag = smoothstep(6.0, uHorizon * 1.5, rmin);',
    '    color = sky(dir, mag * 7.0, mix(1.0, 0.008, mag));',
    '',
    '    // The outside universe is blueshifted for an observer down the well. The',
    '    // photon carries energy E at infinity and energy 1 here, so the shift is',
    '    // simply 1/E, and bolometric intensity goes as its fourth power. Because E',
    '    // contains the frame-dragging term, this now depends on which way you are',
    '    // looking: with the spin or against it.',
    '    float gObs = 1.0 / max(E, 1e-4);',
    '    if (gObs > 1.001) {',
    '      color *= blackbody(5500.0 * gObs) / blackbody(5500.0) * pow(gObs, 4.0);',
    '    }',
    '  }',
    '',
    '  // Auto-exposure. Deep in the well the blueshift alone brightens the sky by',
    '  // 1/alpha^4, six orders of magnitude near the horizon: physically right and',
    '  // completely unreadable. This is the eye adapting, and it is the only place',
    '  // the render deliberately departs from raw radiance.',
    '  color *= uExposure;',
    '',
    '#ifdef DIRECT',
    '  color = aces(color);',
    '  gl_FragColor = vec4(pow(color, vec3(1.0 / 2.2)), 1.0);',
    '#else',
    '  vec3 prev = texture2D(uPrev, gl_FragCoord.xy / uRes).rgb;',
    '  gl_FragColor = vec4(mix(prev, color, uBlend), 1.0);',
    '#endif',
    '}'
  ].join('\n');

  // ─── Bright pass: 4-tap box downsample + soft-knee threshold ───
  var brightSrc = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex;',
    'uniform vec2 uTexel;',
    'uniform float uThreshold;',
    'void main() {',
    '  vec3 c = texture2D(uTex, vUv + uTexel * vec2(-0.5, -0.5)).rgb',
    '         + texture2D(uTex, vUv + uTexel * vec2( 0.5, -0.5)).rgb',
    '         + texture2D(uTex, vUv + uTexel * vec2(-0.5,  0.5)).rgb',
    '         + texture2D(uTex, vUv + uTexel * vec2( 0.5,  0.5)).rgb;',
    '  c *= 0.25;',
    '  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));',
    '  float knee = max(lum - uThreshold, 0.0) / max(lum, 1e-4);',
    '  gl_FragColor = vec4(c * knee, 1.0);',
    '}'
  ].join('\n');

  // ─── Separable 9-tap gaussian ───
  var blurSrc = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex;',
    'uniform vec2 uStep;',
    'void main() {',
    '  vec3 c = texture2D(uTex, vUv).rgb * 0.2270270;',
    '  c += (texture2D(uTex, vUv + uStep).rgb + texture2D(uTex, vUv - uStep).rgb) * 0.1945946;',
    '  c += (texture2D(uTex, vUv + uStep * 2.0).rgb + texture2D(uTex, vUv - uStep * 2.0).rgb) * 0.1216216;',
    '  c += (texture2D(uTex, vUv + uStep * 3.0).rgb + texture2D(uTex, vUv - uStep * 3.0).rgb) * 0.0540540;',
    '  c += (texture2D(uTex, vUv + uStep * 4.0).rgb + texture2D(uTex, vUv - uStep * 4.0).rgb) * 0.0162162;',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  // ─── Composite: bloom + ACES filmic tonemap + gamma + dither ───
  var compositeSrc = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uScene;',
    'uniform sampler2D uBloom;',
    'uniform float uBloomStrength;',
    'vec3 aces(vec3 x) {',
    '  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);',
    '}',
    'void main() {',
    '  vec3 c = texture2D(uScene, vUv).rgb;',
    '  c += texture2D(uBloom, vUv).rgb * uBloomStrength;',
    '  c = pow(aces(c), vec3(1.0 / 2.2));',
    '  // Dither to kill banding in the dark sky gradient',
    '  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);',
    '  gl_FragColor = vec4(c + (n - 0.5) / 255.0, 1.0);',
    '}'
  ].join('\n');

  // ─── WebGL helpers ───
  function compile(src, type) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(s), '\n', src);
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function program(fsSrc, defines) {
    var vs = compile(vsSrc, gl.VERTEX_SHADER);
    var fs = compile((defines || '') + fsSrc, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return null;
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(p));
      return null;
    }
    // Cache uniform locations by name
    p.u = {};
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
      p.u[name] = gl.getUniformLocation(p, name);
    }
    return p;
  }

  var sceneProg = program(sceneSrc, hdr ? '' : '#define DIRECT\n');
  if (!sceneProg) return;

  var brightProg = null, blurProg = null, compositeProg = null;
  if (hdr) {
    brightProg = program(brightSrc);
    blurProg = program(blurSrc);
    compositeProg = program(compositeSrc);
    if (!brightProg || !blurProg || !compositeProg) hdr = null;
  }

  // Fullscreen quad
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // ─── Render targets ───
  function makeTarget(w, h) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, hdr.internal, w, h, 0, hdr.format, hdr.type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, hdr.filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, hdr.filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    // Do not let the first accumulation pass sample an uninitialised half-float
    // texture. Firefox on Apple GPUs can expose those texels as NaN; even with a
    // blend weight of 1, the NaN then poisons every accumulated frame and the
    // composite stays black. WebGL normally zero-initialises texture storage,
    // but clearing explicitly also makes the first frame deterministic.
    if (ok) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (ok) return { tex: tex, fbo: fbo, w: w, h: h };
    gl.deleteTexture(tex);
    gl.deleteFramebuffer(fbo);
    return null;
  }

  function freeTarget(t) {
    if (!t) return;
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fbo);
  }

  var accum = [null, null], bloom = [null, null];

  function allocTargets(w, h) {
    freeTarget(accum[0]); freeTarget(accum[1]);
    freeTarget(bloom[0]); freeTarget(bloom[1]);
    accum[0] = makeTarget(w, h);
    accum[1] = makeTarget(w, h);
    var bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2);
    bloom[0] = makeTarget(bw, bh);
    bloom[1] = makeTarget(bw, bh);
    if (!accum[0] || !accum[1] || !bloom[0] || !bloom[1]) {
      // Float FBOs unusable — permanently drop to the direct path
      hdr = null;
      sceneProg = program(sceneSrc, '#define DIRECT\n');
    }
  }

  // ─── Real sky ───
  // 15,598 stars from the HYG catalogue down to magnitude 7, baked into a cube
  // map. A cube map rather than an equirectangular texture because the geodesics
  // sweep the whole sphere: equirect would put a mip seam and a pole singularity
  // right where rays get most strongly deflected.

  // Orientation. The catalogue is in equatorial coordinates and the simulation
  // has the accretion disk in the xz-plane, so we need a rotation between them.
  // It's a free choice, picked to tilt the galactic plane off the disk plane and
  // put the galactic centre in view at the default camera angle.
  function eqVec(raHours, decDeg) {
    var ra = raHours * Math.PI / 12, dec = decDeg * Math.PI / 180;
    return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  }
  function norm(a) {
    var l = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / l, a[1] / l, a[2] / l];
  }
  function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross3(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function reject(a, b) {  // component of a perpendicular to unit b
    var d = dot3(a, b);
    return norm([a[0] - d * b[0], a[1] - d * b[1], a[2] - d * b[2]]);
  }

  var skyBasis = (function () {
    // Galactic frame in equatorial coordinates
    var e1 = eqVec(17.7611, -28.936);        // galactic centre (Sgr A*)
    var e3 = reject(eqVec(12.857, 27.128), e1);  // galactic north pole
    var e2 = cross3(e3, e1);
    // Same frame, where we want it in world coordinates. Order matters: fix the
    // galactic pole first, then place the centre perpendicular to it. Doing it
    // the other way round lets the orthogonalisation drag the pole toward +y,
    // which would lay the Milky Way flat along the accretion disk.
    var w3 = norm([0.50, 0.80, 0.33]);          // pole, ~37 deg off the disk axis
    var w1 = reject([-0.75, 0.0, -0.66], w3);   // centre, ~55 deg left of view
    var w2 = cross3(w3, w1);
    // R = sum(wi * ei^T) maps the equatorial frame onto the world frame
    var R = [];
    for (var i = 0; i < 3; i++)
      for (var j = 0; j < 3; j++)
        R.push(w1[i] * e1[j] + w2[i] * e2[j] + w3[i] * e3[j]);
    return { R: R, galX: w1, galY: w2, galZ: w3 };
  })();

  function rotate(R, v) {
    return [
      R[0] * v[0] + R[1] * v[1] + R[2] * v[2],
      R[3] * v[0] + R[4] * v[1] + R[5] * v[2],
      R[6] * v[0] + R[7] * v[1] + R[8] * v[2]
    ];
  }

  // B-V colour index to effective temperature (Ballesteros 2012). Exact enough
  // that B-V = 0.65 lands on 5778 K for a solar analogue.
  function bvToKelvin(bv) {
    return 4600 * (1 / (0.92 * bv + 1.70) + 1 / (0.92 * bv + 0.62));
  }

  // Same Planckian-locus fit the shader uses, normalised to unit luminance
  function blackbodyRGB(k) {
    var t = Math.min(Math.max(k, 1000), 40000) / 100, r, g, b;
    if (t <= 66) { r = 1; g = 0.3900816 * Math.log(t) - 0.6318414; }
    else { r = 1.2929406 * Math.pow(t - 60, -0.1332048); g = 1.1298909 * Math.pow(t - 60, -0.0755148); }
    if (t >= 66) b = 1;
    else if (t <= 19) b = 0;
    else b = 0.5432068 * Math.log(t - 10) - 1.1962148;
    var c = [r, g, b].map(function (x) { return Math.pow(Math.min(Math.max(x, 0), 1), 2.2); });
    var y = Math.max(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], 1e-4);
    return [c[0] / y, c[1] / y, c[2] / y];
  }

  var FACE_AXES = [
    // [target, right, up, forward] in the cube map's coordinate convention
    [gl.TEXTURE_CUBE_MAP_POSITIVE_X, [0, 0, -1], [0, -1, 0], [1, 0, 0]],
    [gl.TEXTURE_CUBE_MAP_NEGATIVE_X, [0, 0, 1], [0, -1, 0], [-1, 0, 0]],
    [gl.TEXTURE_CUBE_MAP_POSITIVE_Y, [1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, [1, 0, 0], [0, 0, -1], [0, -1, 0]],
    [gl.TEXTURE_CUBE_MAP_POSITIVE_Z, [1, 0, 0], [0, -1, 0], [0, 0, 1]],
    [gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, [-1, 0, 0], [0, -1, 0], [0, 0, -1]]
  ];

  var skyTex = gl.createTexture();
  var skyMix = 0;

  (function initSkyPlaceholder() {
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyTex);
    var px = new Uint8Array([0, 0, 0, 255]);
    for (var i = 0; i < 6; i++)
      gl.texImage2D(FACE_AXES[i][0], 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  })();

  function buildSky(buffer) {
    var view = new DataView(buffer);
    if (view.byteLength < 8 ||
        String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)) !== 'SKY1')
      throw new Error('bad star catalogue header');
    var count = view.getUint32(4, true);

    var maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    var small = Math.min(screen.width, screen.height) <= 500;
    var N = (maxTex >= 2048 && !small) ? 1024 : 512;   // 6 x N^2 x 4 bytes

    // Reinhard-encode so a single byte spans Sirius to the catalogue limit.
    // Stars are stored with max() rather than sum: overlaps within a texel are
    // rare enough that the difference is invisible, and it avoids a 100 MB
    // float accumulation buffer.
    var SIGMA = 0.62, RAD = 2, SCALE = 0.4;
    var faces = [];
    for (var f = 0; f < 6; f++) faces.push(new Uint8Array(N * N * 4));

    for (var s = 0; s < count; s++) {
      var o = 8 + s * 6;
      var ra = view.getUint16(o, true) / 65536 * 24;
      var dec = view.getInt16(o + 2, true) / 32767 * 90;
      var mag = view.getUint8(o + 4) / 24 - 2;
      var bv = view.getUint8(o + 5) / 80 - 0.5;

      var d = rotate(skyBasis.R, eqVec(ra, dec));
      var amp = SCALE * Math.pow(10, -0.4 * mag);
      var rgb = blackbodyRGB(bvToKelvin(bv));

      for (var fi = 0; fi < 6; fi++) {
        var ax = FACE_AXES[fi];
        var fw = dot3(d, ax[3]);
        if (fw <= 1e-3) continue;                       // behind this face
        var sc = dot3(d, ax[1]) / fw, tc = dot3(d, ax[2]) / fw;
        var px2 = (sc * 0.5 + 0.5) * N, py = (tc * 0.5 + 0.5) * N;
        if (px2 < -RAD || px2 > N + RAD || py < -RAD || py > N + RAD) continue;

        for (var yy = Math.floor(py - RAD); yy <= py + RAD; yy++) {
          if (yy < 0 || yy >= N) continue;
          for (var xx = Math.floor(px2 - RAD); xx <= px2 + RAD; xx++) {
            if (xx < 0 || xx >= N) continue;
            var du = xx + 0.5 - px2, dv = yy + 0.5 - py;
            var w = Math.exp(-(du * du + dv * dv) / (2 * SIGMA * SIGMA));
            if (w < 0.004) continue;
            var base = (yy * N + xx) * 4, buf = faces[fi];
            for (var c = 0; c < 3; c++) {
              var lin = rgb[c] * amp * w;
              var enc = Math.pow(lin / (1 + lin), 1 / 2.2) * 255;
              if (enc > buf[base + c]) buf[base + c] = enc;
            }
            buf[base + 3] = 255;
          }
        }
      }
    }

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyTex);
    for (var g2 = 0; g2 < 6; g2++)
      gl.texImage2D(FACE_AXES[g2][0], 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, faces[g2]);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    skyMix = 1;
    resetAccum();
    return count;
  }

  fetch('/data/stars.bin')
    .then(function (r) {
      if (!r.ok) throw new Error('stars.bin ' + r.status);
      return r.arrayBuffer();
    })
    .then(buildSky)
    .catch(function (e) {
      // Sky falls back to the Milky Way plus the procedural faint layer
      console.warn('black hole: star catalogue unavailable,', e.message);
    });

  // ─── State ───
  var camDist = 40.0, camDistTarget = 40.0;
  var camTheta = 1.484, camThetaTarget = 1.484;  // ~85° from pole
  var camPhi = 0.0, camPhiTarget = 0.0;
  var time = 0;
  var accumFrames = 0;
  var lastCam = [0, 0, 0];
  var running = true, visible = true, onScreen = true;
  var sliderShown = -1;
  var motionPx = 0;
  var idleTime = 0;
  var AUTO_ORBIT_DELAY = 12;    // seconds of no interaction before drifting
  var AUTO_ORBIT_RATE = 0.025;  // rad/s, about four minutes per revolution
  var halfFov = 0.3217;         // vertical half field of view, radians
  var hudShown = '';

  function interacted() { idleTime = 0; }

  // ─── Kerr geometry ───
  // Geometric units with M = 0.5, so Rs = 2M = 1 and every distance on screen
  // stays in Schwarzschild radii. Spin a runs 0 .. M, reported as a* = a/M.
  var GM = 0.5;
  var B_CRIT = 3 * Math.sqrt(3) * GM;     // critical impact parameter, 2.598 Rs
  var FOV_MIN = Math.atan(0.5 / 1.5);     // 18.4 deg, the original framing
  var FOV_MAX = 1.62;                     // 93 deg
  var SPIN_MAX = 0.998;                   // Thorne limit for an accreting hole
  // Closest approach is limited by two different things, and whichever binds
  // first wins. Delta going to zero is where Boyer-Lindquist loses conditioning.
  // Separately the integrator needs enough coordinate room above the horizon to
  // climb out inside its step budget, and for a slow spin r+ and r- nearly
  // coincide, so the same Delta leaves a far smaller gap. Spin buys depth: at
  // a* = 0 this bottoms out around 10 minutes per minute, at the Thorne limit
  // around 22, and the difference is the gap, not the arithmetic.
  var DELTA_FLOOR = 0.002;
  var GAP_FLOOR = 0.01;

  var spinStar = 0;                       // a*
  var spinA = 0;                          // a
  var rHorizon = 1, rIsco = 3, rPhoton = 1.5;
  var MIN_DIST = 1.01, MAX_DIST = 40.0;

  function horizonAt(a) { return GM + Math.sqrt(Math.max(GM * GM - a * a, 0)); }

  function iscoAt(a) {
    var x = a / GM;
    var Z1 = 1 + Math.cbrt(1 - x * x) * (Math.cbrt(1 + x) + Math.cbrt(1 - x));
    var Z2 = Math.sqrt(3 * x * x + Z1 * Z1);
    return GM * (3 + Z2 - Math.sqrt(Math.max((3 - Z1) * (3 + Z1 + 2 * Z2), 0)));
  }

  // ZAMO lapse. This is the camera's clock rate against a clock at infinity, and
  // for a = 0 it collapses to the familiar sqrt(1 - Rs/r).
  function lapseAt(r, th, a) {
    var c = Math.cos(th), s = Math.sin(th);
    var Sig = r * r + a * a * c * c;
    var Del = r * r - 2 * GM * r + a * a;
    var A = (r * r + a * a) * (r * r + a * a) - a * a * Del * s * s;
    return Math.sqrt(Math.max(Sig * Del / A, 0));
  }

  // Circumferential radius of the ZAMO's ring
  function varpiAt(r, th, a) {
    var c = Math.cos(th), s = Math.sin(th);
    var Sig = r * r + a * a * c * c;
    var Del = r * r - 2 * GM * r + a * a;
    var A = (r * r + a * a) * (r * r + a * a) - a * a * Del * s * s;
    return Math.sqrt(A / Sig) * s;
  }

  // Proper acceleration of the ZAMO, which is the thrust needed to hold station.
  // For any stationary axisymmetric metric this is just grad(ln alpha), and at
  // a = 0 it reproduces the textbook GM/r^2 / sqrt(1 - Rs/r) exactly.
  function properAccel(r, th, a) {
    // Step scaled to the gap above the horizon. A fixed step straddles it near
    // the horizon, where lapseAt returns zero, and log(0) makes the readout
    // report an infinite thrust.
    var h = Math.min(1e-4, 0.05 * Math.max(r - horizonAt(a), 1e-6));
    var dr = (Math.log(lapseAt(r + h, th, a)) - Math.log(lapseAt(r - h, th, a))) / (2 * h);
    var dt = (Math.log(lapseAt(r, th + h, a)) - Math.log(lapseAt(r, th - h, a))) / (2 * h);
    var c = Math.cos(th);
    var Sig = r * r + a * a * c * c;
    var Del = r * r - 2 * GM * r + a * a;
    var v = Math.sqrt(Math.max((Del / Sig) * dr * dr + dt * dt / Sig, 0));
    return isFinite(v) ? v : 0;
  }

  // Angular radius of the shadow, as sin(theta) = b_crit * alpha / varpi. Exact
  // in Schwarzschild, and a good enough approximation in Kerr to drive framing
  // (the real Kerr shadow is not a circle, so no single radius describes it).
  function shadowRadius(r) {
    var s = B_CRIT * lapseAt(r, Math.PI / 2, spinA) / varpiAt(r, Math.PI / 2, spinA);
    var ang = Math.asin(Math.min(s, 1));
    return r >= rPhoton ? ang : Math.PI - ang;
  }
  // Past the photon sphere the shadow covers more than half the sky, so looking
  // at the hole shows nothing but black. The escape cone is behind you by then,
  // and the framing follows whichever boundary is cheaper to see: the shadow
  // edge ahead, or the same edge seen over your shoulder.
  function lookOutward(r) { return shadowRadius(r) > Math.PI / 2; }
  function halfFovAt(r) {
    var th = shadowRadius(r);
    return Math.min(FOV_MAX, Math.max(FOV_MIN, Math.min(th, Math.PI - th) * 1.9));
  }

  // ─── Mass ───
  // Nothing below changes a single pixel. The render is scale free: lensing,
  // shadow shape and time dilation all depend only on r/Rs. Mass sets the
  // conversion to human units, and nothing else.
  var MASSES = [
    { id: 'stellar', label: '10 solar masses', msun: 10 },
    { id: 'sgra', label: 'Sgr A*', msun: 4.3e6 },
    { id: 'm87', label: 'M87*', msun: 6.5e9 }
  ];
  var massIndex = 2;
  function rsMetres() { return 2 * 6.674e-11 * MASSES[massIndex].msun * 1.989e30 / (2.998e8 * 2.998e8); }
  function hoverG(r, th) { return properAccel(r, th, spinA) * 8.98755e16 / (rsMetres() * 9.80665); }

  function setSpin(aStar) {
    spinStar = Math.max(0, Math.min(SPIN_MAX, aStar));
    spinA = spinStar * GM;
    rHorizon = horizonAt(spinA);
    rIsco = iscoAt(spinA);
    // Photon sphere proxy: where the shadow's angular radius peaks, which is the
    // branch point between an acute and an obtuse shadow.
    var best = -1, bestR = rHorizon * 1.01;
    for (var i = 0; i < 400; i++) {
      var r = rHorizon * 1.002 + i * 0.01;
      var v = lapseAt(r, Math.PI / 2, spinA) / varpiAt(r, Math.PI / 2, spinA);
      if (v > best) { best = v; bestR = r; }
    }
    rPhoton = bestR;
    // Closest approach is set by Delta, not by radius. Delta = r^2 - 2Mr + a^2
    // vanishes at the horizon and Boyer-Lindquist degenerates with it, so the
    // floor is the radius where Delta is still 0.01. That lands at 1.01 Rs for a
    // non-rotating hole and 0.60 Rs at the Thorne limit, and both give about ten
    // minutes of dilation per minute here: the same payoff, from either geometry.
    MIN_DIST = Math.max(
      0.5 * (1 + Math.sqrt(Math.max(1 - 4 * (spinA * spinA - DELTA_FLOOR), 0))),
      rHorizon + GAP_FLOOR);
    camDistTarget = Math.max(MIN_DIST, Math.min(MAX_DIST, camDistTarget));
    camDist = Math.max(MIN_DIST, Math.min(MAX_DIST, camDist));
    resetAccum();
  }

  function formatDuration(sec) {
    if (sec < 3600) {
      var m = Math.floor(sec / 60), s = sec - m * 60;
      return m + 'm ' + (s < 10 ? '0' : '') + s.toFixed(0) + 's';
    }
    if (sec < 86400) return (sec / 3600).toFixed(1) + ' hours';
    if (sec < 31557600) return (sec / 86400).toFixed(1) + ' days';
    return (sec / 31557600).toFixed(1) + ' years';
  }

  var MAX_PIXELS = 2.2e6;
  var maxScale = Math.min(window.devicePixelRatio || 1, 2);
  var scale = maxScale;
  var cssW = 0, cssH = 0;

  // Golden-ratio (R2) low-discrepancy sequence for sub-pixel jitter
  function jitter(i) {
    return [
      (((i + 1) * 0.7548776662466927) % 1) - 0.5,
      (((i + 1) * 0.5698402909980532) % 1) - 0.5
    ];
  }

  function resetAccum() { accumFrames = 0; }

  // ─── Resize ───
  function resize() {
    cssW = wrap.clientWidth;
    cssH = document.fullscreenElement === wrap
      ? wrap.clientHeight
      : Math.min(cssW * 0.65, 560);
    if (cssW <= 0 || cssH <= 0) return;

    var s = scale;
    if (cssW * cssH * s * s > MAX_PIXELS) s = Math.sqrt(MAX_PIXELS / (cssW * cssH));

    var w = Math.max(1, Math.round(cssW * s));
    var h = Math.max(1, Math.round(cssH * s));
    if (canvas.width === w && canvas.height === h) return;

    canvas.width = w;
    canvas.height = h;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    if (hdr) allocTargets(w, h);
    resetAccum();
  }

  // ─── Pointer drag + pinch ───
  var pointers = {}, dragging = false;
  var dragX = 0, dragY = 0, dragT0 = 0, dragP0 = 0, pinchD0 = 0, pinchDist0 = 0;

  function pointerList() {
    var out = [];
    for (var k in pointers) if (pointers.hasOwnProperty(k)) out.push(pointers[k]);
    return out;
  }

  function beginDrag(x, y) {
    interacted();
    dragging = true;
    dragX = x; dragY = y;
    dragT0 = camThetaTarget; dragP0 = camPhiTarget;
  }

  function moveDrag(x, y) {
    interacted();
    camThetaTarget = Math.max(0.05, Math.min(Math.PI * 0.495, dragT0 + (y - dragY) * 0.005));
    camPhiTarget = dragP0 - (x - dragX) * 0.005;
  }

  function setDist(d) {
    interacted();
    camDistTarget = Math.max(MIN_DIST, Math.min(MAX_DIST, d));
  }

  if (window.PointerEvent) {
    canvas.addEventListener('pointerdown', function (e) {
      canvas.setPointerCapture(e.pointerId);
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ps = pointerList();
      if (ps.length === 1) beginDrag(e.clientX, e.clientY);
      else if (ps.length === 2) {
        pinchD0 = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        pinchDist0 = camDistTarget;
        dragging = false;
      }
      canvas.focus();
      e.preventDefault();
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId].x = e.clientX;
      pointers[e.pointerId].y = e.clientY;
      var ps = pointerList();
      if (ps.length >= 2) {
        var d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        if (pinchD0 > 0) setDist(pinchDist0 * pinchD0 / Math.max(d, 1));
      } else if (dragging) {
        moveDrag(e.clientX, e.clientY);
      }
      e.preventDefault();
    });

    function endPointer(e) {
      delete pointers[e.pointerId];
      var ps = pointerList();
      if (ps.length === 1) beginDrag(ps[0].x, ps[0].y);
      else if (ps.length === 0) dragging = false;
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
  } else {
    // Legacy mouse/touch fallback
    canvas.addEventListener('mousedown', function (e) {
      beginDrag(e.clientX, e.clientY); canvas.focus(); e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (dragging) moveDrag(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', function () { dragging = false; });
    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      beginDrag(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      if (!dragging || e.touches.length !== 1) return;
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', function () { dragging = false; });
  }

  // ─── Wheel zoom ───
  canvas.addEventListener('wheel', function (e) {
    var d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    setDist(camDistTarget * Math.exp(d * 0.0012));
    e.preventDefault();
  }, { passive: false });

  // ─── Distance slider ───
  // Logarithmic, because the interesting range is compressed against the
  // horizon: half the travel covers the last radius before it.
  function sliderToDist(v) {
    return MIN_DIST * Math.pow(MAX_DIST / MIN_DIST, v / 1000);
  }
  function distToSlider(d) {
    return Math.round(1000 * Math.log(d / MIN_DIST) / Math.log(MAX_DIST / MIN_DIST));
  }
  slider.addEventListener('input', function () {
    setDist(sliderToDist(parseInt(slider.value, 10)));
  });

  // ─── Keyboard (scoped to the canvas, so arrows still scroll the page) ───
  var keys = {};
  canvas.addEventListener('keydown', function (e) {
    interacted();
    keys[e.key] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) >= 0)
      e.preventDefault();
  });
  canvas.addEventListener('keyup', function (e) { keys[e.key] = false; });
  canvas.addEventListener('blur', function () { keys = {}; });

  // ─── Fullscreen ───
  if (fsButton) {
    if (!wrap.requestFullscreen) {
      fsButton.hidden = true;
    } else {
      fsButton.addEventListener('click', function () {
        if (document.fullscreenElement === wrap) document.exitFullscreen();
        else wrap.requestFullscreen();
      });
      document.addEventListener('fullscreenchange', function () {
        var on = document.fullscreenElement === wrap;
        wrap.classList.toggle('is-fullscreen', on);
        fsButton.setAttribute('aria-pressed', on ? 'true' : 'false');
        resize();
      });
    }
  }

  // ─── Pause when off-screen or hidden ───
  function updateRunning() {
    var next = visible && onScreen;
    if (next && !running) { running = true; last = 0; requestAnimationFrame(frame); }
    running = next;
  }
  document.addEventListener('visibilitychange', function () {
    visible = !document.hidden;
    updateRunning();
  });
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      updateRunning();
    }, { threshold: 0 }).observe(canvas);
  }

  canvas.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    running = false;
  });

  // ─── Adaptive quality ───
  // One knob in [0,1]. The Kerr integrator is four derivative evaluations per
  // step and dominates everything else, so the step budget is the first thing
  // traded away, then resolution, then the noise octaves. Dropping steps costs a
  // slightly thicker shadow edge (rays that run out are treated as captured),
  // which is cheaper visually than the aliasing that a big resolution cut brings.
  var perf = 1, frameMs = 16, tuneCooldown = 0;

  function stepBudget() { return Math.round(90 + 110 * perf); }
  function mwOctaves() { return perf > 0.55 ? 4 : 2; }
  function targetScale() { return maxScale * (0.45 + 0.55 * perf); }

  function tuneQuality(dtMs) {
    frameMs += (dtMs - frameMs) * 0.05;
    if (tuneCooldown > 0) { tuneCooldown--; return; }
    var next = perf;
    if (frameMs > 26) next = Math.max(0, perf - 0.2);
    else if (frameMs < 11) next = Math.min(1, perf + 0.1);
    if (next === perf) return;
    perf = next;
    tuneCooldown = 90;
    frameMs = 16;
    scale = targetScale();
    resize();
  }

  // ─── Draw passes ───
  function bindTarget(t) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
    gl.viewport(0, 0, t ? t.w : canvas.width, t ? t.h : canvas.height);
  }

  function draw() { gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }

  function renderScene() {
    var jt = jitter(accumFrames);
    gl.useProgram(sceneProg);
    var u = sceneProg.u;
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uDist, camDist);
    gl.uniform1f(u.uTheta, camTheta);
    gl.uniform1f(u.uPhi, camPhi);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uFov, halfFov * 2);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyTex);
    gl.uniform1i(u.uSky, 2);
    gl.uniform1f(u.uSkyMix, skyMix);
    gl.uniform3fv(u.uGalX, skyBasis.galX);
    gl.uniform3fv(u.uGalY, skyBasis.galY);
    gl.uniform3fv(u.uGalZ, skyBasis.galZ);
    gl.uniform1f(u.uSpin, spinA);
    gl.uniform1f(u.uIsco, rIsco);
    gl.uniform1f(u.uHorizon, rHorizon);
    gl.uniform1f(u.uOutward, lookOutward(camDist) ? 1 : 0);
    // Show the blueshift brightening honestly up to 30x, then hold. Without this
    // the last radius before the horizon is a featureless white screen.
    var gRef = Math.pow(1 / Math.max(lapseAt(camDist, camTheta, spinA), 1e-4), 4);
    gl.uniform1f(u.uExposure, 1 / Math.max(1, gRef / 30));
    gl.uniform1f(u.uSteps, stepBudget());
    gl.uniform1f(u.uMwOct, mwOctaves());
    gl.activeTexture(gl.TEXTURE0);

    if (!hdr) {
      gl.uniform2f(u.uJitter, 0, 0);
      bindTarget(null);
      draw();
      return;
    }

    // Exponential moving average with a floor, so the image converges to a
    // ~16-sample anti-aliased render while the disk keeps animating. The floor
    // tracks how far the image slid this frame: accumulation can only average
    // frames that line up, so a still camera converges deeply while a drag
    // shortens the history to whatever stays sharp.
    var floorBlend = Math.min(1, Math.max(1 / 16, motionPx * 0.9));
    var blend = accumFrames === 0 ? 1.0 : Math.max(1 / (accumFrames + 1), floorBlend);
    gl.uniform2f(u.uJitter, jt[0], jt[1]);
    gl.uniform1f(u.uBlend, blend);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, accum[0].tex);
    gl.uniform1i(u.uPrev, 0);

    bindTarget(accum[1]);
    draw();

    var tmp = accum[0]; accum[0] = accum[1]; accum[1] = tmp;
    accumFrames++;

    // Bloom: bright pass -> horizontal blur -> vertical blur
    gl.useProgram(brightProg);
    gl.bindTexture(gl.TEXTURE_2D, accum[0].tex);
    gl.uniform1i(brightProg.u.uTex, 0);
    gl.uniform2f(brightProg.u.uTexel, 1 / canvas.width, 1 / canvas.height);
    gl.uniform1f(brightProg.u.uThreshold, 1.3);
    bindTarget(bloom[0]);
    draw();

    gl.useProgram(blurProg);
    gl.uniform1i(blurProg.u.uTex, 0);
    gl.bindTexture(gl.TEXTURE_2D, bloom[0].tex);
    gl.uniform2f(blurProg.u.uStep, 1 / bloom[0].w, 0);
    bindTarget(bloom[1]);
    draw();

    gl.bindTexture(gl.TEXTURE_2D, bloom[1].tex);
    gl.uniform2f(blurProg.u.uStep, 0, 1 / bloom[1].h);
    bindTarget(bloom[0]);
    draw();

    // Composite
    gl.useProgram(compositeProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, accum[0].tex);
    gl.uniform1i(compositeProg.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bloom[0].tex);
    gl.uniform1i(compositeProg.u.uBloom, 1);
    gl.uniform1f(compositeProg.u.uBloomStrength, 0.3);
    bindTarget(null);
    draw();
    gl.activeTexture(gl.TEXTURE0);
  }

  // ─── Render loop ───
  var last = 0;

  function frame(now) {
    if (!running) return;
    var dtMs = last ? Math.min(now - last, 100) : 16;
    last = now;
    var dt = dtMs / 1000;

    // Keyboard: arrows control distance and orbit
    if (keys['ArrowUp']) setDist(camDistTarget - 12.0 * dt);
    if (keys['ArrowDown']) setDist(camDistTarget + 12.0 * dt);
    if (keys['ArrowLeft']) camPhiTarget += 1.5 * dt;
    if (keys['ArrowRight']) camPhiTarget -= 1.5 * dt;

    // Idle drift, so the page has some life without demanding interaction.
    // Slow enough that the accumulation still averages several frames.
    idleTime += dt;
    if (!reduceMotion && idleTime > AUTO_ORBIT_DELAY)
      camPhiTarget -= AUTO_ORBIT_RATE * Math.min(1, (idleTime - AUTO_ORBIT_DELAY) / 3) * dt;

    // Smooth interpolation
    var k = Math.min(1, 6 * dt);
    camDist += (camDistTarget - camDist) * k;
    camTheta += (camThetaTarget - camTheta) * k;
    camPhi += (camPhiTarget - camPhi) * k;

    // How far the image slid this frame, in pixels, which sets how much
    // accumulation history is still valid.
    var dTheta = camTheta - lastCam[1];
    var dPhi = (camPhi - lastCam[2]) * Math.sin(camTheta);
    var dDist = (camDist - lastCam[0]) / Math.max(camDist, 1e-3);
    lastCam[0] = camDist; lastCam[1] = camTheta; lastCam[2] = camPhi;
    halfFov = halfFovAt(camDist);
    motionPx = (Math.hypot(dTheta, dPhi) + Math.abs(dDist) * 0.5) / (halfFov * 2) * canvas.height;

    // Sync slider (only on change — writing every frame forces layout)
    var sv = distToSlider(camDist);
    if (sv !== sliderShown) { slider.value = sv; sliderShown = sv; }

    if (!reduceMotion) time += dt;

    // HUD. Only touch the DOM when a rendered value actually changes.
    var dil = lapseAt(camDist, camTheta, spinA);
    var g = hoverG(camDist, camTheta);
    var next = camDist.toFixed(3) + '|' + dil.toFixed(4) + '|' +
      Math.round(camTheta * 180 / Math.PI) + '|' + Math.round(halfFov * 360 / Math.PI) +
      '|' + spinStar.toFixed(3) + '|' + massIndex;
    if (next !== hudShown) {
      hudShown = next;
      hudDistance.textContent = (camDist < 10 ? camDist.toFixed(2) : camDist.toFixed(1)) + ' Rs';
      hudDilation.textContent = dil.toFixed(4);
      hudClock.textContent = formatDuration(60 / Math.max(dil, 1e-6)) + ' out there';
      hudAngle.textContent = Math.round(camTheta * 180 / Math.PI) + '°';
      hudFov.textContent = Math.round(halfFov * 360 / Math.PI) + '°';
      hudThrust.textContent = g < 10 ? g.toFixed(1) + ' g'
        : g < 1e5 ? Math.round(g).toLocaleString() + ' g'
        : g.toExponential(1).replace('e+', ' \u00d7 10^') + ' g';
      hudNote.textContent = lookOutward(camDist)
        ? 'past the photon sphere: turned around, the hole is behind you'
        : camDist < rIsco ? 'inside the ISCO: no stable orbit here' : '';
    }

    // With motion suppressed and the camera still, the image converges and
    // there is nothing left to draw.
    var converged = reduceMotion && accumFrames > 48;
    if (!converged) renderScene();

    tuneQuality(dtMs);
    requestAnimationFrame(frame);
  }

  // ─── Spin and mass controls ───
  function refreshLabels() {
    spinLabel.innerHTML = 'a* ' + spinStar.toFixed(3) +
      ' &middot; ISCO ' + rIsco.toFixed(2) + ' Rs' +
      ' &middot; horizon ' + rHorizon.toFixed(2) + ' Rs';
    distMinLabel.textContent = MIN_DIST.toFixed(2) + ' Rs';
    hudShown = '';
  }

  if (spinSlider) {
    spinSlider.addEventListener('input', function () {
      interacted();
      setSpin(parseInt(spinSlider.value, 10) / 1000);
      refreshLabels();
      sliderShown = -1;
    });
  }
  if (massSelect) {
    massSelect.addEventListener('change', function () {
      interacted();
      massIndex = parseInt(massSelect.value, 10) || 0;
      hudShown = '';
    });
  }

  // ─── Init ───
  canvas.setAttribute('tabindex', '0');

  // highp is only guaranteed 2^-16 by the GLSL ES spec, not IEEE single. Below
  // 23 bits the near-horizon arithmetic is not trustworthy at any spin, so stay
  // further out rather than render something quietly wrong.
  var precFmt = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  var weakPrecision = !precFmt || precFmt.precision < 23;
  if (weakPrecision) {
    DELTA_FLOOR = 0.02;
    GAP_FLOOR = 0.05;
    console.warn('black hole: highp is ' + (precFmt ? precFmt.precision : '?') +
      ' bits, holding further from the horizon');
  }

  // Open conservatively on anything phone-shaped or precision-limited. The
  // controller raises quality within a second or two if the device copes, which
  // beats opening at full quality and stuttering through the first impression.
  if (weakPrecision || Math.min(screen.width, screen.height) <= 500) {
    perf = 0.35;
    scale = targetScale();
  }

  setSpin(0);
  refreshLabels();
  resize();

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  requestAnimationFrame(frame);
})();
