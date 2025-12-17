document.addEventListener("DOMContentLoaded", function() {
    
    const preloader = document.getElementById('preloader');
    const preloaderText = preloader.querySelector('.preloader-text');
    const customCursor = document.getElementById('custom-cursor');

    if(customCursor) customCursor.style.opacity = '0';

    const textContent = preloaderText.textContent.trim();
    preloaderText.innerHTML = '';
    preloaderText.style.opacity = '1';

    textContent.split('').forEach(char => {
        const span = document.createElement('span');
        span.textContent = char;
        span.style.opacity = '0';
        span.style.display = 'inline-block';
        if (char === ' ') span.style.width = '10px'; 
        preloaderText.appendChild(span);
    });

    const letters = preloaderText.querySelectorAll('span');

    const tl = gsap.timeline({
        onComplete: () => {
            if(customCursor) customCursor.style.opacity = '1';

            preloader.style.opacity = '0';
            preloader.style.visibility = 'hidden'; 
        }
    });

    tl.to(letters, {
        duration: 1.5,
        opacity: 1,
        filter: "blur(0px)",
        startAt: { filter: "blur(15px)", opacity: 0 },
        stagger: 0.1,
        ease: "power2.out"
    })
    .to({}, { duration: 1.5 })
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
        ease: "power2.inOut",
        onComplete: () => {
             preloader.style.display = 'none';
        }
    }, "-=0.2"); 
});