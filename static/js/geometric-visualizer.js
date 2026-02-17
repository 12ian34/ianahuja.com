class GeometricVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.shootingStars = [];
        this.satellites = [];
        this.nebulae = [];
        this.animationFrame = null;
        this.mouse = { x: null, y: null, radius: 150 };
        this.mouseRadiusSq = 150 * 150;
        this.scrollY = 0;
        this.time = 0;
        this.resize();

        const starColors = [
            { r: 255, g: 255, b: 255 },
            { r: 200, g: 220, b: 255 },
            { r: 255, g: 240, b: 220 },
            { r: 180, g: 210, b: 255 },
            { r: 255, g: 225, b: 200 },
        ];

        for (let i = 0; i < 400; i++) {
            const depth = Math.random();
            const size = depth * 1.8 + 0.3;
            const color = starColors[Math.floor(Math.random() * starColors.length)];
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: size,
                baseSize: size,
                depth: depth,
                targetSpeedX: (Math.random() - 0.5) * 0.015 * (depth + 0.3),
                targetSpeedY: (Math.random() - 0.5) * 0.015 * (depth + 0.3),
                currentSpeedX: 0,
                currentSpeedY: 0,
                baseX: Math.random() * this.canvas.width,
                baseY: Math.random() * this.canvas.height,
                brightness: Math.random(),
                twinkleSpeed: Math.random() * 0.025 + 0.008,
                twinklePhase: Math.random() * Math.PI * 2,
                r: color.r, g: color.g, b: color.b,
                novaTimer: 0,
                novaDuration: 0,
                novaIntensity: 0,
            });
        }

        for (let i = 0; i < 3; i++) {
            this.spawnNebula(true);
        }

        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.touches[0].clientX - rect.left;
            this.mouse.y = e.touches[0].clientY - rect.top;
        });

        this.canvas.addEventListener('mouseout', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });

        window.addEventListener('scroll', () => {
            this.scrollY = window.scrollY;
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.particles.forEach(p => {
            p.baseX = Math.random() * this.canvas.width;
            p.baseY = Math.random() * this.canvas.height;
        });
    }

    spawnShootingStar() {
        const startX = Math.random() * this.canvas.width * 1.2 - this.canvas.width * 0.1;
        const startY = Math.random() * this.canvas.height * 0.5;
        const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.2;
        const speed = 4 + Math.random() * 4;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        this.shootingStars.push({
            x: startX, y: startY,
            vx: vx, vy: vy, speed: speed,
            life: 1.0,
            decay: 0.008 + Math.random() * 0.012,
            length: 40 + Math.random() * 60,
            width: 1 + Math.random() * 1.5,
        });
    }

    spawnSatellite() {
        const goRight = Math.random() < 0.5;
        const startX = goRight ? -10 : this.canvas.width + 10;
        const startY = Math.random() * this.canvas.height * 0.6;
        const endX = goRight ? this.canvas.width + 10 : -10;
        const endY = startY + (Math.random() - 0.3) * this.canvas.height * 0.4;
        const dx = endX - startX;
        const dy = endY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = 0.6 + Math.random() * 0.4;
        this.satellites.push({
            x: startX, y: startY,
            vx: (dx / dist) * speed, vy: (dy / dist) * speed,
            speed: speed, maxDist: dist, traveled: 0,
            brightness: 0.5 + Math.random() * 0.3,
            size: 0.8 + Math.random() * 0.4,
        });
    }

    spawnNebula(seeded) {
        const colors = [
            [180, 140, 255], [120, 200, 255], [140, 220, 240],
            [200, 120, 220], [120, 200, 220],
        ];
        const c = colors[Math.floor(Math.random() * colors.length)];
        const neb = {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            radius: 60 + Math.random() * 80,
            r: c[0], g: c[1], b: c[2],
            life: seeded ? 0.6 + Math.random() * 0.4 : 0,
            maxLife: 1.0,
            fadeIn: 0.004 + Math.random() * 0.003,
            fadeOut: 0.001 + Math.random() * 0.001,
            phase: seeded ? 'hold' : 'in',
            driftX: (Math.random() - 0.5) * 0.08,
            driftY: (Math.random() - 0.5) * 0.05,
            maxAlpha: 0.25 + Math.random() * 0.15,
            holdTimer: seeded ? 8 + Math.random() * 15 : 0,
        };
        this.nebulae.push(neb);
    }

    update() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);
        this.time += 0.016;

        if (Math.random() < 0.008) this.spawnShootingStar();
        if (Math.random() < 0.004) this.spawnSatellite();
        if (Math.random() < 0.001 && this.nebulae.length < 6) this.spawnNebula();

        if (Math.random() < 0.004) {
            const p = this.particles[Math.floor(Math.random() * this.particles.length)];
            if (p.novaTimer <= 0) {
                const dur = 3 + Math.random() * 2;
                p.novaTimer = dur;
                p.novaDuration = dur;
                p.novaIntensity = 0;
            }
        }

        // Nebulae
        this.nebulae = this.nebulae.filter(neb => {
            neb.x += neb.driftX;
            neb.y += neb.driftY;

            if (neb.phase === 'in') {
                neb.life += neb.fadeIn;
                if (neb.life >= neb.maxLife) {
                    neb.life = neb.maxLife;
                    neb.phase = 'hold';
                    neb.holdTimer = 5 + Math.random() * 10;
                }
            } else if (neb.phase === 'hold') {
                neb.holdTimer -= 0.016;
                if (neb.holdTimer <= 0) neb.phase = 'out';
            } else {
                neb.life -= neb.fadeOut;
                if (neb.life <= 0) return false;
            }

            const alpha = neb.life * neb.maxAlpha;
            const grad = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.radius);
            grad.addColorStop(0, `rgba(${neb.r},${neb.g},${neb.b},${alpha})`);
            grad.addColorStop(0.5, `rgba(${neb.r},${neb.g},${neb.b},${alpha * 0.4})`);
            grad.addColorStop(1, `rgba(${neb.r},${neb.g},${neb.b},0)`);
            ctx.beginPath();
            ctx.arc(neb.x, neb.y, neb.radius, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            return true;
        });

        // Particles
        const hasMouse = this.mouse.x !== null;
        const mx = this.mouse.x;
        const my = this.mouse.y;
        const mRadiusSq = this.mouseRadiusSq;
        const scrollSin = Math.sin(this.scrollY * 0.05);

        for (let i = 0, len = this.particles.length; i < len; i++) {
            const p = this.particles[i];

            p.currentSpeedX += (p.targetSpeedX - p.currentSpeedX) * 0.01;
            p.currentSpeedY += (p.targetSpeedY - p.currentSpeedY) * 0.01;

            if (hasMouse) {
                const dx = mx - p.x;
                const dy = my - p.y;
                const distSq = dx * dx + dy * dy;
                const effRadius = this.mouse.radius * (0.8 + p.depth * 0.6);
                if (distSq < effRadius * effRadius) {
                    const dist = Math.sqrt(distSq);
                    const angle = Math.atan2(dy, dx);
                    const force = (effRadius - dist) / effRadius;
                    p.x -= Math.cos(angle) * force * (1 + p.depth) * 1.2;
                    p.y -= Math.sin(angle) * force * (1 + p.depth) * 1.2;
                }
            }

            p.y += scrollSin * (p.depth * 0.15 + 0.02) * 2;
            p.x += p.currentSpeedX;
            p.y += p.currentSpeedY;
            p.x += (p.baseX - p.x) * 0.005;
            p.y += (p.baseY - p.y) * 0.005;

            const twinkle = Math.sin(this.time * p.twinkleSpeed * 60 + p.twinklePhase);
            p.brightness = 0.3 + (twinkle * 0.5 + 0.5) * 0.7;

            let novaGlow = 0;
            if (p.novaTimer > 0) {
                p.novaTimer -= 0.016;
                const t = 1 - (p.novaTimer / p.novaDuration);
                p.novaIntensity = t < 0.1 ? t / 0.1 : Math.max(0, 1 - (t - 0.1) / 0.9);
                novaGlow = p.novaIntensity;
                p.brightness = Math.min(1, p.brightness + novaGlow * 0.7);
            }

            // Nova halo
            if (novaGlow > 0.02) {
                const hr = 15 + novaGlow * 30;
                const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, hr);
                grad.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${novaGlow * 0.7})`);
                grad.addColorStop(0.3, `rgba(${p.r},${p.g},${p.b},${novaGlow * 0.3})`);
                grad.addColorStop(1, `rgba(${p.r},${p.g},${p.b},0)`);
                ctx.beginPath();
                ctx.arc(p.x, p.y, hr, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();
            }

            // Glow for bright stars
            if (p.size > 1.2 && p.brightness > 0.7) {
                const gr = p.size * 3;
                const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
                grad.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${p.brightness * 0.3})`);
                grad.addColorStop(1, `rgba(${p.r},${p.g},${p.b},0)`);
                ctx.beginPath();
                ctx.arc(p.x, p.y, gr, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();
            }

            // Star core
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.baseSize + novaGlow * 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.brightness})`;
            ctx.fill();
        }

        // Satellites
        this.satellites = this.satellites.filter(sat => {
            sat.x += sat.vx;
            sat.y += sat.vy;
            sat.traveled += sat.speed;
            if (sat.traveled >= sat.maxDist) return false;

            const alpha = sat.brightness * Math.min(1, sat.traveled / 80, (sat.maxDist - sat.traveled) / 80);
            ctx.beginPath();
            ctx.arc(sat.x, sat.y, sat.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.fill();
            return true;
        });

        // Shooting stars
        this.shootingStars = this.shootingStars.filter(star => {
            star.x += star.vx;
            star.y += star.vy;
            star.life -= star.decay;
            if (star.life <= 0) return false;

            const inv = 1 / star.speed;
            const tailX = star.x - star.vx * inv * star.length * star.life;
            const tailY = star.y - star.vy * inv * star.length * star.life;

            const grad = ctx.createLinearGradient(tailX, tailY, star.x, star.y);
            grad.addColorStop(0, 'rgba(255,255,255,0)');
            grad.addColorStop(0.6, `rgba(200,220,255,${star.life * 0.4})`);
            grad.addColorStop(1, `rgba(255,255,255,${star.life * 0.9})`);

            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(star.x, star.y);
            ctx.strokeStyle = grad;
            ctx.lineWidth = star.width * star.life;
            ctx.lineCap = 'round';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(star.x, star.y, star.width * star.life * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${star.life * 0.8})`;
            ctx.fill();
            return true;
        });

        this.animationFrame = requestAnimationFrame(() => this.update());
    }

    start() {
        this.update();
    }

    stop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const visualizer = new GeometricVisualizer('geometric-canvas');
    visualizer.start();
});
