import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Rejestracja wtyczki ScrollTrigger (musi być załadowana w HTML przez CDN)
gsap.registerPlugin(ScrollTrigger);

const canvas = document.querySelector('#webgl-container');

// Sprawdzamy, czy canvas istnieje (na wypadek gdyby skrypt był ładowany na innej podstronie)
if (canvas) {
    const scene = new THREE.Scene();
    
    // Kamera
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 3, 4); 
    
    // Renderer
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    // Oświetlenie
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 10);
    directionalLight.position.set(-15, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);


    let model = null;
    const loader = new GLTFLoader();

    // Ładowanie modelu
    loader.load(
        'statue.glb', // Upewnij się, że masz ten plik!
        (gltf) => {
            model = gltf.scene;
            
            // Dostosowanie skali i pozycji - może wymagać zmian w zależności od modelu
            model.scale.set(7, 7, 7); 
            model.position.set(0, -3.5, -1);
            
            // Materiał (opcjonalnie, jeśli chcesz nadpisać oryginalny)
            model.traverse((child) => {
                if (child.isMesh) {
                     // child.material = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4 });
                }
            });

            scene.add(model);
            camera.lookAt(0, 0, 0); 
            
            // Inicjalizacja animacji po załadowaniu modelu
            initScrollAnimation(camera, model);
        },
        (xhr) => { 
            // console.log((xhr.loaded / xhr.total * 100) + '% loaded'); 
        },
        (error) => {
            console.error('Błąd ładowania modelu (statue.glb). Wczytuję zastępczy sześcian.', error);
            
            // Fallback: Sześcian jeśli nie ma modelu
            const geometry = new THREE.BoxGeometry(1, 2, 1);
            const material = new THREE.MeshStandardMaterial({ color: 0x444444, wireframe: true });
            model = new THREE.Mesh(geometry, material);
            model.position.set(0, 0, 0);
            scene.add(model);
            initScrollAnimation(camera, model);
        }
    );

    function initScrollAnimation(cam, mesh) {
        // Definicja osi czasu GSAP podpiętej pod scroll
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: "#statue-section", // ID sekcji z rzeźbą
                start: "top top",           // Start gdy góra sekcji dotknie góry ekranu
                end: "+=2000",              // Długość scrollowania (im więcej, tym wolniejsza animacja)
                scrub: 1,                   // Płynność (1 sekunda opóźnienia)
                pin: true,                  // Przypięcie sekcji (sticky)
                anticipatePin: 1
            }
        });

        // 1. Ruch Kamery (zbliżenie i zmiana kąta)
        tl.to(cam.position, {
            x: 4,
            y: -2,
            z: 10,
            duration: 10,
            ease: "none",
            onUpdate: function() {
                cam.lookAt(0, 0, 0);
            }
        }, 0); 

        // 2. Obrót modelu
        tl.to(mesh.rotation, {
            y: Math.PI * 1.5, // Obrót o 270 stopni
            duration: 10,
            ease: "none"
        }, 0);

        // 3. Pojawianie się tekstów w rogach (sekwencyjnie)
        // Offsety czasowe (0.5, 3, 5.5, 8) decydują kiedy tekst wjeżdża
        tl.to(".top-left", { autoAlpha: 1, y: 0, duration: 1 }, 0.5);
        tl.to(".bottom-left", { autoAlpha: 1, y: 0, duration: 1 }, 3);
        tl.to(".top-right", { autoAlpha: 1, y: 0, duration: 1 }, 5.5);
        tl.to(".bottom-right", { autoAlpha: 1, y: 0, duration: 1 }, 8);
    }

    // Pętla renderowania
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    // Responsywność
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}