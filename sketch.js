let flock;
let murmurationSound;
let repelSound;
let repelPoints = [];

// Weather and environment variables
let currentTemp = 273;
let currentHumidity = 50;
let weatherCondition = "clear";
let canvas;

function preload() {
    // Load sounds - ensure these files exist in your project
    soundFormats('mp3');
    murmurationSound = loadSound('assets/murmuration.mp3');
    repelSound = loadSound('assets/repel.mp3');
}

function setup() {
    // Create canvas inside container
    const container = document.getElementById('canvas-container');
    canvas = createCanvas(container.offsetWidth - 40, container.offsetHeight - 40);
    canvas.parent('canvas-container');

    // Initialize flock
    flock = new Flock();
    for (let i = 0; i < 200; i++) {
        let b = new Boid(width / 2, height / 2);
        flock.addBoid(b);
    }

    // Start sound
    murmurationSound.loop();
    murmurationSound.setVolume(0.5);
}

function draw() {
    background(248, 248, 248);

    // Get current slider values
    let daylightValue = document.getElementById('daylight-slider').value;
    let skyCondition = document.getElementById('sky-slider').value;
    let humidity = document.getElementById('humidity-slider').value;

    // Update environmental effects
    updateEnvironment(daylightValue, skyCondition, humidity);
    
    // Run flock simulation
    flock.run();
    
    // Handle repel points if any exist
    if (repelPoints.length > 0) {
        flock.repelMultiple(repelPoints);
    }

    // Adjust sound based on flock behavior
    adjustSound();
}

function updateEnvironment(daylight, sky, humidity) {
    // Update boid behavior based on environmental conditions
    for (let boid of flock.boids) {
        boid.updateEnvironmentalEffects(daylight, sky, humidity);
    }

    // Adjust flock size based on daylight
    let targetCount = map(daylight, 0, 1, 100, 300);
    adjustFlockSize(targetCount);

    // Update background based on sky condition
    let alpha = map(sky, 0, 1, 20, 5);
    if (frameCount % 60 === 0) { // Add occasional "rain" effect if stormy
        if (sky < 0.3) {
            background(240, 240, 240, alpha);
        }
    }
}

function adjustFlockSize(target) {
    while (flock.boids.length > target) flock.boids.pop();
    while (flock.boids.length < target) {
        let b = new Boid(random(width), random(height));
        flock.addBoid(b);
    }
}

function adjustSound() {
    let avgSpeed = flock.getAverageSpeed();
    murmurationSound.rate(map(avgSpeed, 2, 7, 0.8, 1.5));
    let density = flock.boids.length / 300;
    murmurationSound.setVolume(density * 0.5);
}

function mousePressed() {
    if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
        repelPoints.push(createVector(mouseX, mouseY));
        if (!repelSound.isPlaying()) {
            repelSound.play();
        }
    }
}

function mouseReleased() {
    repelPoints = [];
    if (repelSound.isPlaying()) {
        repelSound.stop();
    }
}

// Flock class
class Flock {
    constructor() {
        this.boids = [];
    }

    run() {
        for (let boid of this.boids) {
            boid.run(this.boids);
        }
    }

    addBoid(b) {
        this.boids.push(b);
    }

    repelMultiple(points) {
        for (let point of points) {
            for (let boid of this.boids) {
                let d = p5.Vector.dist(boid.position, point);
                if (d < 100) {
                    let force = p5.Vector.sub(boid.position, point);
                    force.setMag(map(d, 0, 100, 0.5, 0));
                    boid.applyForce(force);
                }
            }
        }
    }

    getAverageSpeed() {
        return this.boids.reduce((sum, boid) => sum + boid.velocity.mag(), 0) / this.boids.length;
    }
}

// Boid class
class Boid {
    constructor(x, y) {
        this.position = createVector(x, y);
        this.velocity = p5.Vector.random2D();
        this.acceleration = createVector(0, 0);
        this.maxSpeed = 3;
        this.maxForce = 0.05;
        this.size = 3;
    }

    run(boids) {
        this.flock(boids);
        this.update();
        this.borders();
        this.render();
    }

    updateEnvironmentalEffects(daylight, sky, humidity) {
        // Adjust speed based on conditions
        this.maxSpeed = map(daylight, 0, 1, 2, 4);
        if (sky < 0.3) this.maxSpeed *= 1.5; // Faster in storms
        
        // Adjust force based on humidity
        this.maxForce = map(humidity, 0, 100, 0.08, 0.03);
    }

    applyForce(force) {
        this.acceleration.add(force);
    }

    flock(boids) {
        let separation = this.separate(boids);
        let alignment = this.align(boids);
        let cohesion = this.cohesion(boids);

        separation.mult(2.0);
        alignment.mult(1.0);
        cohesion.mult(1.0);

        this.applyForce(separation);
        this.applyForce(alignment);
        this.applyForce(cohesion);
    }

    update() {
        this.velocity.add(this.acceleration);
        this.velocity.limit(this.maxSpeed);
        this.position.add(this.velocity);
        this.acceleration.mult(0);
    }

    borders() {
        if (this.position.x < -this.size) this.position.x = width + this.size;
        if (this.position.y < -this.size) this.position.y = height + this.size;
        if (this.position.x > width + this.size) this.position.x = -this.size;
        if (this.position.y > height + this.size) this.position.y = -this.size;
    }

    render() {
        let theta = this.velocity.heading() + PI / 2;
        fill(51);
        stroke(200);
        push();
        translate(this.position.x, this.position.y);
        rotate(theta);
        beginShape();
        vertex(0, -this.size * 2);
        vertex(-this.size, this.size * 2);
        vertex(this.size, this.size * 2);
        endShape(CLOSE);
        pop();
    }

    separate(boids) {
        let desiredSeparation = 25.0;
        let steer = createVector(0, 0);
        let count = 0;

        for (let other of boids) {
            let d = p5.Vector.dist(this.position, other.position);
            if (d > 0 && d < desiredSeparation) {
                let diff = p5.Vector.sub(this.position, other.position);
                diff.normalize();
                diff.div(d);
                steer.add(diff);
                count++;
            }
        }

        if (count > 0) {
            steer.div(count);
            if (steer.mag() > 0) {
                steer.normalize();
                steer.mult(this.maxSpeed);
                steer.sub(this.velocity);
                steer.limit(this.maxForce);
            }
        }
        return steer;
    }

    align(boids) {
        let neighbor
