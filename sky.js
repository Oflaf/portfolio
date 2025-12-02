const canvas = document.getElementById("webglCanvas");
const labelsContainer = document.getElementById("star-labels-container");
const gl = canvas.getContext("webgl2", { 
    alpha: false, 
    antialias: false, 
    powerPreference: "high-performance",
    preserveDrawingBuffer: true
});

if (!gl) {
    alert("Twoja przeglądarka nie obsługuje WebGL2.");
}

// ==========================================
// ŁADOWANIE TEKSTURY MOON.PNG
// ==========================================
function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 0, 0]); 
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, pixel);

    const image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };
    image.src = url;

    return texture;
}

const moonTexture = loadTexture(gl, "img/sky_/moon.png");

// ==========================================
// KONFIGURACJA GWIAZD
// ==========================================
const starsData = [
    { name: "Epsilon Aurigae", pos: [0.2, 0.6, 0.7], element: null, type: 'star' },
    { name: "Capella",         pos: [-0.3, 0.7, 0.5], element: null, type: 'star' },
    { name: "Hassaleh",        pos: [0.5, 0.4, -0.6], element: null, type: 'star' }
];

// Przygotowanie etykiet dla gwiazd
starsData.forEach(star => {
    let len = Math.sqrt(star.pos[0]**2 + star.pos[1]**2 + star.pos[2]**2);
    star.pos = star.pos.map(c => c / len);

    const label = document.createElement("div");
    label.className = "star-label";
    label.innerHTML = `<div class="star-line"></div><div class="star-text">${star.name}</div>`;
    labelsContainer.appendChild(label);
    star.element = label;
});

const starPositionsFlat = new Float32Array(starsData.length * 3);
starsData.forEach((s, i) => {
    starPositionsFlat[i*3+0] = s.pos[0];
    starPositionsFlat[i*3+1] = s.pos[1];
    starPositionsFlat[i*3+2] = s.pos[2];
});

// ==========================================
// KONFIGURACJA SATELITÓW
// ==========================================
const satNamesList = [
    "ISS", "Tiangong", "Hubble Space Telescope", "Envisat", 
    "Lacrosse 5", "Terra", "Aqua", "Landsat 8", 
    "NOAA-15", "NOAA-19", "Cosmos 2227"
];

// Funkcja pomocnicza do losowania
function getRandomSatName() {
    const idx = Math.floor(Math.random() * satNamesList.length);
    // Możemy usunąć nazwę z listy, żeby się nie powtarzały, ale przy 2 satelitach mała szansa
    return satNamesList[idx];
}

// Tworzymy 2 satelity
const satellitesData = [];
for(let i=0; i<2; i++) {
    // Losowa orbita (oś obrotu i przesunięcie fazowe)
    const phaseOffset = i * 200.0; 
    const speed = 0.04 + Math.random() * 0.01; // Różne prędkości
    
    // Tworzymy element DOM
    const name = getRandomSatName();
    const label = document.createElement("div");
    label.className = "star-label";
    label.innerHTML = `<div class="star-line"></div><div class="star-text">${name}</div>`;
    labelsContainer.appendChild(label);

    satellitesData.push({
        name: name,
        element: label,
        speed: speed,
        phase: phaseOffset,
        pos: [0, 0, 0], // Będzie aktualizowane w pętli render
        type: 'satellite'
    });
}

// Bufor pozycji satelitów do wysłania do shadera (2 satelity * 3 koordynaty)
const satPositionsFlat = new Float32Array(satellitesData.length * 3);


// --- OPTYMALIZACJA ---
const QUALITY = 0.7; 

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    let displayWidth = window.innerWidth * dpr;
    let displayHeight = window.innerHeight * dpr;

    canvas.width = displayWidth * QUALITY;
    canvas.height = displayHeight * QUALITY;

    const MAX_RENDER_WIDTH = 2000; 
    
    if (canvas.width > MAX_RENDER_WIDTH) {
        const aspectRatio = canvas.height / canvas.width;
        canvas.width = MAX_RENDER_WIDTH;
        canvas.height = MAX_RENDER_WIDTH * aspectRatio;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ==========================================
// MOUSE HANDLING
// ==========================================
let targetMouseX = 0;
let targetMouseY = 0;
let currentMouseX = 0;
let currentMouseY = 0;
let rawMouseX = 0;
let rawMouseY = 0;

window.addEventListener('mousemove', (e) => {
    rawMouseX = e.clientX;
    rawMouseY = e.clientY;
    targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
    let rawY = (e.clientY / window.innerHeight) * 2 - 1;
    const LIMIT_UP = 0.48;    
    const LIMIT_DOWN = 0.05;  
    targetMouseY = Math.max(-LIMIT_UP, Math.min(LIMIT_DOWN, rawY));
});

// ==========================================
// TIME & SLIDER LOGIC
// ==========================================
let timeOfDay = 0.0; 
let worldSpeed = 1.0;       
let simulationTime = 0.0;   
let lastFrameTime = 0.0;    

const clockDisplay = document.getElementById("digital-clock");
const dateDisplay = document.getElementById("current-date"); // NOWY ELEMENT DLA DATY
const dialContainer = document.getElementById("dial-container");
const dialKnob = document.getElementById("dial-knob");
const resetIcon = document.getElementById("reset-icon"); // NOWY ELEMENT DLA IKONY RESETU

const now = new Date();
const targetTime = now.getHours() + now.getMinutes() / 60.0;

// --- NOWA FUNKCJA DO AKTUALIZACJI DATY ---
function updateDateUI() {
    const d = new Date(); 
    
    // Opcje formatowania (skrócony miesiąc, 2-cyfrowy dzień)
    const options = { day: '2-digit', month: 'short' };
    

    const formattedDate = new Intl.DateTimeFormat('en-EN', options).format(d);
    
    if(dateDisplay) {

        const finalDate = formattedDate.toLowerCase().replace(/\s/, '. ') + '.'; 
        dateDisplay.innerText = finalDate;
    }
}
updateDateUI(); // Wywołanie przy starcie

// --- UOGÓLNIONA FUNKCJA ANIMACJI CZASU ---
window.animateTimeTransition = function(targetH, duration, ease = "power3.out") {
    const timeObj = { value: timeOfDay };
    
    // Obsługa przejścia przez 24/0 (krótsza droga na okręgu)
    let finalTarget = targetH;
    let diff = targetH - timeOfDay;
    
    if (diff > 12) {
        finalTarget -= 24; 
    } else if (diff < -12) {
        finalTarget += 24;
    }
    
    gsap.to(timeObj, {
        value: finalTarget,
        duration: duration,
        ease: ease,
        onUpdate: function() {
            // Utrzymanie wartości w zakresie [0, 24)
            timeOfDay = (timeObj.value % 24 + 24) % 24;
            updateClockUI();
        }
    });
};

window.startClockAnimation = function() {
    // Animacja czasu (wykorzystuje nową funkcję)
    window.animateTimeTransition(targetTime, 8.5);

    // Animacja prędkości (pozostaje bez zmian)
    const speedObj = { value: 13.0 }; 
    gsap.fromTo(speedObj, 
        { value: 13.0 }, 
        {
            value: 1.0,   
            duration: 7.5, 
            ease: "power3.out",
            onUpdate: function() {
                worldSpeed = speedObj.value;
            }
        }
    );
};

// --- NOWA FUNKCJA RESETU ---
function resetClockToCurrentTime() {
    // 1. Obliczanie aktualnego czasu
    const now = new Date();
    const currentHourFloat = now.getHours() + now.getMinutes() / 60.0;
    
    // 2. Uruchomienie płynnej animacji czasu
    // Używamy 'back.out' dla efektu "sprężyny" i szybkiej animacji
    window.animateTimeTransition(currentHourFloat, 1.5, "back.out(1.7)"); 
    
    // 3. Ustawienie worldSpeed na 1.0
    if (worldSpeed > 1.0) {
        gsap.to(window, { worldSpeed: 1.0, duration: 1.0, ease: "power2.out" });
    } else {
        worldSpeed = 1.0; 
    }
}

// --- DODANIE LISTENERA DLA IKONY RESETU ---
if (resetIcon) {
    resetIcon.addEventListener('click', resetClockToCurrentTime);
}

function updateClockUI() {
    let h = Math.floor(timeOfDay);
    let m = Math.floor((timeOfDay - h) * 60);
    let hStr = h.toString().padStart(2, '0');
    let mStr = m.toString().padStart(2, '0');
    if(clockDisplay) clockDisplay.innerText = `${hStr}:${mStr}`;

    if(dialKnob) {
        const angleDeg = (timeOfDay / 24.0) * 360;
        const r = 21; 
        const angleRad = (angleDeg - 90) * (Math.PI / 180);
        
        const x = 30 + r * Math.cos(angleRad);
        const y = 30 + r * Math.sin(angleRad);
        
        dialKnob.style.left = x + "px";
        dialKnob.style.top = y + "px";
    }
}

let isDraggingTime = false;
if(dialContainer) {
    dialContainer.addEventListener('mousedown', (e) => {
        isDraggingTime = true;
        updateTimeFromMouse(e);
    });
    window.addEventListener('mouseup', () => { isDraggingTime = false; });
    window.addEventListener('mousemove', (e) => {
        if(isDraggingTime) updateTimeFromMouse(e);
    });
}

function updateTimeFromMouse(e) {
    const rect = dialContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    let angle = Math.atan2(dy, dx);
    angle += Math.PI / 2;
    if(angle < 0) angle += Math.PI * 2;
    timeOfDay = (angle / (Math.PI * 2)) * 24.0;
    timeOfDay = Math.max(0, Math.min(23.99, timeOfDay));
    updateClockUI();
}
updateClockUI();

// ==========================================
// VERTEX SHADER
// ==========================================
const vertexShaderSource = `#version 300 es
in vec4 position;
void main() { 
    gl_Position = position; 
}
`;

// ==========================================
// FRAGMENT SHADER
// ==========================================
const fragmentShaderSource = `#version 300 es
precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform vec2 iMouse;
uniform vec3 uStarPos[3]; 
uniform vec3 uSatPos[2]; // Pozycje satelitów z JS
uniform float uTimeOfDay; 
uniform sampler2D uMoonTexture;

out vec4 fragColor;

#define OCTAVES 5

// --- NOISE FUNCTIONS ---
float hash12(vec2 p) {
    vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float filmGrain(vec2 uv, float t) {
    float tOffset = fract(t * 123.456); 
    float noise = fract(sin(dot(uv + tOffset, vec2(12.9898, 78.233))) * 43758.5453);
    return noise - 0.5; 
}
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
float snoise3(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v,C.yyy));
  vec3 x0 = v - i + dot(i,C.xxx);
  vec3 g = step(x0.yzx,x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i,289.0);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0,i1.z,i2.z,1.0))
           + i.y + vec4(0.0,i1.y,i2.y,1.0))
           + i.x + vec4(0.0,i1.x,i2.x,1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p*ns.z*ns.z);
  vec4 x_ = floor(j*ns.z);
  vec4 y_ = floor(j - 7.0*x_);
  vec4 x = x_*ns.x + ns.yyyy;
  vec4 y = y_*ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy,y.xy);
  vec4 b1 = vec4(x.zw,y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h,vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = inversesqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m = m*m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm3(vec2 uv, float t){
  float total = 0.0;
  float amplitude = 0.3;
  float frequency = 1.0;
  for(int i=0; i<OCTAVES; i++){
    vec3 p = vec3(uv*frequency, t*0.1); 
    total += snoise3(p) * amplitude;
    frequency *= 1.9;
    amplitude *= 0.5;
  }
  return total*0.7 + 0.5;
}

// Procedural Stars
float getStars(vec2 uv, float t) {
    float totalBrightness = 0.0;
    for (float i = 0.0; i < 3.0; i++) {
        float scale = 10.0 + i * 10.0; 
        vec2 p = uv * scale;
        vec2 id = floor(p);
        vec2 gv = fract(p) - 0.5;
        
        float rnd = hash12(id);
        
        if (rnd > 0.99) { 
            vec2 offset = (vec2(hash12(id * 24.0), hash12(id * 34.0)) - 0.5) * 0.6;
            float dist = length(gv - offset);
            float star = 1.0 / (dist * 25.0 + 0.1);
            star *= star; 
            star *= rnd * rnd; 
            float twinkle = sin(t * (0.5 + rnd * 5.0) + rnd * 100.0) * 0.5 + 0.5;
            star *= mix(0.6, 1.2, twinkle); 
            totalBrightness += star * (1.0 / (i + 1.0)); 
        }
    }
    return totalBrightness;
}

// ==========================================
// RYSOWANIE SATELITÓW NA BAZIE POZYCJI Z JS
// ==========================================
float drawSatellites(vec3 rd, float t) {
    float acc = 0.0;
    for(int i=0; i<2; i++) {
        vec3 pos = uSatPos[i];
        float d = dot(rd, pos);
        
        // --- MIKROSKOPIJNA KROPKA ---
        float spot = smoothstep(0.99999, 0.999999, d);
        
        // --- PULSOWANIE (SINE WAVE) ---
        float localTime = t + float(i) * 0.4; 
        float pulse = pow(0.5 + 0.5 * sin(localTime * 8.0), 6.0);
        
        // --- HORYZONT FADE ---
        float horizonFade = smoothstep(0.0, 0.1, pos.y);
        
        acc += spot * pulse * horizonFade;
    }
    return acc;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
  vec3 ro = vec3(0.0, 800.0, 0.0); 
  
  float yaw = iMouse.x * 3.5; 
  float pitch = -iMouse.y * 1.5; 

  vec3 f = normalize(vec3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw)));
  vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
  vec3 u = cross(f, r);
  vec3 rd = normalize(f + uv.x * r + uv.y * u);

  // --- DAY / NIGHT CYCLE ---
  float sunAngle = ((uTimeOfDay - 6.0) / 24.0) * 2.0 * 3.14159;
  vec3 sunPos = normalize(vec3(0.0, sin(sunAngle), cos(sunAngle)));
  
  float moonAngle = ((uTimeOfDay - 18.0) / 24.0) * 2.0 * 3.14159;
  vec3 moonPos = normalize(vec3(0.2, sin(moonAngle), cos(moonAngle)));

  float dayFactor = smoothstep(-0.2, 0.2, sunPos.y); 
  float nightFactor = 1.0 - dayFactor;
  float cinematicFactor = smoothstep(-0.35, 0.15, sunPos.y);

  vec3 colorNightSky = vec3(0.0, 0.015, 0.04);
  vec3 colorDaySky = vec3(0.3, 0.6, 0.9);
  vec3 colorSunset = vec3(1.0, 0.2, 0.05);
  vec3 colorHorizonNight = vec3(0.08, 0.12, 0.25);
  vec3 colorHorizonDay = vec3(0.6, 0.8, 0.95);

  vec3 finalColor = vec3(0.0);

  // ===========================================
  // 1. NIEBO
  // ===========================================
  if (rd.y >= -0.05) { 
      vec3 skyBase = mix(colorNightSky, colorDaySky, dayFactor);
      vec3 horizonBase = mix(colorHorizonNight, colorHorizonDay, dayFactor);
      
      float sunsetInfluence = smoothstep(0.4, -0.15, abs(sunPos.y)); 
      horizonBase = mix(horizonBase, colorSunset, sunsetInfluence * 0.85);

      vec2 skyUV = vec2(atan(rd.x, rd.z), rd.y);
      float bgNoise = fbm3(skyUV * 1.5, iTime * 0.2);
      
      vec3 skyCol = mix(horizonBase, skyBase, sqrt(max(0.0, rd.y)) + bgNoise * 0.05);

      if (nightFactor > 0.01) {
          // GWIAZDY TŁA
          float starsVal = getStars(skyUV * 2.5, iTime);
          starsVal *= smoothstep(0.0, 0.3, rd.y);
          skyCol += vec3(starsVal) * vec3(0.8, 0.9, 1.0) * nightFactor;

          // GŁÓWNE GWIAZDY (Z ETYKIETAMI)
          for(int i = 0; i < 3; i++) {
              float d = dot(rd, uStarPos[i]);
              if (d > 0.99994) {
                   float core = smoothstep(0.99998, 0.99998, d);
                   float ring = smoothstep(0.9996, 0.99975, d) * (1.0 - smoothstep(0.99975, 0.9999, d));
                   vec3 starColor = vec3(0.9, 0.5, 1.0); 
                   skyCol += (starColor * ring * 0.5 + vec3(1.0) * core * 1.5) * nightFactor;
              }
          }

          // SATELITY (PULSUJĄCE)
          float satVal = drawSatellites(rd, iTime);
          skyCol += vec3(1.0) * satVal * nightFactor;
      }

      // --- SŁOŃCE ---
      float sunDot = dot(rd, sunPos);
      if (sunDot > 0.999 && rd.y > 0.0) { 
          float redness = smoothstep(0.3, 0.0, sunPos.y); 
          float sunTransitionWidth = mix(0.0008, 0.005, redness);
          float sunCore = smoothstep(0.999, 0.999 + sunTransitionWidth, sunDot); 
          
          vec3 sunDayColor = vec3(1.0, 0.95, 0.8);
          vec3 sunRedColor = vec3(1.0, 0.05, 0.0); 
          
          vec3 sunColor = mix(sunDayColor, sunRedColor, redness);
          skyCol += sunColor * sunCore * 5.0; 
      }
      float sunGlow = pow(max(0.0, sunDot), 500.0) * 0.6; 
      if (rd.y > -0.01) {
          float glowRedness = smoothstep(0.4, 0.0, sunPos.y);
          vec3 glowColor = mix(vec3(1.0, 0.8, 0.6), vec3(1.0, 0.2, 0.05), glowRedness);
          float glowReduction = 1.0 - smoothstep(0.8, 1.0, glowRedness); 
          skyCol += glowColor * sunGlow * glowReduction; 
      }

      // --- KSIĘŻYC ---
      float moonHeightFactor = smoothstep(-0.05, 0.4, moonPos.y);
      float currentMoonSize = mix(0.998, 0.990, moonHeightFactor);
      float currentScale = mix(0.06, 0.14, moonHeightFactor);
      float moonAlpha = smoothstep(0.0, 0.25, moonPos.y);

      float moonDot = dot(rd, moonPos);
      float moonGlow = pow(max(0.0, moonDot), 150.0) * 0.4; 
      skyCol += vec3(0.6, 0.7, 0.9) * moonGlow * nightFactor * moonAlpha;

      if (moonDot > 0.0 && nightFactor > 0.01) {
          if (moonDot > currentMoonSize) {
               vec3 up = vec3(0.0, 1.0, 0.0);
               vec3 right = normalize(cross(moonPos, up));
               vec3 realUp = cross(right, moonPos);
               
               float x = dot(rd, right);
               float y = dot(rd, realUp);
               
               vec2 moonUV = vec2(x, y) / currentScale + 0.5;
               
               if(moonUV.x >= 0.0 && moonUV.x <= 1.0 && moonUV.y >= 0.0 && moonUV.y <= 1.0) {
                   vec4 texColor = texture(uMoonTexture, moonUV);
                   skyCol = mix(skyCol, texColor.rgb, texColor.a * nightFactor * moonAlpha);
               }
          }
      }
          
      // --- CHMURY ---
      if (rd.y > 0.01) {
          float fogModifier = mix(1.0, 0.3, dayFactor);

          float cloudCeilingBG = 4000.0; 
          float relHeightBG = cloudCeilingBG - ro.y;
          float tBG = relHeightBG / rd.y;
          vec3 posBG = ro + tBG * rd;
          vec2 cloudUV_BG = posBG.xz * 0.0001; 
          cloudUV_BG += vec2(-iTime * 0.005, -iTime * 0.0025);
          float nBG = fbm3(cloudUV_BG, iTime * 0.8);
          
          float densityBG = smoothstep(0.3, 1.0, nBG) * 0.5;
          float fogBG = 1.0 - smoothstep(5000.0, 80000.0 * (1.0/fogModifier), tBG);
          densityBG *= fogBG;
          
          vec3 bgCloudColor = mix(vec3(0.15, 0.18, 0.35), vec3(0.9, 0.95, 1.0), dayFactor * 0.8);
          skyCol = mix(skyCol, bgCloudColor, densityBG);

          float cloudCeilingFG = 1500.0; 
          float relHeightFG = cloudCeilingFG - ro.y;
          float tFG = relHeightFG / rd.y;
          vec3 posFG = ro + tFG * rd;
          vec2 cloudUV_FG = posFG.xz * 0.0001; 
          cloudUV_FG += vec2(-iTime * 0.01, -iTime * 0.01);
          float nFG = fbm3(cloudUV_FG, iTime);
          
          float densityFG = smoothstep(0.45, 0.85, nFG);
          float fogFG = 1.0 - smoothstep(1000.0, 25000.0 * (1.0/fogModifier), tFG);
          densityFG *= fogFG;
          
          vec3 cloudNight = mix(vec3(0.04, 0.05, 0.22), vec3(0.28, 0.32, 0.45), nFG);
          vec3 cloudDay   = mix(vec3(0.8, 0.8, 0.9), vec3(1.0, 1.0, 1.0), nFG);
          
          if (dayFactor < 0.5 && dayFactor > 0.0) {
               cloudDay *= vec3(1.0, 0.6, 0.6); 
          }
          
          vec3 fgCloudColor = mix(cloudNight, cloudDay, dayFactor);
          skyCol = mix(skyCol, fgCloudColor, densityFG);
      }
      finalColor = skyCol;
  }

  // ===========================================
  // 2. OCEAN
  // ===========================================
  if (rd.y < 0.0) {
      float t = -ro.y / rd.y;
      if (t > 0.0) {
          vec3 pos = ro + t * rd;
          vec2 oceanUV = pos.xz * 0.006; 
          oceanUV += iTime * 0.2;
          float wave = fbm3(oceanUV, iTime * 2.8);
          float foamMask = smoothstep(0.65, 0.92, wave);
          float foamDetail = fbm3(oceanUV * 4.0, iTime * 5.5);
          float foamFinal = foamMask * smoothstep(0.4, 0.8, foamDetail);
          vec3 foamColor = vec3(0.98, 0.99, 1.0);
          
          vec3 normal = normalize(vec3(wave*0.04, 1.0, wave*0.04));
          vec3 lightDir = sunPos; 
          if (nightFactor > 0.5) lightDir = moonPos;

          vec3 viewDir = -rd;
          vec3 halfDir = normalize(lightDir + viewDir);
          
          float spec = pow(max(0.0, dot(normal, halfDir)), 45.0);
          spec *= smoothstep(0.3, 1.0, wave);
          float lightIntensity = (nightFactor > 0.5) ? 0.8 : dayFactor;
          spec *= 0.6 * lightIntensity; 

          vec3 waterDeepNight = vec3(0.0, 0.002, 0.005);
          vec3 waterSurfNight = vec3(0.0, 0.01, 0.03);
          vec3 waterDeepDay = vec3(0.0, 0.08, 0.25);
          vec3 waterSurfDay = vec3(0.0, 0.25, 0.45);
          
          float waterDayFactor = smoothstep(0.05, 0.5, sunPos.y);

          vec3 waterDeep = mix(waterDeepNight, waterDeepDay, waterDayFactor);
          vec3 waterSurf = mix(waterSurfNight, waterSurfDay, waterDayFactor);

          vec3 horizonBaseForWater = mix(colorHorizonNight, colorHorizonDay, dayFactor);
          float sunH = smoothstep(0.4, -0.15, abs(sunPos.y)); 
          vec3 currentHorizonColor = mix(horizonBaseForWater, colorSunset, sunH * 0.85);

          float objectH = (nightFactor > 0.5) ? abs(moonPos.y) : abs(sunPos.y);
          float horizonReflection = smoothstep(0.6, 0.0, objectH); 
          
          vec3 waterCol = mix(waterDeep, waterSurf, wave);
          waterCol = mix(waterCol, currentHorizonColor * 0.6, horizonReflection * 0.8);

          vec3 specColorSun = mix(vec3(1.0, 0.9, 0.6), vec3(1.0, 0.3, 0.1), smoothstep(0.3, 0.0, sunPos.y));
          vec3 specColorMoon = vec3(0.6, 0.7, 0.9);
          vec3 finalSpecColor = mix(specColorSun, specColorMoon, nightFactor);

          waterCol += finalSpecColor * spec;
          
          vec3 foamTinted = mix(foamColor, colorSunset, sunH * smoothstep(-0.15, 0.1, sunPos.y));
          waterCol = mix(waterCol, foamTinted, foamFinal * 0.8);

          float fogAmount = 1.0 - exp(-t * 0.00005); 
          vec3 oceanFinal = mix(waterCol, currentHorizonColor, fogAmount * 0.95);
          
          if (rd.y > -0.05) {
             float blend = smoothstep(-0.05, 0.0, rd.y);
             finalColor = mix(oceanFinal, finalColor, blend);
          } else {
             finalColor = oceanFinal;
          }
      }
  }

  // ===========================================
  // 3. POST-PROCESSING
  // ===========================================
  
  float nightGrain = 0.05;
  float dayGrainScale = 0.075; 
  float currentGrain = mix(nightGrain, dayGrainScale, cinematicFactor);
  
  float grain = filmGrain(gl_FragCoord.xy, iTime);
  finalColor += grain * currentGrain;

  float contrastVal = mix(1.0, 1.35, cinematicFactor);
  finalColor = (finalColor - 0.5) * contrastVal + 0.5;

  float distFromCenter = length(uv); 
  float vignette = smoothstep(1.6, 0.5, distFromCenter);
  float vigStrength = mix(0.6, 0.65, cinematicFactor); 
  finalColor *= mix(1.0, vignette, 1.0 - vigStrength);

  float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453) - 0.5) / 255.0;
  finalColor += dither;

  fragColor = vec4(finalColor, 1.0);
}
`;

function compileShader(gl, type, source){
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
    console.error(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);

const vertices = new Float32Array([
  -1,-1,  1,-1,  -1,1,
  -1,1,   1,-1,   1,1
]);

const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const positionLoc = gl.getAttribLocation(program, "position");
gl.enableVertexAttribArray(positionLoc);
gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

const iTimeLoc = gl.getUniformLocation(program, "iTime");
const iResLoc = gl.getUniformLocation(program, "iResolution");
const iMouseLoc = gl.getUniformLocation(program, "iMouse"); 
const uStarPosLoc = gl.getUniformLocation(program, "uStarPos");
const uSatPosLoc = gl.getUniformLocation(program, "uSatPos"); // UNIFORM DLA SATELITÓW
const uTimeOfDayLoc = gl.getUniformLocation(program, "uTimeOfDay");
const uMoonTextureLoc = gl.getUniformLocation(program, "uMoonTexture");


// ==========================================
// AKTUALIZACJA ETYKIET (GWIAZDY + SATELITY)
// ==========================================
function updateLabels(yaw, pitch) {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const f = [cp * sy, sp, cp * cy]; 
    let rx = f[2], ry = 0, rz = -f[0];
    const rLen = Math.sqrt(rx*rx + rz*rz);
    rx /= rLen; rz /= rLen; 
    const ux = f[1]*rz, uy = f[2]*rx - f[0]*rz, uz = -f[1]*rx; 

    const w = window.innerWidth;
    const h = window.innerHeight;

    const isDay = (timeOfDay > 6.0 && timeOfDay < 18.0);

    // Funkcja wewnętrzna obsługująca pojedynczy obiekt (gwiazdę lub satelitę)
    const processObject = (obj) => {
        if(isDay) {
            obj.element.style.display = 'none';
            return;
        }

        // Satelity chowamy też, gdy są pod horyzontem (pos[1] < 0)
        // Dla pewności ukrywamy lekko wyżej, żeby etykieta nie latała po wodzie
        if (obj.type === 'satellite' && obj.pos[1] < 0.05) {
             obj.element.style.display = 'none';
             return;
        }

        const dotF = obj.pos[0]*f[0] + obj.pos[1]*f[1] + obj.pos[2]*f[2];
        if (dotF <= 0) {
            obj.element.style.display = 'none';
            return;
        }

        const dotR = obj.pos[0]*rx + obj.pos[1]*ry + obj.pos[2]*rz;
        const dotU = obj.pos[0]*ux + obj.pos[1]*uy + obj.pos[2]*uz;

        const screenX = (dotR / dotF) * h + w / 2;
        const screenY = (dotU / dotF) * h + h / 2;

        obj.element.style.display = 'flex';
        obj.element.style.left = screenX + 'px';
        obj.element.style.top = (h - screenY) + 'px';

        const dx = rawMouseX - screenX;
        const dy = rawMouseY - (h - screenY);
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < 50) {
            obj.element.classList.add('visible');
            document.body.style.cursor = 'help';
        } else {
            obj.element.classList.remove('visible');
            // Resetujemy kursor tylko jeśli żaden inny obiekt go nie ustawił
            // (uproszczenie - resetujemy tutaj, może migać przy nakładaniu się, ale rzadkie)
            if(document.body.style.cursor === 'help') document.body.style.cursor = 'default';
        }
    };

    // 1. Gwiazdy
    starsData.forEach(processObject);
    // 2. Satelity
    satellitesData.forEach(processObject);
}

function render(t){
  t *= 0.001; 
  if(lastFrameTime === 0) lastFrameTime = t;
  const dt = t - lastFrameTime;
  lastFrameTime = t;
  simulationTime += dt * worldSpeed;

  currentMouseX += (targetMouseX - currentMouseX) * 0.013;
  currentMouseY += (targetMouseY - currentMouseY) * 0.02;

  // --- AKTUALIZACJA POZYCJI SATELITÓW ---
  satellitesData.forEach((sat, i) => {
      // Przesunięty czas dla każdego satelity
      const tShift = simulationTime + sat.phase;
      const ang = tShift * sat.speed;
      
      // Orbita w JS (taka sama jak była w shaderze)
      // x = sin(ang), y = 0.5 + 0.3*cos(ang*0.7), z = cos(ang)
      // Normalizujemy, żeby wektor miał długość 1 (sfera niebieska)
      let x = Math.sin(ang);
      let y = 0.5 + 0.3 * Math.cos(ang * 0.7);
      let z = Math.cos(ang);
      
      const len = Math.sqrt(x*x + y*y + z*z);
      sat.pos[0] = x / len;
      sat.pos[1] = y / len;
      sat.pos[2] = z / len;

      // Zapisujemy do tablicy dla shadera
      satPositionsFlat[i*3+0] = sat.pos[0];
      satPositionsFlat[i*3+1] = sat.pos[1];
      satPositionsFlat[i*3+2] = sat.pos[2];
  });

  gl.useProgram(program);
  
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, moonTexture);
  gl.uniform1i(uMoonTextureLoc, 0);

  gl.uniform3fv(uStarPosLoc, starPositionsFlat);
  gl.uniform3fv(uSatPosLoc, satPositionsFlat); // WYSYŁAMY POZYCJE SATELITÓW
  gl.uniform1f(iTimeLoc, simulationTime);
  gl.uniform2f(iResLoc, canvas.width, canvas.height);
  gl.uniform2f(iMouseLoc, currentMouseX, currentMouseY); 
  gl.uniform1f(uTimeOfDayLoc, timeOfDay);

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  const yaw = currentMouseX * 3.5; 
  const pitch = -currentMouseY * 1.5;
  
  // Używamy nowej funkcji obsługującej i gwiazdy i satelity
  updateLabels(yaw, pitch);

  requestAnimationFrame(render);
}
requestAnimationFrame(render);