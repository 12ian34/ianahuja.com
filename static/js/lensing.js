(function () {
  'use strict';

  var canvas = document.getElementById('lens-canvas');
  if (!canvas) return;

  var stage = canvas.parentElement;
  var wrap = stage.parentElement;
  var overlay = document.getElementById('lens-overlay');
  var ctx2d = overlay.getContext('2d');

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
      'your browser needs WebGL to render this lens</p>';
    return;
  }
  var aniso = gl.getExtension('EXT_texture_filter_anisotropic') ||
    gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');

  // ─── DOM ───
  var $ = function (id) { return document.getElementById(id); };
  var lensSelect = $('lens-model');
  var sourceSelect = $('lens-source');
  var thetaSlider = $('lens-theta');
  var thetaLabel = $('lens-theta-label');
  var ellipSlider = $('lens-ellip');
  var ellipLabel = $('lens-ellip-label');
  var angleSlider = $('lens-angle');
  var angleLabel = $('lens-angle-label');
  var shearSlider = $('lens-shear');
  var shearLabel = $('lens-shear-label');
  var sizeSlider = $('lens-size');
  var sizeLabel = $('lens-size-label');
  var critToggle = $('lens-crit');
  var caustToggle = $('lens-caust');
  var ghostToggle = $('lens-ghost');
  var galToggle = $('lens-gal');
  var playButton = $('lens-play');
  var randomButton = $('lens-random');
  var fsButton = $('lens-fullscreen');
  var credit = $('lens-credit');

  var hudTheta = $('hud-theta');
  var hudMass = $('hud-mass');
  var hudSigma = $('hud-sigma');
  var hudSigmaRow = $('hud-sigma-row');
  var hudMag = $('hud-mag');
  var hudFov = $('hud-fov');
  var hudZl = $('hud-zl');
  var hudZs = $('hud-zs');
  var hudCursor = $('hud-cursor');
  var hudNote = $('hud-note');

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Sources ───
  // size: angular height of the image, in units where the canvas half-height
  // is 1, for an einstein radius of 0.35. Credits are the ESA/Hubble credit
  // lines (CC BY 4.0).
  var SOURCES = {
    m51: { name: 'whirlpool galaxy (m51)', file: 'm51.webp', size: 0.5,
      credit: 'NASA, ESA, S. Beckwith (STScI), and the Hubble Heritage Team (STScI/AURA)',
      url: 'https://esahubble.org/images/heic0506a/' },
    ngc1300: { name: 'ngc 1300', file: 'ngc1300.webp', size: 0.45,
      credit: 'NASA, ESA, and the Hubble Heritage Team (STScI/AURA)',
      url: 'https://esahubble.org/images/opo0501a/' },
    m101: { name: 'pinwheel galaxy (m101)', file: 'm101.webp', size: 0.5,
      credit: 'ESA and NASA',
      url: 'https://esahubble.org/images/heic0602a/' },
    m81: { name: 'bode’s galaxy (m81)', file: 'm81.webp', size: 0.5,
      credit: 'NASA, ESA and the Hubble Heritage Team (STScI/AURA). Acknowledgment: A. Zezas and J. Huchra (Harvard-Smithsonian Center for Astrophysics)',
      url: 'https://esahubble.org/images/heic0710a/' },
    m106: { name: 'messier 106', file: 'm106.webp', size: 0.5,
      credit: 'NASA, ESA, the Hubble Heritage Team (STScI/AURA), and R. Gendler (for the Hubble Heritage Team). Acknowledgment: J. GaBany',
      url: 'https://esahubble.org/images/heic1302a/' },
    sombrero: { name: 'sombrero galaxy (m104)', file: 'sombrero.webp', size: 0.45,
      credit: 'NASA/ESA and the Hubble Heritage Team (STScI/AURA)',
      url: 'https://esahubble.org/images/opo0328a/' },
    m82: { name: 'cigar galaxy (m82)', file: 'm82.webp', size: 0.5,
      credit: 'NASA, ESA and the Hubble Heritage Team (STScI/AURA). Acknowledgment: J. Gallagher (University of Wisconsin), M. Mountain (STScI) and P. Puxley (NSF)',
      url: 'https://esahubble.org/images/heic0604a/' },
    antennae: { name: 'antennae galaxies', file: 'antennae.webp', size: 0.55,
      credit: 'NASA, ESA, and the Hubble Heritage Team (STScI/AURA)-ESA/Hubble Collaboration',
      url: 'https://esahubble.org/images/heic0615a/' },
    ngc2207: { name: 'ngc 2207 and ic 2163', file: 'ngc2207.webp', size: 0.45,
      credit: 'NASA/ESA and the Hubble Heritage Team (STScI)',
      url: 'https://esahubble.org/images/opo9941a/' },
    arp273: { name: 'arp 273', file: 'arp273.webp', size: 0.55,
      credit: 'NASA, ESA and the Hubble Heritage Team (STScI/AURA)',
      url: 'https://esahubble.org/images/heic1107a/' },
    stephan: { name: 'stephan’s quintet', file: 'stephan.webp', size: 0.6,
      credit: 'NASA, ESA and the Hubble SM4 ERO Team',
      url: 'https://esahubble.org/images/heic0910i/' },
    ngc1275: { name: 'ngc 1275', file: 'ngc1275.webp', size: 0.5,
      credit: 'NASA, ESA and Andy Fabian (University of Cambridge, UK)',
      url: 'https://esahubble.org/images/heic0817a/' },
    hudf: { name: 'hubble ultra deep field', file: 'hudf.webp', size: 2.6, tile: true,
      credit: 'NASA, ESA, H. Teplitz and M. Rafelski (IPAC/Caltech), A. Koekemoer (STScI), R. Windhorst (Arizona State University), and Z. Levay (STScI)',
      url: 'https://esahubble.org/images/heic1411a/' },
    star: { name: 'a star', gen: 'star', size: 0.22,
      credit: 'procedural limb-darkened disc, for the stellar-mass lenses' }
  };
  var SOURCE_KEYS = Object.keys(SOURCES);
  var CYCLE_KEYS = SOURCE_KEYS.filter(function (k) { return k !== 'star'; });

  // ─── Lenses ───
  // The first four are free models. The rest are real objects with rounded
  // literature values: einstein radius in arcsec (or a mass for the point
  // masses), axis ratio, position angle, external shear, and either redshifts
  // or straight distances in Mpc. fov is the canvas height in arcsec.
  var LENSES = [
    { key: 'm0', name: 'point mass', model: 0, thetaN: 0.3, fov: 10, zl: 0.5, zs: 2.0 },
    { key: 'm1', name: 'isothermal sphere', model: 1, thetaN: 0.35, fov: 10, zl: 0.5, zs: 2.0 },
    { key: 'm2', name: 'isothermal ellipsoid', model: 2, thetaN: 0.35, q: 0.7, pa: 30, fov: 10, zl: 0.5, zs: 2.0 },
    { key: 'm3', name: 'galaxy cluster', model: 3, thetaN: 0.45, q: 0.75, pa: 20, fov: 160, zl: 0.5, zs: 2.0 },

    { key: 'q2237', name: 'einstein cross (q2237+0305)', model: 2, real: true,
      thetaE: 0.9, q: 0.65, pa: 65, shear: 0.05, zl: 0.0394, zs: 1.695, fov: 5 },
    { key: 'horseshoe', name: 'cosmic horseshoe (j1148+1930)', model: 2, real: true,
      thetaE: 5.1, q: 0.8, pa: 100, shear: 0.03, zl: 0.444, zs: 2.381, fov: 28 },
    { key: 'q0957', name: 'twin quasar (q0957+561)', model: 2, real: true,
      thetaE: 3.0, q: 0.75, pa: 60, shear: 0.12, zl: 0.355, zs: 1.413, fov: 18 },
    { key: 'jackpot', name: 'the jackpot (j0946+1006)', model: 2, real: true,
      thetaE: 1.4, q: 0.85, pa: 30, shear: 0.02, zl: 0.222, zs: 0.609, fov: 8 },
    { key: 'a1689', name: 'abell 1689', model: 3, real: true,
      thetaE: 45, q: 0.8, pa: 10, shear: 0, zl: 0.183, zs: 2.0, fov: 220 },
    { key: 'macs1149', name: 'macs j1149 (refsdal)', model: 3, real: true,
      thetaE: 25, q: 0.7, pa: 50, shear: 0.05, zl: 0.544, zs: 1.489, fov: 130 },
    { key: 'm87', name: 'm87* black hole', model: 0, real: true,
      mass: 6.5e9, Dd: 16.8, Ds: 100, lensLabel: '16.8 Mpc', srcLabel: '100 Mpc' },
    { key: 'sgra', name: 'sgr a* black hole', model: 0, real: true, stellar: true,
      mass: 4.3e6, Dd: 0.0082, Ds: 0.0087, lensLabel: '8.2 kpc', srcLabel: '8.7 kpc' },
    { key: 'sun', name: 'a sun-like star', model: 0, real: true, stellar: true,
      mass: 1, Dd: 0.004, Ds: 0.008, lensLabel: '4 kpc', srcLabel: '8 kpc' }
  ];
  var LENS_BY_KEY = {};
  LENSES.forEach(function (l) { LENS_BY_KEY[l.key] = l; });

  // Cluster member galaxies: x, y, einstein radius (canvas units).
  var MEMBERS = [
    [0.55, 0.30, 0.060], [-0.62, -0.18, 0.050], [0.25, -0.58, 0.070],
    [-0.30, 0.55, 0.045], [0.85, -0.35, 0.050], [-0.95, 0.20, 0.040],
    [0.05, 0.85, 0.035], [-0.50, -0.70, 0.040]
  ];

  // ─── Cosmology and distances (flat ΛCDM, H0 = 70, Ωm = 0.3) ───
  var ARCSEC = Math.PI / 180 / 3600;
  var MPC_PER_4GMSUN_C2 = 1.914e-19; // 4 G M☉ / c² in Mpc

  function comoving(z) {
    var n = 200, h = z / n, s = 0;
    function E(zz) { return 1 / Math.sqrt(0.3 * Math.pow(1 + zz, 3) + 0.7); }
    for (var i = 0; i <= n; i++) {
      var w = (i === 0 || i === n) ? 1 : (i % 2 ? 4 : 2);
      s += w * E(i * h);
    }
    return 4282.7 * s * h / 3;
  }

  var dist = { Dd: 1, Ds: 2, Dds: 1, lens: '', source: '' };
  function distancesFromLens(l) {
    if (l.zl !== undefined) {
      var dcl = comoving(l.zl), dcs = comoving(l.zs);
      dist.Dd = dcl / (1 + l.zl);
      dist.Ds = dcs / (1 + l.zs);
      dist.Dds = (dcs - dcl) / (1 + l.zs);
      dist.lens = 'z ' + l.zl;
      dist.source = 'z ' + l.zs;
    } else {
      dist.Dd = l.Dd; dist.Ds = l.Ds; dist.Dds = l.Ds - l.Dd;
      dist.lens = l.lensLabel; dist.source = l.srcLabel;
    }
  }
  function thetaFromMass(m) {
    return Math.sqrt(MPC_PER_4GMSUN_C2 * m * dist.Dds / (dist.Dd * dist.Ds)) / ARCSEC;
  }

  // ─── State ───
  var P = {
    model: 2, thetaE: 0.35, q: 0.7, pa: 30 * Math.PI / 180,
    shear: 0, shearPA: 0, fov: 10,
    srcX: 0.12, srcY: 0.05, srcSize: 0.5
  };
  var lensKey = 'm2';
  var srcKey = 'm51';
  var src = SOURCES[srcKey];
  var playing = !reduceMotion;
  var playT = 0, playLast = 0;
  var resumeFrom = null, resumeAt = 0;
  var cursor = null;
  var dirty = true, curvesDirty = true, overlayDirty = true, magDirty = true;

  // ─── Shaders ───
  var vsSrc = [
    'attribute vec2 aPos;',
    'void main() { gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var fsSrc = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes;',
    'uniform sampler2D uSrc;',
    'uniform float uAspect;',
    'uniform vec2 uSrcPos;',
    'uniform float uSrcSize;',
    'uniform int uModel;',
    'uniform float uThetaE;',
    'uniform float uQ;',
    'uniform float uPA;',
    'uniform vec2 uShear;',
    'uniform float uTile;',
    'uniform float uGhost;',
    'uniform float uLensGal;',
    'uniform float uFade;',
    'uniform vec3 uMem[8];',
    '',
    // Singular isothermal ellipsoid deflection (Kormann, Schneider & Bartelmann 1994).
    // Major axis along x in the lens frame; reduces to the SIS as q -> 1.
    'vec2 sie(vec2 p, float tE, float q, float pa) {',
    '  float c = cos(pa), s = sin(pa);',
    '  vec2 r = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);',
    '  q = min(q, 0.999);',
    '  float sq = sqrt(1.0 - q * q);',
    '  float psi = max(sqrt(q * q * r.x * r.x + r.y * r.y), 1e-6);',
    '  float pref = tE * sqrt(q) / sq;',
    '  float ax = pref * atan(sq * r.x / psi);',
    '  float z = clamp(sq * r.y / psi, -0.999999, 0.999999);',
    '  float ay = pref * 0.5 * log((1.0 + z) / (1.0 - z));',
    '  return vec2(c * ax - s * ay, s * ax + c * ay);',
    '}',
    '',
    'vec2 deflect(vec2 t) {',
    '  vec2 a;',
    '  if (uModel == 0) {',
    '    float r2 = max(dot(t, t), 1e-8);',
    '    a = uThetaE * uThetaE * t / r2;',
    '  } else if (uModel == 1) {',
    '    float r = max(length(t), 1e-5);',
    '    a = uThetaE * t / r;',
    '  } else {',
    '    a = sie(t, uThetaE, uQ, uPA);',
    '    if (uModel == 3) {',
    '      for (int i = 0; i < 8; i++) {',
    '        vec2 d = t - uMem[i].xy;',
    '        float r = max(length(d), 1e-5);',
    '        a += uMem[i].z * d / r;',
    '      }',
    '    }',
    '  }',
    '  a += vec2(uShear.x * t.x + uShear.y * t.y, uShear.y * t.x - uShear.x * t.y);',
    '  return a;',
    '}',
    '',
    'vec3 sampleSrc(vec2 b) {',
    '  vec2 uv = (b - uSrcPos) / uSrcSize;',
    '  uv.x /= uAspect;',
    '  uv += 0.5;',
    '  if (uTile > 0.5) {',
    '    uv = 1.0 - abs(mod(uv, 2.0) - 1.0);',
    '    return texture2D(uSrc, uv).rgb;',
    '  }',
    '  float d = length((uv - 0.5) * 2.0);',
    '  float m = 1.0 - smoothstep(0.7, 1.0, d);',
    '  if (m <= 0.0) return vec3(0.0);',
    '  return texture2D(uSrc, uv).rgb * m;',
    '}',
    '',
    // de Vaucouleurs profile, normalised to 1 at the effective radius.
    'float sersic(vec2 p, float q, float pa, float re) {',
    '  float c = cos(pa), s = sin(pa);',
    '  vec2 r = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);',
    '  float rr = sqrt(q * r.x * r.x + r.y * r.y / q);',
    '  return exp(-7.669 * (pow(rr / re, 0.25) - 1.0));',
    '}',
    '',
    'vec2 offs(int i) {',
    '  if (i == 0) return vec2(0.375, 0.125);',
    '  if (i == 1) return vec2(-0.125, 0.375);',
    '  if (i == 2) return vec2(-0.375, -0.125);',
    '  return vec2(0.125, -0.375);',
    '}',
    '',
    'void main() {',
    '  float asp = uRes.x / uRes.y;',
    '  vec3 col = vec3(0.0);',
    '  for (int i = 0; i < 4; i++) {',
    '    vec2 fc = gl_FragCoord.xy + offs(i);',
    '    vec2 t = (fc / uRes * 2.0 - 1.0) * vec2(asp, 1.0);',
    '    vec2 b = t - deflect(t);',
    '    vec3 c = sampleSrc(b);',
    '    if (uGhost > 0.0) c += sampleSrc(t) * uGhost * vec3(0.7, 1.0, 0.8);',
    '    col += c;',
    '  }',
    '  col *= 0.25 * uFade;',
    '  if (uLensGal > 0.5 && uModel > 0) {',
    '    vec2 t = (gl_FragCoord.xy / uRes * 2.0 - 1.0) * vec2(asp, 1.0);',
    '    float q = uModel == 1 ? 1.0 : uQ;',
    '    float v = 0.5 * sersic(t, q, uPA, 0.45 * uThetaE);',
    '    col += vec3(1.0, 0.82, 0.58) * (v / (1.0 + v));',
    '    if (uModel == 3) {',
    '      for (int i = 0; i < 8; i++) {',
    '        float w = 0.35 * sersic(t - uMem[i].xy, 0.8, float(i) * 0.9, uMem[i].z * 0.8);',
    '        col += vec3(1.0, 0.85, 0.62) * (w / (1.0 + w));',
    '      }',
    '    }',
    '  }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compile(type, source) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  var prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ['uRes', 'uSrc', 'uAspect', 'uSrcPos', 'uSrcSize', 'uModel', 'uThetaE', 'uQ', 'uPA',
    'uShear', 'uTile', 'uGhost', 'uLensGal', 'uFade', 'uMem'].forEach(function (n) {
    U[n] = gl.getUniformLocation(prog, n);
  });
  var memFlat = [];
  MEMBERS.forEach(function (m) { memFlat.push(m[0], m[1], m[2]); });
  gl.uniform3fv(U.uMem, new Float32Array(memFlat));
  gl.uniform1i(U.uSrc, 0);

  // ─── Textures ───
  var textures = {};
  var loading = {};
  var current = null; // { tex, aspect, lum, lumMean }
  var LUM_N = 96;

  function smoothstep(a, b, x) {
    var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  // Limb-darkened stellar disc, I(μ) = 1 - u(1 - μ), u = 0.6.
  function makeStar() {
    var N = 512, R = 0.42 * N;
    var c = document.createElement('canvas');
    c.width = N; c.height = N;
    var cx = c.getContext('2d');
    var img = cx.createImageData(N, N), d = img.data;
    for (var j = 0; j < N; j++) {
      for (var i = 0; i < N; i++) {
        var x = i + 0.5 - N / 2, y = j + 0.5 - N / 2;
        var r = Math.sqrt(x * x + y * y) / R;
        var I;
        if (r < 1) {
          var mu = Math.sqrt(1 - r * r);
          I = 1 - 0.6 * (1 - mu);
          I *= 1 - smoothstep(0.985, 1.0, r);
        } else {
          I = 0.12 * Math.exp(-(r - 1) * 18);
        }
        var k = (j * N + i) * 4;
        d[k] = Math.min(255, 255 * I);
        d[k + 1] = Math.min(255, 240 * I);
        d[k + 2] = Math.min(255, 205 * I);
        d[k + 3] = 255;
      }
    }
    cx.putImageData(img, 0, 0);
    return c;
  }

  function buildEntry(img) {
    var tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (isGL2) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    if (current) gl.bindTexture(gl.TEXTURE_2D, current.tex);

    // Luminance map, used for the total magnification readout.
    var c = document.createElement('canvas');
    c.width = LUM_N; c.height = LUM_N;
    var cx = c.getContext('2d');
    cx.drawImage(img, 0, 0, LUM_N, LUM_N);
    var d = cx.getImageData(0, 0, LUM_N, LUM_N).data;
    var lum = new Float32Array(LUM_N * LUM_N);
    var sum = 0;
    for (var j = 0; j < LUM_N; j++) {
      for (var i = 0; i < LUM_N; i++) {
        var k = j * LUM_N + i;
        var L = (0.2126 * d[k * 4] + 0.7152 * d[k * 4 + 1] + 0.0722 * d[k * 4 + 2]) / 255;
        L = Math.max(0, L - 0.04);
        var u = (i + 0.5) / LUM_N * 2 - 1, v = (j + 0.5) / LUM_N * 2 - 1;
        var m = 1 - smoothstep(0.7, 1.0, Math.sqrt(u * u + v * v));
        lum[k] = L * m;
        sum += lum[k];
      }
    }
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    return { tex: tex, aspect: w / h, lum: lum, lumMean: sum / (LUM_N * LUM_N) };
  }

  function ensureTexture(key, cb) {
    if (textures[key]) { if (cb) cb(textures[key]); return; }
    var s = SOURCES[key];
    if (s.gen === 'star') {
      textures[key] = buildEntry(makeStar());
      if (cb) cb(textures[key]);
      return;
    }
    if (loading[key]) { if (cb) loading[key].push(cb); return; }
    loading[key] = cb ? [cb] : [];
    var img = new Image();
    img.onload = function () {
      textures[key] = buildEntry(img);
      var cbs = loading[key]; delete loading[key];
      cbs.forEach(function (f) { f(textures[key]); });
    };
    img.onerror = function () {
      delete loading[key];
      if (srcKey === key && hudNote) hudNote.textContent = 'could not load ' + s.name;
    };
    img.src = '/images/lensing/' + s.file;
  }

  function loadSource(key) {
    src = SOURCES[key];
    srcKey = key;
    sourceSelect.value = key;
    if (credit) {
      credit.innerHTML = 'source image: ' + (src.url
        ? '<a href="' + src.url + '" rel="noopener">' + src.name + '</a> · ' + src.credit + ' · CC BY 4.0'
        : src.name + ' · ' + src.credit);
    }
    current = textures[key] || null;
    if (!current && hudNote) hudNote.textContent = 'loading image…';
    dirty = true; magDirty = true; overlayDirty = true;
    ensureTexture(key, function (entry) {
      if (srcKey !== key) return;
      current = entry;
      if (hudNote) hudNote.textContent = '';
      dirty = true; magDirty = true;
    });
  }

  // ─── Lens model in JS (mirrors the shader) ───
  var tmpA = [0, 0], tmpB = [0, 0];

  function alpha(x, y, out) {
    var ax, ay, tE = P.thetaE;
    if (P.model === 0) {
      var r2 = Math.max(x * x + y * y, 1e-8);
      ax = tE * tE * x / r2; ay = tE * tE * y / r2;
    } else if (P.model === 1) {
      var r = Math.max(Math.sqrt(x * x + y * y), 1e-5);
      ax = tE * x / r; ay = tE * y / r;
    } else {
      var c = Math.cos(P.pa), s = Math.sin(P.pa);
      var xp = c * x + s * y, yp = -s * x + c * y;
      var q = Math.min(P.q, 0.999);
      var sq = Math.sqrt(1 - q * q);
      var psi = Math.max(Math.sqrt(q * q * xp * xp + yp * yp), 1e-6);
      var pref = tE * Math.sqrt(q) / sq;
      var axp = pref * Math.atan(sq * xp / psi);
      var z = Math.max(-0.999999, Math.min(0.999999, sq * yp / psi));
      var ayp = pref * 0.5 * Math.log((1 + z) / (1 - z));
      ax = c * axp - s * ayp; ay = s * axp + c * ayp;
      if (P.model === 3) {
        for (var i = 0; i < MEMBERS.length; i++) {
          var dx = x - MEMBERS[i][0], dy = y - MEMBERS[i][1];
          var rr = Math.max(Math.sqrt(dx * dx + dy * dy), 1e-5);
          ax += MEMBERS[i][2] * dx / rr; ay += MEMBERS[i][2] * dy / rr;
        }
      }
    }
    var g1 = P.shear * Math.cos(2 * P.shearPA), g2 = P.shear * Math.sin(2 * P.shearPA);
    ax += g1 * x + g2 * y; ay += g2 * x - g1 * y;
    out[0] = ax; out[1] = ay;
  }

  // det of the lensing jacobian A = d(beta)/d(theta), by central differences.
  function detA(x, y) {
    var h = 2e-4;
    alpha(x + h, y, tmpA); alpha(x - h, y, tmpB);
    var axx = (tmpA[0] - tmpB[0]) / (2 * h), ayx = (tmpA[1] - tmpB[1]) / (2 * h);
    alpha(x, y + h, tmpA); alpha(x, y - h, tmpB);
    var axy = (tmpA[0] - tmpB[0]) / (2 * h), ayy = (tmpA[1] - tmpB[1]) / (2 * h);
    return (1 - axx) * (1 - ayy) - axy * ayx;
  }

  // ─── Critical curves and caustics (marching squares on det A) ───
  var MS_EDGES = [
    [], [3, 0], [0, 1], [3, 1], [1, 2], [3, 2, 0, 1], [0, 2], [3, 2],
    [2, 3], [0, 2], [0, 3, 1, 2], [1, 2], [3, 1], [0, 1], [3, 0], []
  ];
  var critLines = [], caustLines = [];

  // Join marching-squares segments end to end so the curves can be dashed.
  function chainSegments(segs) {
    var n = segs.length / 2;
    var key = function (p) { return p[0].toFixed(4) + ',' + p[1].toFixed(4); };
    var at = {};
    for (var i = 0; i < n; i++) {
      (at[key(segs[2 * i])] = at[key(segs[2 * i])] || []).push(i);
      (at[key(segs[2 * i + 1])] = at[key(segs[2 * i + 1])] || []).push(i);
    }
    var used = new Uint8Array(n), lines = [];
    function walk(i, p) {
      var out = [];
      for (;;) {
        var cands = at[key(p)], next = -1;
        for (var k = 0; k < cands.length; k++) if (!used[cands[k]]) { next = cands[k]; break; }
        if (next < 0) break;
        used[next] = 1;
        var a = segs[2 * next], b = segs[2 * next + 1];
        p = key(a) === key(p) ? b : a;
        out.push(p);
      }
      return out;
    }
    for (i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = 1;
      var a = segs[2 * i], b = segs[2 * i + 1];
      var fwd = walk(i, b), back = walk(i, a);
      back.reverse();
      lines.push(back.concat([a, b], fwd));
    }
    return lines;
  }

  function computeCurves() {
    var asp = cssW / cssH;
    var ny = 161, nx = Math.round(ny * asp);
    var dx = 2 * asp / nx, dy = 2 / ny;
    var grid = new Float32Array((nx + 1) * (ny + 1));
    for (var j = 0; j <= ny; j++) {
      var y = -1 + j * dy + dy * 0.5;
      for (var i = 0; i <= nx; i++) {
        var x = -asp + i * dx + dx * 0.5;
        grid[j * (nx + 1) + i] = detA(x, y);
      }
    }
    var segs = [];
    function lerpEdge(e, i, j, v) {
      var x0 = -asp + i * dx + dx * 0.5, y0 = -1 + j * dy + dy * 0.5;
      var a, b, t;
      if (e === 0) { a = v[0]; b = v[1]; t = a / (a - b); return [x0 + t * dx, y0]; }
      if (e === 1) { a = v[1]; b = v[2]; t = a / (a - b); return [x0 + dx, y0 + t * dy]; }
      if (e === 2) { a = v[3]; b = v[2]; t = a / (a - b); return [x0 + t * dx, y0 + dy]; }
      a = v[0]; b = v[3]; t = a / (a - b); return [x0, y0 + t * dy];
    }
    var v = [0, 0, 0, 0];
    for (j = 0; j < ny; j++) {
      for (i = 0; i < nx; i++) {
        v[0] = grid[j * (nx + 1) + i];
        v[1] = grid[j * (nx + 1) + i + 1];
        v[2] = grid[(j + 1) * (nx + 1) + i + 1];
        v[3] = grid[(j + 1) * (nx + 1) + i];
        var mx = Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]), Math.abs(v[3]));
        if (mx > 400) continue;
        var idx = (v[0] > 0 ? 1 : 0) | (v[1] > 0 ? 2 : 0) | (v[2] > 0 ? 4 : 0) | (v[3] > 0 ? 8 : 0);
        var edges = MS_EDGES[idx];
        for (var k = 0; k < edges.length; k += 2) {
          segs.push(lerpEdge(edges[k], i, j, v), lerpEdge(edges[k + 1], i, j, v));
        }
      }
    }
    critLines = chainSegments(segs);
    caustLines = critLines.map(function (line) {
      return line.map(function (p) {
        alpha(p[0], p[1], tmpA);
        return [p[0] - tmpA[0], p[1] - tmpA[1]];
      });
    });
  }

  function drawOverlay() {
    var W = overlay.width, H = overlay.height;
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d.clearRect(0, 0, W, H);
    var asp = cssW / cssH;
    var sx = W / (2 * asp), sy = H / 2;
    function px(p) { return [(p[0] + asp) * sx, (1 - p[1]) * sy]; }
    var dpr = W / cssW;
    function drawLines(lines, color, width, dash) {
      ctx2d.strokeStyle = color;
      ctx2d.lineWidth = width;
      ctx2d.lineCap = 'round';
      ctx2d.setLineDash(dash);
      ctx2d.beginPath();
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        for (var j = 0; j < line.length; j++) {
          var p = px(line[j]);
          if (j === 0) ctx2d.moveTo(p[0], p[1]); else ctx2d.lineTo(p[0], p[1]);
        }
      }
      ctx2d.stroke();
      ctx2d.setLineDash([]);
    }
    if (critToggle.checked) drawLines(critLines, 'rgba(220, 220, 220, 0.5)', 1.3 * dpr, [0.5 * dpr, 4 * dpr]);
    if (caustToggle.checked) drawLines(caustLines, 'rgba(200, 200, 200, 0.45)', 1.1 * dpr, [5 * dpr, 4 * dpr]);
    if (ghostToggle.checked && !src.tile) {
      var c = px([P.srcX, P.srcY]);
      ctx2d.strokeStyle = 'rgba(220, 220, 220, 0.5)';
      ctx2d.lineWidth = 1 * dpr;
      ctx2d.beginPath();
      ctx2d.moveTo(c[0] - 6 * dpr, c[1]); ctx2d.lineTo(c[0] + 6 * dpr, c[1]);
      ctx2d.moveTo(c[0], c[1] - 6 * dpr); ctx2d.lineTo(c[0], c[1] + 6 * dpr);
      ctx2d.stroke();
    }
  }

  // ─── Total magnification (lensed flux / unlensed flux) ───
  var magValue = NaN;

  function computeMag() {
    if (!current || src.tile) { magValue = NaN; return; }
    var asp = cssW / cssH;
    var ny = 150, nx = Math.round(ny * asp);
    var dx = 2 * asp / nx, dy = 2 / ny;
    var w = P.srcSize * current.aspect, h = P.srcSize;
    var sum = 0, lum = current.lum;
    for (var j = 0; j < ny; j++) {
      var y = -1 + (j + 0.5) * dy;
      for (var i = 0; i < nx; i++) {
        var x = -asp + (i + 0.5) * dx;
        alpha(x, y, tmpA);
        var u = (x - tmpA[0] - P.srcX) / w + 0.5;
        var v = (y - tmpA[1] - P.srcY) / h + 0.5;
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
        sum += lum[Math.floor((1 - v) * LUM_N) * LUM_N + Math.floor(u * LUM_N)];
      }
    }
    var F1 = sum * dx * dy;
    var F0 = current.lumMean * w * h;
    magValue = F0 > 0 ? F1 / F0 : NaN;
  }

  // ─── Formatting ───
  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function sci(v) {
    if (v < 1e4) return v >= 10 ? v.toFixed(0) : v.toFixed(1);
    var e = Math.floor(Math.log10(v));
    var m = v / Math.pow(10, e);
    if (m >= 9.95) { m /= 10; e += 1; }
    return m.toFixed(1) + ' × 10' + String(e).split('').map(function (ch) { return SUP[ch] || ch; }).join('');
  }
  function fmtAngle(a) {
    if (a >= 120) return (a / 60).toFixed(1) + '′';
    if (a >= 0.1) return a.toFixed(2) + '″';
    if (a >= 1e-4) return (a * 1e3).toFixed(2) + ' mas';
    return (a * 1e6).toFixed(1) + ' µas';
  }
  function fmtMu(mu) {
    if (!isFinite(mu)) return '—';
    var a = Math.abs(mu);
    return a >= 100 ? '>100×' : a >= 10 ? a.toFixed(0) + '×' : a.toFixed(1) + '×';
  }

  function updateHud() {
    var tEarc = P.thetaE * P.fov / 2;
    var tErad = tEarc * ARCSEC;
    var mass = 5.223e18 * (dist.Dd * dist.Ds / dist.Dds) * tErad * tErad;
    hudTheta.textContent = fmtAngle(tEarc);
    hudMass.textContent = sci(mass) + ' M☉';
    if (P.model === 0) {
      hudSigmaRow.hidden = true;
    } else {
      hudSigmaRow.hidden = false;
      var sigma = 299792.458 * Math.sqrt(tErad * dist.Ds / (4 * Math.PI * dist.Dds));
      hudSigma.textContent = Math.round(sigma) + ' km/s';
    }
    hudFov.textContent = fmtAngle(P.fov);
    hudZl.textContent = dist.lens;
    hudZs.textContent = dist.source;
    hudMag.textContent = src.tile ? '—' : fmtMu(magValue);
    if (cursor) {
      var d = detA(cursor[0], cursor[1]);
      hudCursor.textContent = fmtMu(1 / d) + (d < 0 ? ' · mirrored' : '');
    } else {
      hudCursor.textContent = '—';
    }
  }

  // ─── Sizing ───
  var MAX_PIXELS = 2.2e6;
  var maxScale = Math.min(window.devicePixelRatio || 1, 2);
  var cssW = 0, cssH = 0;

  function resize() {
    cssW = wrap.clientWidth;
    cssH = document.fullscreenElement === wrap
      ? wrap.clientHeight
      : Math.min(cssW * 0.65, 560);
    if (cssW <= 0 || cssH <= 0) return;
    var s = maxScale;
    if (cssW * cssH * s * s > MAX_PIXELS) s = Math.sqrt(MAX_PIXELS / (cssW * cssH));
    var w = Math.max(1, Math.round(cssW * s));
    var h = Math.max(1, Math.round(cssH * s));
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    overlay.style.width = cssW + 'px';
    overlay.style.height = cssH + 'px';
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    var os = Math.min(window.devicePixelRatio || 1, 2);
    overlay.width = Math.round(cssW * os);
    overlay.height = Math.round(cssH * os);
    dirty = true; curvesDirty = true; magDirty = true;
  }

  // ─── Render ───
  var fade = 1;

  function render() {
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1i(U.uModel, P.model);
    gl.uniform1f(U.uThetaE, P.thetaE);
    gl.uniform1f(U.uQ, P.q);
    gl.uniform1f(U.uPA, P.pa);
    gl.uniform2f(U.uShear, P.shear * Math.cos(2 * P.shearPA), P.shear * Math.sin(2 * P.shearPA));
    gl.uniform2f(U.uSrcPos, P.srcX, P.srcY);
    gl.uniform1f(U.uSrcSize, P.srcSize);
    gl.uniform1f(U.uTile, src.tile ? 1 : 0);
    gl.uniform1f(U.uGhost, ghostToggle.checked && !src.tile ? 0.35 : 0);
    gl.uniform1f(U.uLensGal, galToggle.checked ? 1 : 0);
    gl.uniform1f(U.uFade, fade);
    if (current) {
      gl.uniform1f(U.uAspect, current.aspect);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, current.tex);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  // ─── Play: drift the source, and cycle sources every so often ───
  var CYCLE_SECONDS = 24;
  var cycleT = 0, pendingKey = null, fadeTarget = 1;
  var running = true, visible = !document.hidden, onScreen = true;
  var magTimer = 0;

  function idlePath(t) {
    if (src.tile) return [0.04 * t, 0.15 * Math.sin(0.05 * t)];
    var tE = P.thetaE;
    return [1.1 * tE * Math.sin(0.11 * t), 0.7 * tE * Math.sin(0.23 * t + 1.0)];
  }

  function nextCycleKey() {
    var lens = LENS_BY_KEY[lensKey];
    if (lens.stellar) return srcKey === 'star' ? CYCLE_KEYS[Math.floor(Math.random() * CYCLE_KEYS.length)] : 'star';
    var i = CYCLE_KEYS.indexOf(srcKey);
    return CYCLE_KEYS[(i + 1) % CYCLE_KEYS.length];
  }

  function switchSource(key) {
    var scale = P.thetaE / 0.35;
    P.srcSize = Math.max(0.06, Math.min(3, SOURCES[key].size * scale));
    sizeSlider.value = Math.round(P.srcSize * 1000);
    loadSource(key);
    syncLabels();
    writeHash();
  }

  function frame(now) {
    if (!running) return;
    var dt = playLast ? Math.min(0.1, (now - playLast) / 1000) : 0;
    playLast = now;

    if (playing) {
      playT += dt;
      cycleT += dt;
      var p = idlePath(playT);
      if (resumeFrom) {
        var f = Math.min(1, (now - resumeAt) / 1500);
        f = f * f * (3 - 2 * f);
        p = [resumeFrom[0] + (p[0] - resumeFrom[0]) * f, resumeFrom[1] + (p[1] - resumeFrom[1]) * f];
        if (f >= 1) resumeFrom = null;
      }
      P.srcX = p[0]; P.srcY = p[1];
      dirty = true; overlayDirty = overlayDirty || ghostToggle.checked;
      if (!src.tile && now - magTimer > 250) magDirty = true;

      if (cycleT > CYCLE_SECONDS && !pendingKey && current) {
        pendingKey = nextCycleKey();
        ensureTexture(pendingKey);
        fadeTarget = 0;
        cycleT = 0;
      }
    }

    // Fade out, swap once the next image is ready, fade back in.
    if (fade !== fadeTarget) {
      fade += (fadeTarget > fade ? 1 : -1) * dt * 2.5;
      fade = Math.max(0, Math.min(1, fade));
      dirty = true;
    }
    if (pendingKey && fade <= 0 && textures[pendingKey]) {
      switchSource(pendingKey);
      pendingKey = null;
      fadeTarget = 1;
    }

    if (curvesDirty) { computeCurves(); curvesDirty = false; overlayDirty = true; }
    if (overlayDirty) { drawOverlay(); overlayDirty = false; }
    if (magDirty) { computeMag(); magDirty = false; magTimer = now; }
    if (dirty) { render(); dirty = false; }
    updateHud();
    requestAnimationFrame(frame);
  }

  // ─── Controls ───
  function lensChanged() {
    curvesDirty = true; magDirty = true; dirty = true;
    writeHash();
  }
  function sourceMoved() {
    magDirty = true; dirty = true; overlayDirty = true;
    writeHash();
  }

  function setLens(key, keepSize) {
    var l = LENS_BY_KEY[key];
    if (!l) return;
    lensKey = key;
    lensSelect.value = key;
    P.model = l.model;
    distancesFromLens(l);
    var tEarc;
    if (l.mass !== undefined) {
      tEarc = thetaFromMass(l.mass);
      P.fov = tEarc / 0.35 * 2;
      P.thetaE = 0.35;
    } else if (l.thetaE !== undefined) {
      P.fov = l.fov;
      P.thetaE = l.thetaE / (l.fov / 2);
    } else {
      P.fov = l.fov;
      P.thetaE = l.thetaN;
    }
    P.q = l.q !== undefined ? l.q : 0.7;
    P.pa = (l.pa !== undefined ? l.pa : 30) * Math.PI / 180;
    P.shear = l.shear || 0;
    if (!keepSize) {
      P.srcSize = Math.max(0.06, Math.min(3, src.size * P.thetaE / 0.35));
      sizeSlider.value = Math.round(P.srcSize * 1000);
    }
    thetaSlider.value = Math.round(P.thetaE * 1000);
    ellipSlider.value = Math.round((1 - P.q) * 1000);
    angleSlider.value = Math.round(P.pa * 180 / Math.PI);
    shearSlider.value = Math.round(P.shear * 1000);
    var ellipOn = P.model >= 2;
    ellipSlider.disabled = !ellipOn;
    angleSlider.disabled = !ellipOn;
    syncLabels();
    lensChanged();
  }

  function syncLabels() {
    thetaLabel.textContent = 'θE ' + fmtAngle(P.thetaE * P.fov / 2);
    ellipLabel.textContent = 'q ' + P.q.toFixed(2);
    angleLabel.textContent = Math.round(P.pa * 180 / Math.PI) + '°';
    shearLabel.textContent = 'γ ' + P.shear.toFixed(2);
    sizeLabel.textContent = fmtAngle(P.srcSize * P.fov / 2);
  }

  function randomise() {
    var l = LENSES[Math.floor(Math.random() * LENSES.length)];
    var key;
    if (l.stellar) key = Math.random() < 0.7 ? 'star' : CYCLE_KEYS[Math.floor(Math.random() * CYCLE_KEYS.length)];
    else key = CYCLE_KEYS[Math.floor(Math.random() * CYCLE_KEYS.length)];
    src = SOURCES[key]; srcKey = key;
    setLens(l.key);
    if (!l.real) {
      P.thetaE = 0.15 + Math.random() * 0.45;
      if (P.model >= 2) {
        P.q = 0.5 + Math.random() * 0.5;
        P.pa = Math.random() * Math.PI;
      }
      P.shear = Math.random() < 0.5 ? 0 : Math.random() * 0.15;
      thetaSlider.value = Math.round(P.thetaE * 1000);
      ellipSlider.value = Math.round((1 - P.q) * 1000);
      angleSlider.value = Math.round(P.pa * 180 / Math.PI);
      shearSlider.value = Math.round(P.shear * 1000);
    }
    P.srcSize = Math.max(0.06, Math.min(3, src.size * P.thetaE / 0.35 * (0.7 + Math.random() * 0.8)));
    sizeSlider.value = Math.round(P.srcSize * 1000);
    if (!playing) {
      var r = Math.random() * 1.2 * P.thetaE, a = Math.random() * 2 * Math.PI;
      P.srcX = r * Math.cos(a); P.srcY = r * Math.sin(a);
    } else {
      resumeFrom = [P.srcX, P.srcY]; resumeAt = performance.now();
    }
    cycleT = 0;
    loadSource(key);
    syncLabels();
    lensChanged();
  }

  lensSelect.addEventListener('change', function () { setLens(lensSelect.value); });
  sourceSelect.addEventListener('change', function () {
    switchSource(sourceSelect.value);
    cycleT = 0;
    if (!src.tile && !playing) { P.srcX = 0.12; P.srcY = 0.05; }
    lensChanged();
  });
  thetaSlider.addEventListener('input', function () {
    P.thetaE = parseInt(thetaSlider.value, 10) / 1000;
    syncLabels(); lensChanged();
  });
  ellipSlider.addEventListener('input', function () {
    P.q = 1 - parseInt(ellipSlider.value, 10) / 1000;
    syncLabels(); lensChanged();
  });
  angleSlider.addEventListener('input', function () {
    P.pa = parseInt(angleSlider.value, 10) * Math.PI / 180;
    syncLabels(); lensChanged();
  });
  shearSlider.addEventListener('input', function () {
    P.shear = parseInt(shearSlider.value, 10) / 1000;
    syncLabels(); lensChanged();
  });
  sizeSlider.addEventListener('input', function () {
    setSize(parseInt(sizeSlider.value, 10) / 1000);
  });
  function setSize(s) {
    P.srcSize = Math.max(0.06, Math.min(3, s));
    sizeSlider.value = Math.round(P.srcSize * 1000);
    syncLabels(); sourceMoved();
  }
  [critToggle, caustToggle, ghostToggle, galToggle].forEach(function (el) {
    el.addEventListener('change', function () { overlayDirty = true; dirty = true; writeHash(); });
  });

  function setPlaying(on) {
    playing = on;
    playButton.textContent = on ? 'pause' : 'play';
    playButton.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) { resumeFrom = [P.srcX, P.srcY]; resumeAt = performance.now(); cycleT = 0; }
    writeHash();
  }
  playButton.addEventListener('click', function () { setPlaying(!playing); });
  randomButton.addEventListener('click', randomise);

  // ─── Pointer: drag moves the source, pinch scales it ───
  var pointers = {}, dragging = false, dragX = 0, dragY = 0, pinchD0 = 0, pinchS0 = 0;
  function pointerList() {
    var out = [];
    for (var k in pointers) if (pointers.hasOwnProperty(k)) out.push(pointers[k]);
    return out;
  }
  function toTheta(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    var asp = cssW / cssH;
    return [((clientX - r.left) / r.width * 2 - 1) * asp, 1 - (clientY - r.top) / r.height * 2];
  }
  function beginDrag(x, y) {
    if (playing) setPlaying(false);
    dragging = true; dragX = x; dragY = y;
  }
  function moveDrag(x, y) {
    var k = 2 / cssH;
    P.srcX += (x - dragX) * k;
    P.srcY -= (y - dragY) * k;
    dragX = x; dragY = y;
    sourceMoved();
  }

  if (window.PointerEvent) {
    canvas.addEventListener('pointerdown', function (e) {
      canvas.setPointerCapture(e.pointerId);
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ps = pointerList();
      if (ps.length === 1) beginDrag(e.clientX, e.clientY);
      else if (ps.length === 2) {
        pinchD0 = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        pinchS0 = P.srcSize;
        dragging = false;
      }
      canvas.focus();
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      cursor = toTheta(e.clientX, e.clientY);
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId].x = e.clientX;
      pointers[e.pointerId].y = e.clientY;
      var ps = pointerList();
      if (ps.length >= 2) {
        var d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        if (pinchD0 > 0) setSize(pinchS0 * d / Math.max(pinchD0, 1));
      } else if (dragging) {
        moveDrag(e.clientX, e.clientY);
      }
      e.preventDefault();
    });
    function endPointer(e) {
      delete pointers[e.pointerId];
      var ps = pointerList();
      if (ps.length === 1) { dragging = true; dragX = ps[0].x; dragY = ps[0].y; }
      else if (ps.length === 0) dragging = false;
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', function () { cursor = null; });
  } else {
    canvas.addEventListener('mousedown', function (e) { beginDrag(e.clientX, e.clientY); e.preventDefault(); });
    window.addEventListener('mousemove', function (e) {
      cursor = toTheta(e.clientX, e.clientY);
      if (dragging) moveDrag(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', function () { dragging = false; });
  }

  canvas.addEventListener('wheel', function (e) {
    var d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    setSize(P.srcSize * Math.exp(-d * 0.0012));
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('keydown', function (e) {
    var step = 0.02;
    var handled = true;
    if (e.key === 'ArrowLeft') P.srcX -= step;
    else if (e.key === 'ArrowRight') P.srcX += step;
    else if (e.key === 'ArrowUp') P.srcY += step;
    else if (e.key === 'ArrowDown') P.srcY -= step;
    else if (e.key === '+' || e.key === '=') setSize(P.srcSize * 1.1);
    else if (e.key === '-') setSize(P.srcSize / 1.1);
    else if (e.key === ' ') setPlaying(!playing);
    else if (e.key === 'r') randomise();
    else handled = false;
    if (handled) {
      if (playing && e.key !== ' ' && e.key !== 'r') setPlaying(false);
      sourceMoved();
      e.preventDefault();
    }
  });

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

  // ─── Pause when hidden or off-screen ───
  function updateRunning() {
    var next = visible && onScreen;
    if (next && !running) { running = true; playLast = 0; requestAnimationFrame(frame); }
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
    }, { threshold: 0 }).observe(stage);
  }

  // ─── URL hash: read a shared configuration, and keep it updated ───
  var hashState = {};
  function readHash() {
    var h = location.hash.replace(/^#/, '');
    if (!h) return;
    h.split('&').forEach(function (kv) {
      var p = kv.split('='), k = p[0], v = decodeURIComponent(p[1] || '');
      hashState[k] = v;
    });
  }

  var hashTimer = 0;
  function writeHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(function () {
      var l = LENS_BY_KEY[lensKey];
      var parts = ['lens=' + lensKey, 'source=' + srcKey];
      if (!l.real) {
        parts.push('theta=' + P.thetaE.toFixed(3));
        if (P.model >= 2) parts.push('q=' + P.q.toFixed(2), 'pa=' + Math.round(P.pa * 180 / Math.PI));
        if (P.shear > 0) parts.push('shear=' + P.shear.toFixed(2));
      }
      parts.push('size=' + P.srcSize.toFixed(2));
      if (!playing) parts.push('x=' + P.srcX.toFixed(3), 'y=' + P.srcY.toFixed(3), 'play=0');
      if (ghostToggle.checked) parts.push('ghost=1');
      if (!galToggle.checked) parts.push('gal=0');
      if (!critToggle.checked) parts.push('crit=0');
      if (!caustToggle.checked) parts.push('caust=0');
      if (history.replaceState) history.replaceState(null, '', '#' + parts.join('&'));
    }, 300);
  }

  // ─── Boot ───
  readHash();
  var H = hashState, f;
  if (H.model !== undefined && LENS_BY_KEY['m' + H.model]) lensKey = 'm' + H.model;
  if (H.lens && LENS_BY_KEY[H.lens]) lensKey = H.lens;
  if (H.source && SOURCES[H.source]) { srcKey = H.source; src = SOURCES[srcKey]; }
  setLens(lensKey);
  if (!LENS_BY_KEY[lensKey].real) {
    if (isFinite(f = parseFloat(H.theta))) P.thetaE = Math.max(0.05, Math.min(0.75, f));
    if (isFinite(f = parseFloat(H.q))) P.q = Math.max(0.4, Math.min(1, f));
    if (isFinite(f = parseFloat(H.pa))) P.pa = f * Math.PI / 180;
    if (isFinite(f = parseFloat(H.shear))) P.shear = Math.max(0, Math.min(0.3, f));
    thetaSlider.value = Math.round(P.thetaE * 1000);
    ellipSlider.value = Math.round((1 - P.q) * 1000);
    angleSlider.value = Math.round(P.pa * 180 / Math.PI);
    shearSlider.value = Math.round(P.shear * 1000);
  }
  if (isFinite(f = parseFloat(H.size))) { P.srcSize = Math.max(0.06, Math.min(3, f)); sizeSlider.value = Math.round(P.srcSize * 1000); }
  if (isFinite(f = parseFloat(H.x))) { P.srcX = f; playing = false; }
  if (isFinite(f = parseFloat(H.y))) { P.srcY = f; playing = false; }
  if (H.play !== undefined) playing = H.play !== '0';
  if (H.ghost !== undefined) ghostToggle.checked = H.ghost !== '0';
  if (H.gal !== undefined) galToggle.checked = H.gal !== '0';
  if (H.crit !== undefined) critToggle.checked = H.crit !== '0';
  if (H.caust !== undefined) caustToggle.checked = H.caust !== '0';
  playButton.textContent = playing ? 'pause' : 'play';
  playButton.setAttribute('aria-pressed', playing ? 'true' : 'false');
  syncLabels();
  loadSource(srcKey);
  resize();

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  requestAnimationFrame(frame);
})();
