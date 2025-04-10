class GeometricVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.animationFrame = null;
        this.mouse = { x: null, y: null, radius: 150 };
        this.scrollY = 0;
        this.resize();
        
        // Initialize particles
        for (let i = 0; i < 200; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 1.5 + 0.5,
                targetSpeedX: (Math.random() - 0.5) * 0.01,
                targetSpeedY: (Math.random() - 0.5) * 0.01,
                currentSpeedX: 0,
                currentSpeedY: 0,
                baseX: Math.random() * this.canvas.width,
                baseY: Math.random() * this.canvas.height,
                brightness: Math.random(),
                twinkleSpeed: Math.random() * 0.02 + 0.01,
                twinkleDirection: Math.random() > 0.5 ? 1 : -1
            });
        }

        // Handle window resize
        window.addEventListener('resize', () => this.resize());
        
        // Mouse/touch interaction
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

        // Scroll interaction
        window.addEventListener('scroll', () => {
            this.scrollY = window.scrollY;
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Update particle positions
        this.particles.forEach(particle => {
            particle.baseX = Math.random() * this.canvas.width;
            particle.baseY = Math.random() * this.canvas.height;
        });
    }

    update() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update and draw particles
        this.particles.forEach(particle => {
            // Gradually accelerate to target speed
            particle.currentSpeedX += (particle.targetSpeedX - particle.currentSpeedX) * 0.01;
            particle.currentSpeedY += (particle.targetSpeedY - particle.currentSpeedY) * 0.01;

            // Calculate distance from mouse
            let dx = this.mouse.x - particle.x;
            let dy = this.mouse.y - particle.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            
            // Mouse interaction
            if (this.mouse.x !== null && this.mouse.y !== null) {
                if (distance < this.mouse.radius) {
                    const angle = Math.atan2(dy, dx);
                    const force = (this.mouse.radius - distance) / this.mouse.radius;
                    particle.x -= Math.cos(angle) * force * 1.5;
                    particle.y -= Math.sin(angle) * force * 1.5;
                }
            }

            // Scroll interaction
            const scrollEffect = this.scrollY * 0.1;
            particle.y += Math.sin(scrollEffect * 1) * 1;
            particle.x += Math.cos(scrollEffect * 1) * 1;

            // Apply current speed
            particle.x += particle.currentSpeedX;
            particle.y += particle.currentSpeedY;

            // Return to base position
            particle.x += (particle.baseX - particle.x) * 0.005;
            particle.y += (particle.baseY - particle.y) * 0.005;

            // Update twinkling effect
            particle.brightness += particle.twinkleSpeed * particle.twinkleDirection;
            if (particle.brightness > 1) {
                particle.brightness = 1;
                particle.twinkleDirection = -1;
            } else if (particle.brightness < 0.3) {
                particle.brightness = 0.3;
                particle.twinkleDirection = 1;
            }

            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${particle.brightness})`;
            this.ctx.fill();
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const visualizer = new GeometricVisualizer('geometric-canvas');
    visualizer.start();
}); 