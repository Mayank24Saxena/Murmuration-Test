let flock;
let weatherData;
let apiURL = "https://api.openweathermap.org/data/2.5/weather?q=Bengaluru&APPID=aacedc9a30cfcbe4d7e237cd5ad4830b";

let currentTemp = 273;
let targetTemp = 273;
let currentHumidity = 50;
let targetHumidity = 50;
let daylightValue = 0;
let weatherCondition = "";

// Input elements
let dateInput;
let timeInput;
let generateButton;
let daylightSlider;
let skyConditionSlider;
let humiditySlider;

let murmurationSound;
let repelSound;
let repelPoints = [];

function preload() {
  // Note: You'll need to provide these sound files
  murmurationSound = loadSound("STARLINGS.mp3");
  repelSound = loadSound("FLIGHT.mp3");
}

function setup() {
  // Create canvas and position it
  let canvas = createCanvas(1200, 600);
  canvas.parent('sketch-holder'); // Assuming you have a div with this ID
  
  // Create input elements
  dateInput = createInput('', 'date');
  dateInput.position(10, height + 10);
  dateInput.style('margin-right', '10px');
  
  timeInput = createInput('', 'time');
  timeInput.position(200, height + 10);
  timeInput.style('margin-right', '10px');
  
  generateButton = createButton('Generate');
  generateButton.position(390, height + 10);
  generateButton.mousePressed(generateFlockSnapshot);

  // Create sliders
  daylightSlider = createSlider(0, 1, 0.5, 0.01);
  daylightSlider.position(10, height + 50);
  
  skyConditionSlider = createSlider(0, 1, 0.5, 0.01);
  skyConditionSlider.position(10, height + 90);
  
  humiditySlider = createSlider(0, 100, 50, 1);
  humiditySlider.position(10, height + 130);

  // Create labels
  createP('Daylight Level').position(160, height + 35);
  createP('Sky Condition').position(160, height + 75);
  createP('Humidity Level').position(160, height + 115);

  // Initialize flock
  flock = new Flock();
  for (let i = 0; i < 2000; i++) {
    let b = new Boid(width / 2 + random(-50, 50), height / 2 + random(-50, 50));
    flock.addBoid(b);
  }

  // Start sound and load weather
  murmurationSound.loop();
  loadWeatherData();
  setInterval(loadWeatherData, 10000);
}

function generateFlockSnapshot() {
  // Validate inputs
  if (!dateInput.value() || !timeInput.value()) {
    alert('Please enter both date and time');
    return;
  }

  // Generate random values
  let randomDaylight = random(0, 1);
  let randomSky = random(0, 1);
  let randomHumidity = random(0, 100);

  // Set slider values
  daylightSlider.value(randomDaylight);
  skyConditionSlider.value(randomSky);
  humiditySlider.value(randomHumidity);

  // Force one frame update
  draw();

  // Create filename with date and time
  let dateTimeStr = dateInput.value() + '_' + timeInput.value().replace(':', '-');
  let filename = 'murmuration_' + dateTimeStr + '.png';

  // Save canvas
  saveCanvas(filename, 'png');
}

function draw() {
  background(255);

  // Update environmental values
  daylightValue = daylightSlider.value();
  let skyConditionValue = skyConditionSlider.value();
  currentHumidity = humiditySlider.value();

  if (weatherData) {
    currentTemp = lerp(currentTemp, targetTemp, 0.05);
    currentHumidity = lerp(currentHumidity, targetHumidity, 0.05);

    for (let boid of flock.boids) {
      boid.updateWeatherEffects(currentTemp, currentHumidity, weatherCondition, daylightValue, skyConditionValue);
    }
  }

  flock.run();
  adjustBoidCount(daylightValue, skyConditionValue);
  adjustSoundVolumeAndPitch();

  if (repelPoints.length > 0) {
    flock.repelMultiple(repelPoints);
  }
}

// Existing helper functions
function adjustBoidCount(daylightValue, skyConditionValue) {
  let targetBoidCount = map(daylightValue, 0, 1, 500, 1700);
  while (flock.boids.length > targetBoidCount) flock.boids.pop();
  while (flock.boids.length < targetBoidCount) {
    let b = new Boid(width / 2 + random(-100, 100), height / 2 + random(-100, 100));
    flock.addBoid(b);
  }
}

function adjustSoundVolumeAndPitch() {
  let avgSpeed = flock.getAverageSpeed();
  murmurationSound.rate(map(avgSpeed, 2, 7, 0.8, 1.5));
  let density = flock.boids.length / 1200;
  murmurationSound.setVolume(density);
}

function mousePressed() {
  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    repelPoints.push(createVector(mouseX, mouseY));
    repelSound.setVolume(0.1);
    repelSound.play(0, 1, 0.2, 0, 1.5);
  }
}

function mouseReleased() {
  if (repelSound.isPlaying()) {
    repelSound.fade(0, 1.5);
  }
  repelPoints = [];
}

// Weather data handling
function loadWeatherData() {
  loadJSON(apiURL, processWeatherData, handleError);
}

function processWeatherData(data) {
  weatherData = data;
  targetTemp = weatherData.main.temp;
  targetHumidity = weatherData.main.humidity;
  weatherCondition = weatherData.weather[0].description;

  let now = millis() / 1000 + weatherData.timezone;
  let sunrise = weatherData.sys.sunrise;
  let sunset = weatherData.sys.sunset;

  daylightValue = (now < sunrise || now > sunset) ? 0 : map(now, sunrise, sunset, 0, 1);
}

function handleError(err) {
  console.error("Error loading weather data:", err);
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

  repelMultiple(points) {
    for (let point of points) {
      for (let boid of this.boids) {
        let distance = p5.Vector.dist(boid.position, point);
        if (distance < 200) {
          let repelForce = p5.Vector.sub(boid.position, point);
          repelForce.setMag(map(distance, 0, 200, boid.maxforce * 20, 0));
          boid.applyForce(repelForce);
        }
      }
    }
  }

  addBoid(b) {
    this.boids.push(b);
  }

  getAverageSpeed() {
    let totalSpeed = 0;
    for (let boid of this.boids) {
      totalSpeed += boid.velocity.mag();
    }
    return totalSpeed / this.boids.length;
  }
}

// Boid class
class Boid {
  constructor(x, y) {
    this.acceleration = createVector(0, 0);
    this.velocity = createVector(random(-1, 1), random(-1, 1));
    this.position = createVector(x, y);
    this.r = 1.5;
    this.maxspeed = 3;
    this.maxforce = 0.3;
    this.separationFactor = 20.0;
    this.cohesionFactor = 20.0;
  }

  run(boids) {
    this.flock(boids);
    this.update();
    this.borders();
    this.render();
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  updateWeatherEffects(temp, humidity, skyCondition, daylightValue, skyConditionValue) {
    let tempFactor = map(temp, 270, 310, 1.0, 2.0);
    this.cohesionFactor = tempFactor;

    let humidityFactor = map(humidity, 0, 100, 1.0, 3.0);
    this.separationFactor = humidityFactor;

    if (skyConditionValue < 0.5) {
      this.maxspeed = 7;
      this.maxforce = 0.5;
    } else {
      this.maxspeed = 3;
      this.maxforce = 0.3;
    }

    if (daylightValue < 0.2) {
      this.maxspeed = 2;
      this.maxforce = 0.2;
    }
  }

  flock(boids) {
    let sep = this.separate(boids).mult(this.separationFactor);
    let ali = this.align(boids).mult(2);
    let coh = this.cohesion(boids).mult(this.cohesionFactor);

    this.applyForce(sep);
    this.applyForce(ali);
    this.applyForce(coh);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxspeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
  }

  render() {
    let theta = this.velocity.heading() + radians(90);
    fill(50);
    stroke(50);
    push();
    translate(this.position.x, this.position.y);
    rotate(theta);
    beginShape();
    vertex(0, -this.r * 2);
    vertex(-this.r, this.r * 2);
    vertex(this.r, this.r * 2);
    endShape(CLOSE);
    pop();
  }

  borders() {
    let margin = 220;
    if (this.position.x < margin) this.applyForce(createVector(this.maxforce, 0));
    if (this.position.y < margin) this.applyForce(createVector(0, this.maxforce));
    if (this.position.x > width - margin) this.applyForce(createVector(-this.maxforce, 0));
    if (this.position.y > height - margin) this.applyForce(createVector(0, -this.maxforce));
  }

  separate(boids) {
    let desiredSeparation = 20.0;
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
        steer.mult(this.maxspeed);
        steer.sub(this.velocity);
        steer.limit(this.maxforce);
      }
    }
    return steer;
  }

  align(boids) {
    let neighborDist = 30;
    let sum = createVector(0, 0);
    let count = 0;

    for (let other of boids) {
      let d = p5.Vector.dist(this.position, other.position);
      if (d > 0 && d < neighborDist) {
        sum.add(other.velocity);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count);
      sum.normalize();
      sum.mult(this.maxspeed);
      let steer = p5.Vector.sub(sum, this.velocity);
      steer.limit(this.maxforce);
      return steer;
    }
    return createVector(0, 0);
  }

  cohesion(boids) {
    let neighborDist = 30;
    let sum = createVector(0, 0);
    let count = 0;

    for (let other of boids) {
      let d = p5.Vector.dist(this.position, other.position);
      if (d > 0 && d < neighborDist) {
        sum.add(other.position);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count);
      return this.seek(sum);
    }
    return createVector(0, 0);
  }

  seek(target) {
    let desired = p5.Vector.sub(target, this.position);
    desired.normalize();
    desired.mult(this.maxspeed);
    let steer = p5.Vector.sub(desired, this.velocity);
    steer.limit(this.maxforce);
    return steer;
  }
}
