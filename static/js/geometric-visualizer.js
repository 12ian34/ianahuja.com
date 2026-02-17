class GeometricVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.foregroundParticles = [];
        this.shootingStars = [];
        this.satellites = [];
        this.nebulae = [];
        this.animationFrame = null;
        this.mouse = { x: null, y: null, radius: 150 };
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
            const p = {
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
                color: color,
                novaTimer: 0,
                novaDuration: 0,
                novaIntensity: 0,
            };
            this.particles.push(p);
            if (depth > 0.35) this.foregroundParticles.push(p);
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

        this.particles.forEach(particle => {
            particle.baseX = Math.random() * this.canvas.width;
            particle.baseY = Math.random() * this.canvas.height;
        });
    }

    spawnShootingStar() {
        const startX = Math.random() * this.canvas.width * 1.2 - this.canvas.width * 0.1;
        const startY = Math.random() * this.canvas.height * 0.5;
        const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.2;
        const speed = 4 + Math.random() * 4;
        this.shootingStars.push({
            x: startX,
            y: startY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            decay: 0.008 + Math.random() * 0.012,
            length: 40 + Math.random() * 60,
            width: 1 + Math.random() * 1.5,
        });
    }

    spawnSatellite() {
        const edge = Math.random();
        let startX, startY, endX, endY;
        if (edge < 0.5) {
            startX = -10;
            startY = Math.random() * this.canvas.height * 0.6;
            endX = this.canvas.width + 10;
            endY = startY + (Math.random() - 0.3) * this.canvas.height * 0.4;
        } else {
            startX = this.canvas.width + 10;
            startY = Math.random() * this.canvas.height * 0.6;
            endX = -10;
            endY = startY + (Math.random() - 0.3) * this.canvas.height * 0.4;
        }
        const dx = endX - startX;
        const dy = endY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = 0.6 + Math.random() * 0.4;
        this.satellites.push({
            x: startX,
            y: startY,
            vx: (dx / dist) * speed,
            vy: (dy / dist) * speed,
            life: 1.0,
            maxDist: dist,
            traveled: 0,
            brightness: 0.5 + Math.random() * 0.3,
            size: 0.8 + Math.random() * 0.4,
        });
    }

    spawnNebula(seeded) {
        const nebulaColors = [
            { r: 180, g: 140, b: 255 },
            { r: 120, g: 200, b: 255 },
            { r: 140, g: 220, b: 240 },
            { r: 200, g: 120, b: 220 },
            { r: 120, g: 200, b: 220 },
        ];
        const color = nebulaColors[Math.floor(Math.random() * nebulaColors.length)];
        const neb = {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            radius: 60 + Math.random() * 80,
            color: color,
            life: seeded ? 0.6 + Math.random() * 0.4 : 0,
            maxLife: 1.0,
            fadeIn: 0.004 + Math.random() * 0.003,
            fadeOut: 0.001 + Math.random() * 0.001,
            phase: seeded ? 'hold' : 'in',
            driftX: (Math.random() - 0.5) * 0.08,
            driftY: (Math.random() - 0.5) * 0.05,
            maxAlpha: 0.25 + Math.random() * 0.15,
        };
        if (seeded) neb.holdTimer = 8 + Math.random() * 15;
        this.nebulae.push(neb);
    }

    update() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.time += 0.016;

        // Spawn events
        if (Math.random() < 0.008) this.spawnShootingStar();
        if (Math.random() < 0.004) this.spawnSatellite();
        if (Math.random() < 0.001 && this.nebulae.length < 6) this.spawnNebula();

        // Trigger nova (~every 4-6 seconds)
        if (Math.random() < 0.004) {
            const candidate = this.particles[Math.floor(Math.random() * this.particles.length)];
            if (candidate.novaTimer <= 0) {
                const duration = 3 + Math.random() * 2;
                candidate.novaTimer = duration;
                candidate.novaDuration = duration;
                candidate.novaIntensity = 0;
            }
        }

        // Draw nebulae (behind everything)
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
            const gradient = this.ctx.createRadialGradient(
                neb.x, neb.y, 0,
                neb.x, neb.y, neb.radius
            );
            gradient.addColorStop(0, `rgba(${neb.color.r}, ${neb.color.g}, ${neb.color.b}, ${alpha})`);
            gradient.addColorStop(0.5, `rgba(${neb.color.r}, ${neb.color.g}, ${neb.color.b}, ${alpha * 0.4})`);
            gradient.addColorStop(1, `rgba(${neb.color.r}, ${neb.color.g}, ${neb.color.b}, 0)`);
            this.ctx.beginPath();
            this.ctx.arc(neb.x, neb.y, neb.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.fill();
            return true;
        });

        // Constellation lines (only foreground stars for performance)
        const fg = this.foregroundParticles;
        this.ctx.lineWidth = 0.5;
        for (let i = 0; i < fg.length; i++) {
            for (let j = i + 1; j < fg.length; j++) {
                const a = fg[i];
                const b = fg[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const threshold = 80 + (a.depth + b.depth) * 20;
                if (dist < threshold) {
                    const alpha = (1 - dist / threshold) * 0.15 * Math.min(a.brightness, b.brightness);
                    this.ctx.beginPath();
                    this.ctx.moveTo(a.x, a.y);
                    this.ctx.lineTo(b.x, b.y);
                    this.ctx.strokeStyle = `rgba(200, 220, 255, ${alpha})`;
                    this.ctx.stroke();
                }
            }
        }

        // Update and draw particles
        this.particles.forEach(particle => {
            particle.currentSpeedX += (particle.targetSpeedX - particle.currentSpeedX) * 0.01;
            particle.currentSpeedY += (particle.targetSpeedY - particle.currentSpeedY) * 0.01;

            let dx = this.mouse.x - particle.x;
            let dy = this.mouse.y - particle.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (this.mouse.x !== null && this.mouse.y !== null) {
                const effectiveRadius = this.mouse.radius * (0.8 + particle.depth * 0.6);
                if (distance < effectiveRadius) {
                    const angle = Math.atan2(dy, dx);
                    const force = (effectiveRadius - distance) / effectiveRadius;
                    particle.x -= Math.cos(angle) * force * (1 + particle.depth) * 1.2;
                    particle.y -= Math.sin(angle) * force * (1 + particle.depth) * 1.2;
                }
            }

            const scrollFactor = particle.depth * 0.15 + 0.02;
            particle.y += Math.sin(this.scrollY * 0.05) * scrollFactor * 2;

            particle.x += particle.currentSpeedX;
            particle.y += particle.currentSpeedY;

            particle.x += (particle.baseX - particle.x) * 0.005;
            particle.y += (particle.baseY - particle.y) * 0.005;

            // Twinkling
            const twinkleWave = Math.sin(this.time * particle.twinkleSpeed * 60 + particle.twinklePhase);
            particle.brightness = 0.3 + (twinkleWave * 0.5 + 0.5) * 0.7;

            // Nova flare
            let novaGlow = 0;
            if (particle.novaTimer > 0) {
                particle.novaTimer -= 0.016;
                const dur = particle.novaDuration;
                const t = 1 - (particle.novaTimer / dur);
                if (t < 0.1) {
                    particle.novaIntensity = t / 0.1;
                } else {
                    particle.novaIntensity = Math.max(0, 1 - (t - 0.1) / 0.9);
                }
                novaGlow = particle.novaIntensity;
                particle.brightness = Math.min(1, particle.brightness + novaGlow * 0.7);
            }

            const { r, g, b } = particle.color;

            // Nova halo
            if (novaGlow > 0.02) {
                const haloRadius = 15 + novaGlow * 30;
                const gradient = this.ctx.createRadialGradient(
                    particle.x, particle.y, 0,
                    particle.x, particle.y, haloRadius
                );
                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${novaGlow * 0.7})`);
                gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${novaGlow * 0.3})`);
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, haloRadius, 0, Math.PI * 2);
                this.ctx.fillStyle = gradient;
                this.ctx.fill();
            }

            // Normal glow for larger/brighter stars
            if (particle.size > 1.2 && particle.brightness > 0.7) {
                const gradient = this.ctx.createRadialGradient(
                    particle.x, particle.y, 0,
                    particle.x, particle.y, particle.size * 3
                );
                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${particle.brightness * 0.3})`);
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2);
                this.ctx.fillStyle = gradient;
                this.ctx.fill();
            }

            // Draw star core
            const drawSize = particle.baseSize + novaGlow * 3;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, drawSize, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${particle.brightness})`;
            this.ctx.fill();
        });

        // Draw satellites
        this.satellites = this.satellites.filter(sat => {
            sat.x += sat.vx;
            sat.y += sat.vy;
            sat.traveled += Math.sqrt(sat.vx * sat.vx + sat.vy * sat.vy);

            if (sat.traveled >= sat.maxDist) return false;

            const edgeFade = Math.min(1, sat.traveled / 80, (sat.maxDist - sat.traveled) / 80);
            const alpha = sat.brightness * edgeFade;

            this.ctx.beginPath();
            this.ctx.arc(sat.x, sat.y, sat.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.fill();

            return true;
        });

        // Draw shooting stars
        this.shootingStars = this.shootingStars.filter(star => {
            star.x += star.vx;
            star.y += star.vy;
            star.life -= star.decay;

            if (star.life <= 0) return false;

            const speed = Math.sqrt(star.vx * star.vx + star.vy * star.vy);
            const tailX = star.x - (star.vx / speed) * star.length * star.life;
            const tailY = star.y - (star.vy / speed) * star.length * star.life;

            const gradient = this.ctx.createLinearGradient(tailX, tailY, star.x, star.y);
            gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
            gradient.addColorStop(0.6, `rgba(200, 220, 255, ${star.life * 0.4})`);
            gradient.addColorStop(1, `rgba(255, 255, 255, ${star.life * 0.9})`);

            this.ctx.beginPath();
            this.ctx.moveTo(tailX, tailY);
            this.ctx.lineTo(star.x, star.y);
            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = star.width * star.life;
            this.ctx.lineCap = 'round';
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.width * star.life * 0.8, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${star.life * 0.8})`;
            this.ctx.fill();

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
