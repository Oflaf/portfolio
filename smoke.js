/* smoke.js - Efekt WebGL dla stopki */

document.addEventListener("DOMContentLoaded", function() {
    const canvas = document.getElementById('smoke-canvas');
    if (!canvas) return; // Jeśli nie ma canvasa, przerwij

    const gl = canvas.getContext('webgl');
    if (!gl) { console.warn('Brak WebGL dla smoke-canvas'); return; }

    // --- SHADERS (Jako stringi w JS) ---

    const vertexShaderSource = `
        attribute vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;

    const fragmentShaderSource = `
        precision highp float;

        uniform vec2 u_resolution;
        uniform float u_time;
        uniform float u_scroll;
        uniform vec2 u_mouse;

        // --- NOISE FUNCTIONS ---
        float hash(vec2 p) {
            p = fract(p * vec2(443.897, 441.423));
            p += dot(p, p.yx + 19.19);
            return fract((p.x + p.y) * p.x);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                       mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
        }

        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);

        float fbm(vec2 p) {
            float value = 0.0;
            float amplitude = 0.55;
            float total = 0.0;
            for (int i = 0; i < 4; i++) {
                value += amplitude * noise(p);
                p *= rot;
                p *= 2.0;
                p += vec2(4.32, 1.23); 
                total += amplitude;
                amplitude *= 0.5;
            }
            return value / total;
        }

        void main() {
            vec2 uv = gl_FragCoord.xy / u_resolution.y;
            uv.x -= (u_resolution.x / u_resolution.y) * 0.5;

            float t = u_time * 0.22; 

            // Mysz
            vec2 mouseOffset = (u_mouse - 0.5) * 0.45;
            vec2 uv_moved = uv + mouseOffset;

            // Rotacja
            float spinAngle = t * 0.3; 
            float s = sin(spinAngle);
            float c = cos(spinAngle);
            mat2 spinMatrix = mat2(c, -s, s, c);
            uv_moved = spinMatrix * uv_moved;

            // Siły
            vec2 rising = vec2(0.0, -t * 0.8);
            vec2 drift = vec2(sin(t * 0.5), cos(t * 0.4)) * 0.15;
            float breathe = 1.0 + sin(t * 0.7) * 0.05;
            uv_moved *= breathe;

            // Warping
            vec2 q = vec2(
                fbm(uv_moved + rising + drift), 
                fbm(uv_moved + vec2(5.2, 1.3) - rising)
            );
            
            vec2 r = vec2(
                fbm(uv_moved + 2.0*q + vec2(2.0, -t)), 
                fbm(uv_moved + 2.0*q + vec2(8.3, 2.8) + vec2(t * 0.5, t))
            );

            float interference = sin(uv_moved.x * 5.0 + t) * 0.05;
            float clouds = fbm(uv_moved + 1.5*r + interference);
            clouds = smoothstep(0.1, 0.9, clouds);

            // Gradient
            float screenY = 1.0 - (gl_FragCoord.y / u_resolution.y);
            // Zmodyfikowany depth, aby pasował do sekcji footera
            float depth = screenY * 0.6 + (u_scroll * 0.1); 
            
            float mask = smoothstep(0.0, 3.0, depth - 0.3);
            mask = pow(mask, 1.4);

            float brightness = clouds * mask;
            brightness *= 1.6;

            // Dithering & Color
            float grain = hash(gl_FragCoord.xy);
            
            vec3 c_black = vec3(0.0, 0.0, 0.0);
            vec3 c_ink   = vec3(0.04, 0.04, 0.06); 
            vec3 c_deep  = vec3(0.10, 0.10, 0.12);
            vec3 c_mid   = vec3(0.18, 0.19, 0.21);
            vec3 c_high  = vec3(0.30, 0.31, 0.33);

            vec3 finalColor = c_black;

            if (brightness > grain * 0.2) finalColor = c_ink;
            if (brightness > grain * 0.5) finalColor = c_deep;
            if (brightness > grain * 0.8) finalColor = c_mid;
            if (brightness > grain * 1.1) finalColor = c_high;

            finalColor *= smoothstep(0.0, 0.15, screenY);

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    // --- SETUP WEBGL ---

    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexShaderSource));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,1, 1,1, -1,-1, 1,-1]), gl.STATIC_DRAW);
    
    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const resLoc = gl.getUniformLocation(program, "u_resolution");
    const timeLoc = gl.getUniformLocation(program, "u_time");
    const scrollLoc = gl.getUniformLocation(program, "u_scroll");
    const mouseLoc = gl.getUniformLocation(program, "u_mouse");

    // --- LOGIC ---

    let scrollVal = 0;
    let mouseX = 0.5;
    let mouseY = 0.5;
    let targetMouseX = 0.5;
    let targetMouseY = 0.5;

    function resize() {
        // Canvas ma wypełniać swojego rodzica (footer), a nie całe okno fixed
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    // Pobieramy scroll całej strony, ale wpływ na shader będzie subtelniejszy
    window.addEventListener('scroll', () => {
        let maxH = document.body.scrollHeight - window.innerHeight;
        scrollVal = window.pageYOffset / (maxH || 1);
    });

    window.addEventListener('mousemove', (e) => {
        targetMouseX = e.clientX / window.innerWidth;
        targetMouseY = 1.0 - (e.clientY / window.innerHeight);
    });

    function render(time) {
        // Sprawdź czy canvas jest widoczny w viewport (optymalizacja)
        const rect = canvas.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
            requestAnimationFrame(render);
            return; 
        }

        mouseX += (targetMouseX - mouseX) * 0.05;
        mouseY += (targetMouseY - mouseY) * 0.05;

        gl.uniform2f(resLoc, canvas.width, canvas.height);
        gl.uniform1f(timeLoc, time * 0.001); 
        gl.uniform1f(scrollLoc, scrollVal);
        gl.uniform2f(mouseLoc, mouseX, mouseY);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
});