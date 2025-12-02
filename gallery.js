// gallery.js

(function() {
    // 1. Znajdź sekcję galerii
    const gallerySection = document.querySelector('.gallery-section');
    
    if (!gallerySection) {
        console.warn("Nie znaleziono sekcji .gallery-section");
        return;
    }

    // 2. Utwórz i skonfiguruj Canvas
    const canvas = document.createElement('canvas');
    canvas.id = "galleryGrainCanvas";
    
    // Style CSS ustawiane dynamicznie, żeby nie śmiecić w style.css
    Object.assign(canvas.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none', // Kliknięcia przechodzą przez ziarno do zdjęć
        zIndex: '5',           // Nad zdjęciami (trackiem), ale pod napisem GALLERY (z-index: 10)
        mixBlendMode: 'overlay', // KLUCZOWE: Sprawia, że szum wtapia się w zdjęcia
        opacity: '0.15'         // Dostosuj siłę ziarna tutaj (0.1 - delikatne, 1.0 - mocne)
    });

    gallerySection.appendChild(canvas);

    // 3. Inicjalizacja WebGL2
    const gl = canvas.getContext("webgl2", { 
        alpha: true,            // Tło musi być przezroczyste
        antialias: false, 
        powerPreference: "high-performance" 
    });

    if (!gl) {
        console.log("WebGL2 nieobsługiwany dla galerii.");
        return;
    }

    // --- OPTYMALIZACJA (Taka sama jak w sky.js) ---
    const QUALITY = 0.7; // Niższa jakość dla lepszej wydajności i stylu retro

    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        
        // Pobieramy wymiary sekcji, nie okna (choć tutaj to to samo, bo sekcja ma 100vh)
        let displayWidth = gallerySection.offsetWidth * dpr;
        let displayHeight = gallerySection.offsetHeight * dpr;

        canvas.width = displayWidth * QUALITY;
        canvas.height = displayHeight * QUALITY;

        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // ==========================================
    // VERTEX SHADER (Standardowy)
    // ==========================================
    const vertexShaderSource = `#version 300 es
    in vec4 position;
    void main() { 
        gl_Position = position; 
    }
    `;

    // ==========================================
    // FRAGMENT SHADER (Tylko ziarno)
    // ==========================================
    const fragmentShaderSource = `#version 300 es
    precision highp float;

    uniform float iTime;
    uniform vec2 iResolution;
    out vec4 fragColor;

    // Ten sam algorytm co w sky.js
    float filmGrain(vec2 uv, float t) {
        float tOffset = fract(t * 123.456); 
        float noise = fract(sin(dot(uv + tOffset, vec2(12.9898, 78.233))) * 43758.5453);
        return noise; // Zwracamy 0.0 do 1.0
    }

    void main() {
        // Obliczamy szum dla każdego piksela
        float noise = filmGrain(gl_FragCoord.xy, iTime);
        

        
        vec3 color = vec3(noise);
        
        // Output: Szary szum. Alpha musi być 1.0, bo przezroczystość sterujemy przez CSS mix-blend-mode
        fragColor = vec4(color, 1.0);
    }
    `;

    // ==========================================
    // KOMPILACJA
    // ==========================================
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

    // ==========================================
    // RENDER LOOP
    // ==========================================
    function render(t){
        t *= 0.001;
        
        // Czyścimy zachowując przezroczystość
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        gl.uniform1f(iTimeLoc, t);
        
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

})();