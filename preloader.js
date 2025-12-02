document.addEventListener("DOMContentLoaded", function() {
    
    const preloader = document.getElementById('preloader');
    const preloaderText = preloader.querySelector('.preloader-text');
    const customCursor = document.getElementById('custom-cursor');

    // 1. Zablokuj scrollowanie na czas intro
    document.body.style.overflow = 'hidden';
    
    // 2. Ukryj custom cursor na start (żeby kropka nie latała po czarnym ekranie)
    if(customCursor) customCursor.style.opacity = '0';

    // 3. Rozbij tekst na litery, aby animować każdą osobno
    const textContent = preloaderText.textContent.trim();
    preloaderText.innerHTML = '';
    preloaderText.style.opacity = '1'; // Pokazujemy kontener, bo litery są w środku

    textContent.split('').forEach(char => {
        const span = document.createElement('span');
        span.textContent = char;
        span.style.opacity = '0';
        span.style.display = 'inline-block';
        // Zachowaj spacje
        if (char === ' ') span.style.width = '10px'; 
        preloaderText.appendChild(span);
    });

    const letters = preloaderText.querySelectorAll('span');

    // 4. Stwórz Timeline w GSAP
    const tl = gsap.timeline({
        onComplete: () => {
            // Po zakończeniu animacji:
            // - Odblokuj scroll
            document.body.style.overflow = ''; 
            // - Pokaż kursor
            if(customCursor) customCursor.style.opacity = '1';
            // - Usuń preloader z DOM (dla wydajności)
            preloader.remove();
        }
    });

    tl.to(letters, {
        duration: 1.5,
        opacity: 1,
        filter: "blur(0px)",
        startAt: { filter: "blur(15px)", opacity: 0 },
        stagger: 0.1, // Opóźnienie między literkami
        ease: "power2.out"
    })
    .to({}, { duration: 1.5 }) // Pauza: trzymaj napis przez 1.5s (łącznie wyjdzie ok 3-4s z animacją)
    .to(preloaderText, {
        duration: 0.8,
        opacity: 0,
        filter: "blur(10px)",
        y: -20,
        ease: "power2.in"
    })
    .to(preloader, {
        duration: 1,
        opacity: 0,
        ease: "power2.inOut"
    }, "-=0.2"); // Zacznij znikać tło chwilę przed końcem tekstu
});