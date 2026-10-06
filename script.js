const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;
const orbitNodes = Array.from(document.querySelectorAll(".orbit-node"));
const orbitAngles = Array.from({ length: orbitNodes.length }, (_, i) => (i / orbitNodes.length) * Math.PI * 2);
const header = document.querySelector(".site-header");
const heroCopy = document.querySelector(".hero-copy");
const orbitStage = document.querySelector(".orbit-stage");

let scrollProgress = 0;
const pointer = { x: 0, y: 0 };

/* ---------- Three.js scene: glass knot + particle field ---------- */
function initScene() {
  const canvas = document.querySelector("#scene");
  if (!canvas || !window.THREE) return null;

  const THREE = window.THREE;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  scene.add(new THREE.AmbientLight(0x6070ff, 0.5));
  const keyLight = new THREE.PointLight(0x7c8cff, 2.2, 40);
  keyLight.position.set(5, 4, 6);
  const rimLight = new THREE.PointLight(0x4be3c5, 1.8, 40);
  rimLight.position.set(-6, -3, 4);
  const pinkLight = new THREE.PointLight(0xff7ac6, 1.4, 40);
  pinkLight.position.set(0, 5, -4);
  scene.add(keyLight, rimLight, pinkLight);

  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.4, 0.42, 220, 32),
    new THREE.MeshPhysicalMaterial({
      color: 0x8fa0ff,
      metalness: 0.15,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.55,
      reflectivity: 1
    })
  );
  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.2, 1),
    new THREE.MeshBasicMaterial({ color: 0x4be3c5, wireframe: true, transparent: true, opacity: 0.08 })
  );
  const group = new THREE.Group();
  group.add(knot, wire);
  scene.add(group);

  const count = window.innerWidth < 700 ? 900 : 2200;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = [new THREE.Color(0x7c8cff), new THREE.Color(0x4be3c5), new THREE.Color(0xff7ac6), new THREE.Color(0xffffff)];
  for (let i = 0; i < count; i++) {
    const r = 6 + Math.random() * 22;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) - 10;
    positions[i * 3 + 2] = r * Math.cos(phi) - 6;
    const c = palette[i % palette.length];
    colors.set([c.r, c.g, c.b], i * 3);
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false })
  );
  scene.add(particles);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // keep knot to the side on desktop, centered behind content on mobile
    group.position.x = w > 900 ? 6.2 : 0;
    knot.material.opacity = w > 900 ? 0.55 : 0.3;
  }
  resize();
  window.addEventListener("resize", resize);

  const smooth = { p: 0, x: 0, y: 0 };

  return function render(time) {
    smooth.p += (scrollProgress - smooth.p) * 0.08;
    smooth.x += (pointer.x - smooth.x) * 0.05;
    smooth.y += (pointer.y - smooth.y) * 0.05;
    const t = time * 0.001;

    // scroll drives the camera dive + knot spin/scale
    camera.position.z = 9 - smooth.p * 5;
    camera.position.y = -smooth.p * 8;
    camera.lookAt(0, -smooth.p * 9, 0);

    group.rotation.x = t * 0.15 + smooth.p * Math.PI * 1.5 + smooth.y * 0.3;
    group.rotation.y = t * 0.2 + smooth.p * Math.PI * 2 + smooth.x * 0.4;
    group.position.y = -smooth.p * 6;
    group.scale.setScalar(1 - smooth.p * 0.35);
    wire.rotation.z = -t * 0.1;

    particles.rotation.y = t * 0.02 + smooth.p * 0.8;
    particles.rotation.x = smooth.y * 0.08;

    renderer.render(scene, camera);
  };
}

/* ---------- CSS orbit around avatar ---------- */
function animateOrbit(time = 0) {
  const stage = document.querySelector(".orbit-track");
  if (!stage || !orbitNodes.length) return;
  const rect = stage.getBoundingClientRect();
  const radiusX = rect.width * 0.46;
  const radiusY = rect.height * 0.34;
  const drift = reducedMotion ? 0 : time * 0.00032;

  orbitNodes.forEach((node, index) => {
    const angle = orbitAngles[index] + drift;
    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusY;
    node.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${Math.sin(angle) * 40}px)`;
    node.style.zIndex = y > 0 ? 4 : 1;
    node.style.opacity = (0.55 + (Math.sin(angle) + 1) * 0.225).toFixed(2);
  });
}

/* ---------- Scroll-driven effects ---------- */
function updateScroll() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight || 1;
  scrollProgress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
  root.style.setProperty("--progress", scrollProgress.toFixed(4));
  root.style.setProperty("--scene-tilt", `${scrollProgress * 42 - 10}deg`);
  root.style.setProperty("--spin-a", `${scrollProgress * 360}deg`);
  root.style.setProperty("--spin-b", `${scrollProgress * -300}deg`);

  header?.classList.toggle("scrolled", window.scrollY > 40);

  // hero parallax: copy drifts up and fades, orbit pushes back in Z
  const heroP = Math.min(1, window.scrollY / window.innerHeight);
  if (!reducedMotion) {
    if (heroCopy?.classList.contains("is-visible")) {
      heroCopy.style.transform = `translate3d(0, ${heroP * -80}px, 0)`;
      heroCopy.style.opacity = `${1 - heroP * 0.9}`;
    }
    if (orbitStage?.classList.contains("is-visible")) {
      orbitStage.style.transform = `translate3d(0, ${heroP * 60}px, ${heroP * -300}px) rotateY(${heroP * 30}deg)`;
      orbitStage.style.opacity = `${1 - heroP * 0.8}`;
    }
  }

  // experience timeline line draws in as the section scrolls past
  const timeline = document.querySelector(".timeline");
  if (timeline) {
    const rect = timeline.getBoundingClientRect();
    const drawn = (window.innerHeight * 0.75 - rect.top) / rect.height;
    timeline.style.setProperty("--timeline", Math.min(1, Math.max(0, drawn)).toFixed(3));
  }

  // stack chips ripple in depth with scroll
  document.querySelectorAll(".stack-orbit span").forEach((item, index) => {
    const wave = Math.sin(scrollProgress * Math.PI * 4 + index * 0.8);
    item.style.setProperty("--depth", `${wave * 40}px`);
    item.style.setProperty("--rx", `${wave * 12}deg`);
  });
}

/* ---------- Active nav link ---------- */
const navLinks = Array.from(document.querySelectorAll(".nav-links a"));
const sectionObserver = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`));
    });
  },
  { rootMargin: "-45% 0px -50% 0px" }
);
document.querySelectorAll("section[id]").forEach(section => sectionObserver.observe(section));

/* ---------- 3D reveal with stagger ---------- */
document.querySelectorAll(".focus-grid, .project-rail, .project-grid").forEach(group => {
  Array.from(group.children).forEach((child, i) => child.style.setProperty("--delay", `${i * 0.08}s`));
});

const revealObserver = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach(element => revealObserver.observe(element));

/* ---------- Liquid glass specular + tilt ---------- */
document.querySelectorAll(".glass").forEach(el => {
  el.addEventListener("pointermove", event => {
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    el.style.setProperty("--my", `${event.clientY - rect.top}px`);
  });
});

if (finePointer && !reducedMotion) {
  document.querySelectorAll("[data-tilt]").forEach(card => {
    card.addEventListener("pointermove", event => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `rotateX(${y * -10}deg) rotateY(${x * 12}deg) translateZ(10px)`;
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });

  window.addEventListener("pointermove", event => {
    pointer.x = event.clientX / window.innerWidth - 0.5;
    pointer.y = event.clientY / window.innerHeight - 0.5;
  });
}

/* ---------- Loop ---------- */
const renderScene = initScene();

function frame(time) {
  animateOrbit(time);
  renderScene?.(time);
  if (!reducedMotion) requestAnimationFrame(frame);
}

window.addEventListener("scroll", updateScroll, { passive: true });
window.addEventListener("resize", updateScroll);
updateScroll();
requestAnimationFrame(frame);
