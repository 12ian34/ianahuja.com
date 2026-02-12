(function () {
  'use strict';

  var canvas = document.getElementById('relativity-canvas');
  var gl = canvas.getContext('webgl', { antialias: false });

  if (!gl) {
    document.querySelector('.relativity-canvas-wrap').innerHTML =
      '<p style="color:#94F3A6;text-align:center;padding:4em 1em">' +
      'your browser needs WebGL to render this black hole</p>';
    return;
  }

  // ─── DOM ───
  var slider = document.getElementById('distance-slider');
  var hudDistance = document.getElementById('hud-distance');
  var hudDilation = document.getElementById('hud-dilation');
  var hudAngle = document.getElementById('hud-angle');

  // ─── Shader sources ───
  var vsSrc = [
    'attribute vec2 aPos;',
    'void main() { gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var fsSrc = [
    'precision highp float;',
    '',
    'uniform vec2 uRes;',
    'uniform float uDist;',
    'uniform float uTheta;',
    'uniform float uPhi;',
    'uniform float uTime;',
    '',
    '#define PI 3.14159265359',
    '#define STEPS 350',
    '#define DISK_IN 3.0',
    '#define DISK_OUT 12.0',
    '',
    '// ─── Hash ───',
    'float hash(vec2 p) {',
    '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
    '}',
    '',
    '// ─── Procedural starfield (3x3 cell neighborhood to avoid grid clipping) ───',
    'vec3 starfield(vec3 d) {',
    '  vec3 col = vec3(0.0);',
    '  float u = atan(d.z, d.x) / (2.0 * PI) + 0.5;',
    '  float v = asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5;',
    '',
    '  // Layer 1: bright sparse stars',
    '  vec2 fuv = vec2(u, v) * 50.0;',
    '  vec2 iuv = floor(fuv);',
    '  for (int dx = -1; dx <= 1; dx++) {',
    '    for (int dy = -1; dy <= 1; dy++) {',
    '      vec2 g = iuv + vec2(float(dx), float(dy));',
    '      float h = hash(g);',
    '      if (h > 0.97) {',
    '        vec2 sp = g + vec2(hash(g + 1.0), hash(g + 2.0));',
    '        float e = length(fuv - sp);',
    '        col += exp(-e * e * 15.0) * 1.3 * mix(vec3(1, .85, .6), vec3(.6, .8, 1), hash(g + 3.0));',
    '      }',
    '    }',
    '  }',
    '',
    '  // Layer 2: faint dense stars',
    '  fuv = vec2(u, v) * 140.0;',
    '  iuv = floor(fuv);',
    '  for (int dx = -1; dx <= 1; dx++) {',
    '    for (int dy = -1; dy <= 1; dy++) {',
    '      vec2 g = iuv + vec2(float(dx), float(dy));',
    '      float h = hash(g + 99.0);',
    '      if (h > 0.93) {',
    '        vec2 sp = g + vec2(hash(g + 11.0), hash(g + 22.0));',
    '        float e = length(fuv - sp);',
    '        col += exp(-e * e * 20.0) * 0.4 * mix(vec3(1, .9, .7), vec3(.7, .85, 1), hash(g + 33.0));',
    '      }',
    '    }',
    '  }',
    '',
    '  return col;',
    '}',
    '',
    '// ─── Accretion disk color ───',
    'vec3 diskColor(float r, float doppler, float angle) {',
    '  // Temperature profile: T ~ r^(-3/4), hottest at inner edge',
    '  float t = pow(r / DISK_IN, -0.75) * doppler;',
    '  t = clamp(t, 0.0, 3.5);',
    '',
    '  vec3 col;',
    '  if (t > 1.8) col = mix(vec3(1, .95, .75), vec3(.9, .93, 1), (t - 1.8) / 1.7);',
    '  else if (t > 0.8) col = mix(vec3(.95, .5, .12), vec3(1, .95, .75), (t - .8));',
    '  else if (t > 0.3) col = mix(vec3(.6, .12, .02), vec3(.95, .5, .12), (t - .3) / .5);',
    '  else col = vec3(.6, .12, .02) * (t / .3);',
    '',
    '  // Relativistic beaming: brightness ~ doppler^3',
    '  col *= pow(max(doppler, 0.1), 3.0);',
    '',
    '  // Differential rotation pattern',
    '  float w = 1.0 / (1.414 * pow(r, 1.5));',
    '  float ra = angle - w * uTime * 5.0;',
    '  col *= 0.7 + 0.3 * (sin(r * 5.0) * .5 + .5);',
    '  col *= 0.8 + 0.2 * sin(ra * 3.0 + r * 2.0);',
    '',
    '  // Edge fade',
    '  col *= smoothstep(DISK_IN, DISK_IN + .5, r) * smoothstep(DISK_OUT, DISK_OUT - 2.0, r);',
    '  return col;',
    '}',
    '',
    'void main() {',
    '  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;',
    '',
    '  // ─── Camera ───',
    '  float sT = sin(uTheta), cT = cos(uTheta);',
    '  float sP = sin(uPhi), cP = cos(uPhi);',
    '',
    '  // Disk lies in xz-plane (y=0). Camera orbits the BH.',
    '  vec3 camPos = uDist * vec3(sT * sP, cT, sT * cP);',
    '  vec3 camFwd = normalize(-camPos);',
    '',
    '  // Camera basis (handle pole singularity)',
    '  vec3 up = abs(cT) > 0.999 ? vec3(0, 0, -1) : vec3(0, 1, 0);',
    '  vec3 camR = normalize(cross(camFwd, up));',
    '  vec3 camU = cross(camR, camFwd);',
    '',
    '  // Ray direction (FOV ~67 degrees)',
    '  vec3 rd = normalize(camFwd * 1.5 + camR * uv.x + camU * uv.y);',
    '',
    '  // ─── Ray march: Schwarzschild geodesic ───',
    '  // Photon acceleration: a = -1.5 * h^2 / r^5 * r_vec',
    '  // where h = |r x v| (specific angular momentum)',
    '  vec3 p = camPos;',
    '  vec3 v = rd;',
    '  vec3 color = vec3(0.0);',
    '  bool hit = false;',
    '',
    '  for (int i = 0; i < STEPS; i++) {',
    '    float r = length(p);',
    '',
    '    // Event horizon (Schwarzschild radius = 1)',
    '    if (r < 1.0) { color = vec3(0); hit = true; break; }',
    '',
    '    // Escaped far enough — sample background',
    '    if (r > 80.0) break;',
    '',
    '    // Geodesic equation',
    '    vec3 hv = cross(p, v);',
    '    float h2 = dot(hv, hv);',
    '    vec3 acc = -1.5 * h2 / (r * r * r * r * r) * p;',
    '',
    '    // Adaptive step: smaller near BH for accuracy',
    '    float dt = clamp(0.04 * r, 0.003, 1.0);',
    '',
    '    vec3 nv = v + acc * dt;',
    '    vec3 np = p + nv * dt;',
    '',
    '    // ─── Accretion disk crossing check ───',
    '    if (p.y * np.y < 0.0) {',
    '      float t = p.y / (p.y - np.y);',
    '      vec3 xp = mix(p, np, t);',
    '      float xr = length(vec2(xp.x, xp.z));',
    '',
    '      if (xr > DISK_IN && xr < DISK_OUT) {',
    '        // Keplerian orbital velocity for Doppler',
    '        float ov = sqrt(0.5 / xr);',
    '        vec3 od = normalize(vec3(-xp.z, 0, xp.x));',
    '        vec3 rv = normalize(mix(v, nv, t));',
    '        float dp = 1.0 / (1.0 + ov * dot(od, rv));',
    '        dp = clamp(dp, 0.25, 4.0);',
    '',
    '        float ang = atan(xp.x, xp.z);',
    '        color = diskColor(xr, dp, ang);',
    '        hit = true;',
    '        break;',
    '      }',
    '    }',
    '',
    '    v = nv;',
    '    p = np;',
    '  }',
    '',
    '  // Background stars for rays that escaped',
    '  if (!hit) {',
    '    color = starfield(normalize(v));',
    '  }',
    '',
    '  // Tone mapping (Reinhard) + gamma',
    '  color = color / (1.0 + color);',
    '  color = pow(color, vec3(1.0 / 2.2));',
    '',
    '  gl_FragColor = vec4(color, 1.0);',
    '}'
  ].join('\n');

  // ─── WebGL setup ───
  function compile(src, type) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var vs = compile(vsSrc, gl.VERTEX_SHADER);
  var fs = compile(fsSrc, gl.FRAGMENT_SHADER);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  // Fullscreen quad
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // Uniforms
  var uRes = gl.getUniformLocation(prog, 'uRes');
  var uDist = gl.getUniformLocation(prog, 'uDist');
  var uTheta = gl.getUniformLocation(prog, 'uTheta');
  var uPhi = gl.getUniformLocation(prog, 'uPhi');
  var uTime = gl.getUniformLocation(prog, 'uTime');

  // ─── State ───
  var camDist = 40.0, camDistTarget = 40.0;
  var camTheta = 1.484, camThetaTarget = 1.484;  // ~85° from pole
  var camPhi = 0.0, camPhiTarget = 0.0;
  var time = 0;
  var cssW = 0, cssH = 0;

  // ─── Resize ───
  function resize() {
    var wrap = canvas.parentElement;
    cssW = wrap.clientWidth;
    cssH = Math.min(cssW * 0.65, 560);
    // Render at 1x DPR — shader is expensive
    canvas.width = cssW;
    canvas.height = cssH;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  // ─── Mouse drag ───
  var dragging = false, dragX = 0, dragY = 0, dragT0 = 0, dragP0 = 0;

  canvas.addEventListener('mousedown', function (e) {
    dragging = true;
    dragX = e.clientX; dragY = e.clientY;
    dragT0 = camThetaTarget; dragP0 = camPhiTarget;
    e.preventDefault();
  });
  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    camThetaTarget = Math.max(0.05, Math.min(Math.PI * 0.495,
      dragT0 + (e.clientY - dragY) * 0.005));
    camPhiTarget = dragP0 - (e.clientX - dragX) * 0.005;
  });
  window.addEventListener('mouseup', function () { dragging = false; });

  // ─── Touch drag ───
  canvas.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    dragging = true;
    dragX = e.touches[0].clientX; dragY = e.touches[0].clientY;
    dragT0 = camThetaTarget; dragP0 = camPhiTarget;
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', function (e) {
    if (!dragging || e.touches.length !== 1) return;
    camThetaTarget = Math.max(0.05, Math.min(Math.PI * 0.495,
      dragT0 + (e.touches[0].clientY - dragY) * 0.005));
    camPhiTarget = dragP0 - (e.touches[0].clientX - dragX) * 0.005;
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', function () { dragging = false; });

  // ─── Slider ───
  slider.addEventListener('input', function () {
    camDistTarget = parseInt(slider.value, 10) / 10;
  });

  // ─── Keyboard ───
  var keys = {};
  function isInput(el) { var t = el && el.tagName; return t === 'INPUT' || t === 'TEXTAREA'; }
  document.addEventListener('keydown', function (e) {
    if (isInput(e.target)) return;
    keys[e.key] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) >= 0)
      e.preventDefault();
  });
  document.addEventListener('keyup', function (e) { keys[e.key] = false; });

  // ─── Render loop ───
  function frame() {
    var dt = 1 / 60;

    // Keyboard: arrows control distance and orbit
    if (keys['ArrowUp']) camDistTarget = Math.max(3.0, camDistTarget - 3.0 * dt);
    if (keys['ArrowDown']) camDistTarget = Math.min(40.0, camDistTarget + 3.0 * dt);
    if (keys['ArrowLeft']) camPhiTarget += 1.5 * dt;
    if (keys['ArrowRight']) camPhiTarget -= 1.5 * dt;

    // Smooth interpolation
    camDist += (camDistTarget - camDist) * Math.min(1, 4 * dt);
    camTheta += (camThetaTarget - camTheta) * Math.min(1, 4 * dt);
    camPhi += (camPhiTarget - camPhi) * Math.min(1, 4 * dt);

    // Sync slider
    slider.value = Math.round(camDist * 10);

    time += dt;

    // HUD
    var timeDilation = Math.sqrt(Math.max(0, 1 - 1 / camDist));
    hudDistance.textContent = camDist.toFixed(1) + ' Rs';
    hudDilation.textContent = timeDilation.toFixed(3);
    hudAngle.textContent = Math.round(camTheta * 180 / Math.PI) + '\u00B0';

    // Draw
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uDist, camDist);
    gl.uniform1f(uTheta, camTheta);
    gl.uniform1f(uPhi, camPhi);
    gl.uniform1f(uTime, time);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(frame);
  }

  // ─── Init ───
  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);
})();
