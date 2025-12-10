/* sky.js - WERSJA HIGH-PERFORMANCE (ZMODYFIKOWANA + DATA) */

const canvas = document.getElementById("webglCanvas");
const labelsContainer = document.getElementById("star-labels-container");
const sectionSky = document.getElementById("sky-section");

// Kontekst WebGL2 z ustawieniami pod wydajność
const gl = canvas.getContext("webgl2", { 
    alpha: false, 
    antialias: false, 
    depth: false, 
    powerPreference: "high-performance",
    preserveDrawingBuffer: true
});

if (!gl) {
    alert("Twoja przeglądarka nie obsługuje WebGL2.");
}

// ==========================================
// ŁADOWANIE TEKSTURY
// ==========================================
function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

    const image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };
    image.src = url;
    return texture;
}

const moonTexture = loadTexture(gl, "img/sky_/moon.png");

// ==========================================
// DANE GWIAZD I SATELITÓW
// ==========================================
const starsData = [
    { name: "Epsilon Aurigae", pos: [0.2, 0.6, 0.7], element: null, type: 'star' },
    { name: "Capella",         pos: [-0.3, 0.7, 0.5], element: null, type: 'star' },
    { name: "Hassaleh",        pos: [0.5, 0.4, -0.6], element: null, type: 'star' }
];

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

const satNamesList = ["ISS", "Tiangong", "Hubble", "Envisat", "Lacrosse 5", "Terra", "Aqua"];
function getRandomSatName() { return satNamesList[Math.floor(Math.random() * satNamesList.length)]; }

const satellitesData = [];
for(let i=0; i<2; i++) {
    const name = getRandomSatName();
    const label = document.createElement("div");
    label.className = "star-label";
    label.innerHTML = `<div class="star-line"></div><div class="star-text">${name}</div>`;
    labelsContainer.appendChild(label);

    satellitesData.push({
        name: name, element: label,
        speed: 0.04 + Math.random() * 0.01,
        phase: i * 200.0,
        pos: [0, 0, 0], type: 'satellite'
    });
}
const satPositionsFlat = new Float32Array(satellitesData.length * 3);

// ==========================================
// OPTYMALIZACJA ROZDZIELCZOŚCI
// ==========================================
function resizeCanvas() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 1000;
    const dpr = 1.0; 
    const qualityMultiplier = isMobile ? 0.5 : 0.75;

    const displayWidth = window.innerWidth * dpr;
    const displayHeight = window.innerHeight * dpr;

    canvas.width = Math.floor(displayWidth * qualityMultiplier);
    canvas.height = Math.floor(displayHeight * qualityMultiplier);

    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
let targetMouseX=0, targetMouseY=0;
let currentMouseX=0, currentMouseY=0;
let rawMouseX=0, rawMouseY=0;
let mouseTicking = false;

// Zmienne do obsługi przeciągania (drag)
let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let baseTargetX = 0, baseTargetY = 0;

// Funkcja startu przeciągania (mysz lub dotyk)
function handleInputStart(x, y) {
    isDragging = true;
    dragStartX = x;
    dragStartY = y;
    // Zapamiętujemy obecną pozycję kamery jako bazę
    baseTargetX = targetMouseX;
    baseTargetY = targetMouseY;
}

// Funkcja ruchu (mysz lub dotyk)
function handleInputMove(x, y, isTouch) {
    // Aktualizujemy surowe koordynaty dla etykiet gwiazd
    rawMouseX = x;
    rawMouseY = y;

    if (isDragging) {
        // Obliczamy przesunięcie od momentu chwycenia
        // Zwiększamy czułość (mnożnik 2.5), żeby na małych ekranach było wygodniej
        const sensitivity = 2.5; 
        const deltaX = ((x - dragStartX) / window.innerWidth) * sensitivity;
        const deltaY = ((y - dragStartY) / window.innerHeight) * sensitivity;

        targetMouseX = baseTargetX + deltaX;
        
        let rawY = baseTargetY + deltaY;
        targetMouseY = Math.max(-0.48, Math.min(0.05, rawY));
    } else if (!isTouch) {
        // Klasyczny efekt "śledzenia myszy" (tylko na PC, gdy nie klikamy)
        targetMouseX = (x / window.innerWidth) * 2 - 1;
        let rawY = (y / window.innerHeight) * 2 - 1;
        targetMouseY = Math.max(-0.48, Math.min(0.05, rawY));
    }
}

function handleInputEnd() {
    isDragging = false;
}

// --- Event Listeners Mysz ---
window.addEventListener('mousedown', e => {
    // Ignorujemy kliknięcia na elementach interfejsu (np. zegar)
    if(e.target.closest('#dial-container') || e.target.closest('#reset-icon')) return;
    handleInputStart(e.clientX, e.clientY);
});

window.addEventListener('mousemove', (e) => {
    if(!mouseTicking) {
        window.requestAnimationFrame(() => {
            handleInputMove(e.clientX, e.clientY, false);
            mouseTicking = false;
        });
        mouseTicking = true;
    }
});

window.addEventListener('mouseup', handleInputEnd);
if (window.innerWidth > 1024) {

    window.addEventListener('touchstart', e => {
        if(e.target.closest('#dial-container') || e.target.closest('#reset-icon')) return;
        handleInputStart(e.touches[0].clientX, e.touches[0].clientY);
    }, {passive: false});

    window.addEventListener('touchmove', e => {
        if(isDragging) {
            // Blokujemy przewijanie strony TYLKO na desktopach z dotykiem (np. hybrydy),
            // ale na zwykłych telefonach ten kod się w ogóle nie wykona dzięki warunkowi if.
            if(e.cancelable) e.preventDefault(); 
        }

        if(!mouseTicking) {
            window.requestAnimationFrame(() => {
                handleInputMove(e.touches[0].clientX, e.touches[0].clientY, true);
                mouseTicking = false;
            });
            mouseTicking = true;
        }
    }, {passive: false});

    window.addEventListener('touchend', handleInputEnd);
}

let timeOfDay = 12.0; 
let worldSpeed = 1.0;       
let simulationTime = 0.0;   
let lastFrameTime = 0.0;    

const clockDisplay = document.getElementById("digital-clock");
const dateDisplay = document.getElementById("current-date"); // DODANO: Uchwyt do daty
const dialContainer = document.getElementById("dial-container");
const dialKnob = document.getElementById("dial-knob");
const resetIcon = document.getElementById("reset-icon");

const now = new Date();
const targetTime = now.getHours() + now.getMinutes() / 60.0;
const hasGsap = typeof gsap !== 'undefined';

// ==========================================
// FUNKCJA AKTUALIZACJI DATY (NOWE)
// ==========================================
function updateDate() {
    if (dateDisplay) {
        const d = new Date();
        const day = d.getDate().toString().padStart(2, '0');
        const month = d.toLocaleString('en-EN', { month: 'short' });
        // Składamy tekst: "DD. MMM." (np. "02. gru.")
        dateDisplay.innerText = `${day}. ${month}.`;
    }
}
// Wywołujemy od razu przy starcie
updateDate();


window.animateTimeTransition = function(targetH, duration, ease = "power3.out") {
    if(!hasGsap) { timeOfDay = targetH; updateClockUI(); return; }
    
    const timeObj = { value: timeOfDay };
    let finalTarget = targetH;
    let diff = targetH - timeOfDay;
    if (diff > 12) finalTarget -= 24; else if (diff < -12) finalTarget += 24;
    
    gsap.to(timeObj, {
        value: finalTarget, duration: duration, ease: ease,
        onUpdate: function() {
            timeOfDay = (timeObj.value % 24 + 24) % 24;
            updateClockUI();
        }
    });
};

window.startClockAnimation = function() {
    timeOfDay = 12.0; 
    window.animateTimeTransition(targetTime, 8.5);
    
    if(hasGsap) {
        const speedObj = { value: 13.0 }; 
        gsap.fromTo(speedObj, { value: 13.0 }, {
            value: 1.0, duration: 7.5, ease: "power3.out",
            onUpdate: () => { worldSpeed = speedObj.value; }
        });
    } else {
        worldSpeed = 1.0;
    }
};

if (resetIcon) {
    resetIcon.addEventListener('click', () => {
        const n = new Date();
        window.animateTimeTransition(n.getHours() + n.getMinutes()/60.0, 1.5, "back.out(1.7)");
        updateDate(); // Przy resecie też upewniamy się, że data jest aktualna
        if(hasGsap) gsap.to(window, { worldSpeed: 1.0, duration: 1.0 });
    });
}

function updateClockUI() {
    let h = Math.floor(timeOfDay);
    let m = Math.floor((timeOfDay - h) * 60);
    if(clockDisplay) clockDisplay.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;

    if(dialKnob) {
        const angleRad = ((timeOfDay / 24.0) * 360 - 90) * (Math.PI / 180);
        dialKnob.style.left = (30 + 21 * Math.cos(angleRad)) + "px";
        dialKnob.style.top = (30 + 21 * Math.sin(angleRad)) + "px";
    }
}

let isDraggingTime = false;
if(dialContainer) {
    dialContainer.addEventListener('mousedown', (e) => { isDraggingTime = true; updateTimeFromMouse(e); });
    window.addEventListener('mouseup', () => isDraggingTime = false);
    window.addEventListener('mousemove', (e) => { if(isDraggingTime) updateTimeFromMouse(e); });
}

function updateTimeFromMouse(e) {
    const rect = dialContainer.getBoundingClientRect();
    const angle = Math.atan2(e.clientY - (rect.top + rect.height/2), e.clientX - (rect.left + rect.width/2)) + Math.PI/2;
    let t = (angle < 0 ? angle + Math.PI*2 : angle) / (Math.PI*2) * 24.0;
    timeOfDay = Math.max(0, Math.min(23.99, t));
    updateClockUI();
}

// ==========================================
// SHADERY (MOCNO ZOPTIMALIZOWANE)
// ==========================================
const vertexShaderSource = `#version 300 es
in vec4 position;
void main() { gl_Position = position; }
`;

const fragmentShaderSource = `#version 300 es
precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform vec2 iMouse;
uniform vec3 uStarPos[3]; 
uniform vec3 uSatPos[2];
uniform float uTimeOfDay; 
uniform sampler2D uMoonTexture;

out vec4 fragColor;

// --- NOISE FUNCTIONS ---
float hash12(vec2 p) {
    vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// Simplex Noise
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

// FBM High (Clouds Main)
float fbmHigh(vec2 uv, float t){
  float total = 0.0;
  float amplitude = 0.3;
  float frequency = 1.0;
  for(int i=0; i<4; i++){
    vec3 p = vec3(uv*frequency, t*0.1); 
    total += snoise3(p) * amplitude;
    frequency *= 1.9;
    amplitude *= 0.5;
  }
  return total*0.7 + 0.5;
}

// FBM Low (Backgrounds)
float fbmLow(vec2 uv, float t){
  float total = 0.0;
  float amplitude = 0.3;
  float frequency = 1.0;
  for(int i=0; i<2; i++){
    vec3 p = vec3(uv*frequency, t*0.1); 
    total += snoise3(p) * amplitude;
    frequency *= 2.1;
    amplitude *= 0.5;
  }
  return total*0.7 + 0.5;
}

// --- MIKRO GWIAZDKI ---
float getStarDust(vec2 uv, float t) {
    float gridDensity = 470.0; 
    vec2 p = uv * gridDensity; 
    vec2 id = floor(p);
    float rnd = hash12(id);
    if (rnd > 0.9995) { 
        float twinkleSpeed = 0.2 + rnd * 0.4;
        float twinkle = sin(t * twinkleSpeed) * 0.3 + 0.7; 
        return rnd * twinkle * 0.3; 
    }
    return 0.0;
}

float getStars(vec2 uv, float t) {
    float totalBrightness = 0.0;
    for (float i = 0.0; i < 2.0; i++) {
        float scale = 10.0 + i * 12.0; 
        vec2 p = uv * scale;
        vec2 id = floor(p);
        vec2 gv = fract(p) - 0.5;
        float rnd = hash12(id);
        if (rnd > 0.985) { 
            float dist = length(gv);
            float star = 1.0 / (dist * 20.0 + 0.1);
            star *= star * rnd;
            float twinkle = sin(t * (1.0 + rnd * 5.0)) * 0.5 + 0.5;
            star *= mix(0.7, 1.1, twinkle); 
            totalBrightness += star; 
        }
    }
    return totalBrightness;
}

// --- ZMODYFIKOWANA FUNKCJA RYSOWANIA SATELITÓW ---
float drawSatellites(vec3 rd, float t) {
    float acc = 0.0;
    for(int i=0; i<2; i++) {
        vec3 pos = uSatPos[i];
        float d = dot(rd, pos);
        if(d > 0.999) {
            // ZMIANA: Zwiększony próg początkowy z 0.99999 na 0.999995 dla mniejszego rozmiaru
            float spot = smoothstep(0.999995, 0.999999, d);
            float pulse = 0.5 + 0.5 * sin((t + float(i) * 0.4) * 8.0);
            acc += spot * pulse * step(0.0, pos.y);
        }
    }
    return acc;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
  vec3 ro = vec3(0.0, 800.0, 0.0); 
  
  float yaw = iMouse.x * 3.5; 
  float pitch = -iMouse.y * 1.5; 
  float cy = cos(yaw), sy = sin(yaw);
  float cp = cos(pitch), sp = sin(pitch);
  
  vec3 f = normalize(vec3(cp * sy, sp, cp * cy));
  vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
  vec3 u = cross(f, r);
  vec3 rd = normalize(f + uv.x * r + uv.y * u);

  float sunAngle = ((uTimeOfDay - 6.0) / 24.0) * 6.28318;
  vec3 sunPos = normalize(vec3(0.0, sin(sunAngle), cos(sunAngle)));
  float moonAngle = ((uTimeOfDay - 18.0) / 24.0) * 6.28318;
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

  // 1. NIEBO
  if (rd.y >= -0.05) { 
      vec3 skyBase = mix(colorNightSky, colorDaySky, dayFactor);
      vec3 horizonBase = mix(colorHorizonNight, colorHorizonDay, dayFactor);
      float sunsetInfluence = smoothstep(0.4, -0.15, abs(sunPos.y)); 
      horizonBase = mix(horizonBase, colorSunset, sunsetInfluence * 0.85);

      vec2 skyUV = vec2(atan(rd.x, rd.z), rd.y);
      float bgNoise = fbmLow(skyUV * 1.5, iTime * 0.2); 
      vec3 skyCol = mix(horizonBase, skyBase, sqrt(max(0.0, rd.y)) + bgNoise * 0.05);

      if (nightFactor > 0.01) {
          float starsVal = getStars(skyUV * 2.5, iTime);
          float dustVal = getStarDust(skyUV, iTime);
          skyCol += vec3(starsVal + dustVal) * vec3(0.8, 0.9, 1.0) * nightFactor * smoothstep(0.0, 0.3, rd.y);

          // --- ZMODYFIKOWANE INTERAKTYWNE GWIAZDY ---
          for(int i = 0; i < 3; i++) {
              float d = dot(rd, uStarPos[i]);
              if (d > 0.9996) {
                   float core = smoothstep(0.999995, 1.0, d);
                   float glowBase = smoothstep(0.9998, 1.0, d); 
                   // ZMIANA: pow(glowBase, 12.0) zamiast 4.0 - mniejszy zasięg smugi
                   float glow = pow(glowBase, 12.0); 
                   vec3 coreColor = vec3(1.0) * core * 4.0; 
                   // ZMIANA: mnożnik * 0.25 zamiast 0.6 - mniejsza jasność smugi
                   vec3 glowColor = vec3(0.7, 0.8, 1.0) * glow * 0.25; 
                   skyCol += (coreColor + glowColor) * nightFactor;
              }
          }
          skyCol += vec3(1.0) * drawSatellites(rd, iTime) * nightFactor;
      }

      float sunDot = dot(rd, sunPos);
      if (sunDot > 0.999 && rd.y > 0.0) { 
          float redness = smoothstep(0.3, 0.0, sunPos.y); 
          vec3 sunColor = mix(vec3(1.0, 0.95, 0.8), vec3(1.0, 0.05, 0.0), redness);
          skyCol += sunColor * smoothstep(0.999, 0.999 + mix(0.0008, 0.005, redness), sunDot) * 5.0; 
      }
      if (rd.y > -0.01) {
          float glowRedness = smoothstep(0.4, 0.0, sunPos.y);
          skyCol += mix(vec3(1.0, 0.8, 0.6), vec3(1.0, 0.2, 0.05), glowRedness) * pow(max(0.0, sunDot), 100.0) * 0.6 * (1.0 - smoothstep(0.8, 1.0, glowRedness)); 
      }

      float moonDot = dot(rd, moonPos);
      skyCol += vec3(0.6, 0.7, 0.9) * pow(max(0.0, moonDot), 150.0) * 0.4 * nightFactor * smoothstep(0.0, 0.25, moonPos.y);

      if (moonDot > 0.0 && nightFactor > 0.01) {
          float moonHeightFactor = smoothstep(-0.05, 0.4, moonPos.y);
          if (moonDot > mix(0.998, 0.990, moonHeightFactor)) {
               vec3 up = vec3(0.0, 1.0, 0.0);
               vec3 right = normalize(cross(moonPos, up));
               vec2 moonUV = vec2(dot(rd, right), dot(rd, cross(right, moonPos))) / mix(0.06, 0.14, moonHeightFactor) + 0.5;
               if(moonUV.x >= 0.0 && moonUV.x <= 1.0 && moonUV.y >= 0.0 && moonUV.y <= 1.0) {
                   vec4 texColor = texture(uMoonTexture, moonUV);
                   skyCol = mix(skyCol, texColor.rgb, texColor.a * nightFactor * smoothstep(0.0, 0.25, moonPos.y));
               }
          }
      }
          
      if (rd.y > 0.01) {
          float fogModifier = mix(1.0, 0.3, dayFactor);

          float tBG = (4000.0 - ro.y) / rd.y;
          vec2 cloudUV_BG = (ro + tBG * rd).xz * 0.0001 + vec2(-iTime * 0.005, -iTime * 0.0025);
          float nBG = fbmLow(cloudUV_BG, iTime * 0.8);
          float densityBG = smoothstep(0.3, 1.0, nBG) * 0.5 * (1.0 - smoothstep(5000.0, 80000.0/fogModifier, tBG));
          skyCol = mix(skyCol, mix(vec3(0.15, 0.18, 0.35), vec3(0.9, 0.95, 1.0), dayFactor * 0.8), densityBG);

          float tFG = (1500.0 - ro.y) / rd.y;
          vec2 cloudUV_FG = (ro + tFG * rd).xz * 0.0001 + vec2(-iTime * 0.01);
          float nFG = fbmHigh(cloudUV_FG, iTime);
          float densityFG = smoothstep(0.45, 0.85, nFG) * (1.0 - smoothstep(1000.0, 25000.0/fogModifier, tFG));
          
          vec3 cloudColor = mix(
             mix(vec3(0.04, 0.05, 0.22), vec3(0.28, 0.32, 0.45), nFG),
             mix(vec3(0.8, 0.8, 0.9), vec3(1.0), nFG) * (dayFactor < 0.5 ? vec3(1.0, 0.6, 0.6) : vec3(1.0)), 
             dayFactor
          );
          skyCol = mix(skyCol, cloudColor, densityFG);
      }
      finalColor = skyCol;
  }

  // 2. OCEAN
  if (rd.y < 0.0) {
      float t = -ro.y / rd.y;
      if (t > 0.0) {
          vec3 pos = ro + t * rd;
          vec2 oceanUV = pos.xz * 0.006 + iTime * 0.2;
          float wave = fbmLow(oceanUV, iTime * 2.8);
          
          vec3 horizonBaseForWater = mix(colorHorizonNight, colorHorizonDay, dayFactor);
          float sunH = smoothstep(0.4, -0.15, abs(sunPos.y));
          vec3 currentHorizonColor = mix(horizonBaseForWater, colorSunset, sunH * 0.85);

          vec3 waterCol = mix(
             mix(vec3(0.0, 0.002, 0.005), vec3(0.0, 0.08, 0.25), smoothstep(0.05, 0.5, sunPos.y)),
             mix(vec3(0.0, 0.01, 0.03), vec3(0.0, 0.25, 0.45), smoothstep(0.05, 0.5, sunPos.y)),
             wave
          );
          
          waterCol = mix(waterCol, currentHorizonColor * 0.6, smoothstep(0.6, 0.0, (nightFactor > 0.5) ? abs(moonPos.y) : abs(sunPos.y)) * 0.8);
          
          vec3 normal = normalize(vec3(wave*0.04, 1.0, wave*0.04));
          vec3 lightDir = nightFactor > 0.5 ? moonPos : sunPos;
          float spec = pow(max(0.0, dot(normal, normalize(lightDir - rd))), 20.0) * smoothstep(0.3, 1.0, wave) * 0.6 * ((nightFactor > 0.5) ? 0.8 : dayFactor);
          waterCol += mix(mix(vec3(1.0, 0.9, 0.6), vec3(1.0, 0.3, 0.1), smoothstep(0.3, 0.0, sunPos.y)), vec3(0.6, 0.7, 0.9), nightFactor) * spec;

          float foamMask = smoothstep(0.65, 0.92, wave);
          float foamDetail = fbmLow(oceanUV * 4.0, iTime * 5.5);
          waterCol = mix(waterCol, mix(vec3(0.98, 0.99, 1.0), colorSunset, sunH * smoothstep(-0.15, 0.1, sunPos.y)), foamMask * smoothstep(0.4, 0.8, foamDetail) * 0.8);

          float fogAmount = 1.0 - clamp(exp(-t * 0.00005), 0.0, 1.0); 
          vec3 oceanFinal = mix(waterCol, currentHorizonColor, fogAmount * 0.95);
          
          finalColor = (rd.y > -0.05) ? mix(oceanFinal, finalColor, smoothstep(-0.05, 0.0, rd.y)) : oceanFinal;
      }
  }

  float contrastVal = mix(1.0, 1.35, cinematicFactor);
  finalColor = (finalColor - 0.5) * contrastVal + 0.5;

  float distFromCenter = length(uv); 
  finalColor *= mix(1.0, smoothstep(1.6, 0.5, distFromCenter), 1.0 - mix(0.6, 0.65, cinematicFactor));

  float noise = hash12(gl_FragCoord.xy + iTime * 10.0);
  float grainStrength = mix(0.03, 0.09, cinematicFactor);
  finalColor += (noise - 0.5) * grainStrength;

  fragColor = vec4(finalColor, 1.0);
}
`;

function compileShader(gl, type, source){
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){ 
      console.error("Shader Error:", gl.getShaderInfoLog(shader)); 
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

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Link Error:", gl.getProgramInfoLog(program));
}

gl.useProgram(program);

const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(gl.getAttribLocation(program, "position"));
gl.vertexAttribPointer(gl.getAttribLocation(program, "position"), 2, gl.FLOAT, false, 0, 0);

const locs = {
    iTime: gl.getUniformLocation(program, "iTime"),
    iResolution: gl.getUniformLocation(program, "iResolution"),
    iMouse: gl.getUniformLocation(program, "iMouse"),
    uStarPos: gl.getUniformLocation(program, "uStarPos"),
    uSatPos: gl.getUniformLocation(program, "uSatPos"),
    uTimeOfDay: gl.getUniformLocation(program, "uTimeOfDay"),
    uMoonTexture: gl.getUniformLocation(program, "uMoonTexture")
};

function updateLabels(yaw, pitch) {
    if(timeOfDay > 6.0 && timeOfDay < 18.0) {
        starsData.forEach(s => s.element.style.display = 'none');
        satellitesData.forEach(s => s.element.style.display = 'none');
        return;
    }
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const f = [cp * sy, sp, cp * cy]; 
    let rx = f[2], rz = -f[0], rLen = Math.sqrt(rx*rx + rz*rz);
    rx /= rLen; rz /= rLen; 
    const ux = f[1]*rz, uy = f[2]*rx - f[0]*rz, uz = -f[1]*rx; 
    const w = window.innerWidth, h = window.innerHeight;

    const process = (obj) => {
        if(obj.type === 'satellite' && obj.pos[1] < 0.05) { obj.element.style.display = 'none'; return; }
        const dotF = obj.pos[0]*f[0] + obj.pos[1]*f[1] + obj.pos[2]*f[2];
        if (dotF <= 0) { obj.element.style.display = 'none'; return; }

        const screenX = ((obj.pos[0]*rx + obj.pos[1]*0 + obj.pos[2]*rz) / dotF) * h + w / 2;
        const screenY = ((obj.pos[0]*ux + obj.pos[1]*uy + obj.pos[2]*uz) / dotF) * h + h / 2;
        
        obj.element.style.display = 'flex';
        obj.element.style.left = screenX + 'px';
        obj.element.style.top = (h - screenY) + 'px';
        
        const dist = Math.sqrt((rawMouseX - screenX)**2 + (rawMouseY - (h - screenY))**2);
        if (dist < 50) obj.element.classList.add('visible');
        else obj.element.classList.remove('visible');
    };
    starsData.forEach(process);
    satellitesData.forEach(process);
}

// ==========================================
// PĘTLA RENDEROWANIA
// ==========================================
let isSkyVisible = true;
if(sectionSky) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { isSkyVisible = entry.isIntersecting; });
    }, { threshold: 0.01 });
    observer.observe(sectionSky);
}

function render(t){
  if(!isSkyVisible) {
      requestAnimationFrame(render);
      return;
  }

  t *= 0.001; 
  if(lastFrameTime === 0) lastFrameTime = t;
  const dt = t - lastFrameTime;
  lastFrameTime = t;
  simulationTime += dt * worldSpeed;

  currentMouseX += (targetMouseX - currentMouseX) * 0.02;
  currentMouseY += (targetMouseY - currentMouseY) * 0.02;

  satellitesData.forEach((sat, i) => {
      const ang = (simulationTime + sat.phase) * sat.speed;
      let x = Math.sin(ang), y = 0.5 + 0.3 * Math.cos(ang * 0.7), z = Math.cos(ang);
      const len = Math.sqrt(x*x + y*y + z*z);
      sat.pos = [x/len, y/len, z/len];
      satPositionsFlat.set(sat.pos, i*3);
  });

  gl.useProgram(program);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, moonTexture);
  gl.uniform1i(locs.uMoonTexture, 0);

  gl.uniform3fv(locs.uStarPos, starPositionsFlat);
  gl.uniform3fv(locs.uSatPos, satPositionsFlat);
  gl.uniform1f(locs.iTime, simulationTime);
  gl.uniform2f(locs.iResolution, canvas.width, canvas.height);
  gl.uniform2f(locs.iMouse, currentMouseX, currentMouseY); 
  gl.uniform1f(locs.uTimeOfDay, timeOfDay);

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  updateLabels(currentMouseX * 3.5, -currentMouseY * 1.5);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);