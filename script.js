// The page intentionally works without JavaScript.
// JavaScript only handles the optional color theme and footer year.
const themeButton = document.getElementById('theme-button');
const root = document.documentElement;
function setTheme(theme) {
  root.dataset.theme = theme;
  themeButton?.setAttribute('aria-label', theme === 'dark' ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren');
  themeButton?.setAttribute('aria-pressed', String(theme === 'light'));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d131c' : '#f8f9fa');
}
try { setTheme(localStorage.getItem('kk-resume-theme') === 'light' ? 'light' : 'dark'); }
catch { setTheme('dark'); }
themeButton?.addEventListener('click', () => {
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  setTheme(next);
  try { localStorage.setItem('kk-resume-theme', next); } catch {}
});
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();


// V3.2: scroll-snap project carousel. Cards stay usable without animation.
const track = document.getElementById('project-slider');
const slides = [...document.querySelectorAll('.project-slide')];
const slidePrev = document.getElementById('projects-prev');
const slideNext = document.getElementById('projects-next');
const slideCounter = document.getElementById('projects-counter');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function currentSlideIndex() {
  if (!track || !slides.length) return 0;
  let index = 0;
  let best = Infinity;
  slides.forEach((slide, n) => {
    const dist = Math.abs(slide.offsetLeft - track.offsetLeft - track.scrollLeft);
    if (dist < best) { best = dist; index = n; }
  });
  return index;
}
function updateCarousel() {
  const index = currentSlideIndex();
  if (slideCounter) slideCounter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
  if (slidePrev) slidePrev.disabled = !track || track.scrollLeft < 3;
  if (slideNext) slideNext.disabled = !track || track.scrollLeft >= track.scrollWidth - track.clientWidth - 3;
}
function goToSlide(index) {
  if (!track || !slides.length) return;
  const target = slides[Math.max(0, Math.min(slides.length - 1, index))];
  track.scrollTo({left: target.offsetLeft - track.offsetLeft, behavior: reduceMotion.matches ? 'instant' : 'smooth'});
}
slidePrev?.addEventListener('click', () => goToSlide(currentSlideIndex() - 1));
slideNext?.addEventListener('click', () => goToSlide(currentSlideIndex() + 1));
track?.addEventListener('scroll', updateCarousel, {passive:true});
track?.addEventListener('keydown', (event) => {
  if (event.target !== track) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); goToSlide(currentSlideIndex() + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); goToSlide(currentSlideIndex() - 1); }
});
window.addEventListener('resize', updateCarousel);
updateCarousel();

// One accessible project modal for all projects; image paths in projects.js.
const modal = document.getElementById('project-dialog');
const lightbox = document.getElementById('image-lightbox');
const enlargeButton = document.getElementById('modal-image-enlarge');
let activeProject = null;
let activeImageIndex = 0;

function showProjectImage(index) {
  if (!activeProject) return;
  const images = activeProject.images;
  activeImageIndex = (index + images.length) % images.length;
  const item = images[activeImageIndex];
  const img = document.getElementById('modal-image');
  img.src = item.src;
  img.alt = `${activeProject.name}: ${item.label}`;
  document.getElementById('modal-image-label').textContent = item.label;
  document.getElementById('modal-image-count').textContent = `${String(activeImageIndex+1).padStart(2,'0')} / ${String(images.length).padStart(2,'0')}`;
  document.querySelectorAll('.modal-thumbnail').forEach((button,i) => button.setAttribute('aria-pressed', String(i===activeImageIndex)));
  document.getElementById('image-prev').disabled = images.length < 2;
  document.getElementById('image-next').disabled = images.length < 2;
  enlargeButton?.setAttribute('aria-label', `${item.label} vergrößern`);
  if (lightbox?.open) updateLightboxImage();
}
function showProject(id) {
  if (!modal || typeof modal.showModal !== 'function') return;
  const p = window.CV_PROJECTS?.find(project => project.id === id);
  if (!p) return;
  activeProject = p;
  document.getElementById('modal-project-type').textContent = p.type;
  document.getElementById('modal-project-name').textContent = p.name;
  document.getElementById('modal-project-description').textContent = p.description;
  const tech = document.getElementById('modal-project-tech');
  tech.replaceChildren(...p.tech.map(item => {const span=document.createElement('span');span.textContent=item;return span;}));
  const holder = document.getElementById('modal-project-link');
  holder.replaceChildren();
  if (p.link) {
    const a = document.createElement('a'); a.href=p.link; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent='Repository auf GitHub ↗';holder.appendChild(a);
  } else {
    const span=document.createElement('span'); span.textContent=p.linkLabel;holder.appendChild(span);
  }
  document.getElementById('modal-project-note').textContent = p.note || '';
  const thumbs = document.getElementById('modal-thumbnails');
  thumbs.replaceChildren(...p.images.map((item,i)=>{
    const b=document.createElement('button');b.type='button';b.className='modal-thumbnail';b.setAttribute('aria-label',item.label+' anzeigen');
    const image=document.createElement('img');image.src=item.src;image.alt='';image.loading='lazy';
    b.appendChild(image);b.addEventListener('click',()=>showProjectImage(i));return b;
  }));
  showProjectImage(0);
  modal.showModal();
}
document.querySelectorAll('.project-slide[data-project]').forEach(card => card.addEventListener('click',()=>showProject(card.dataset.project)));
document.getElementById('modal-close')?.addEventListener('click',()=>modal.close());
document.getElementById('image-prev')?.addEventListener('click',()=>showProjectImage(activeImageIndex-1));
document.getElementById('image-next')?.addEventListener('click',()=>showProjectImage(activeImageIndex+1));
modal?.addEventListener('click',event=>{if(event.target===modal) modal.close();});
modal?.addEventListener('keydown',event=>{
  if (event.target.closest('button')) return;
  if(event.key==='ArrowRight') {event.preventDefault();showProjectImage(activeImageIndex+1);}
  if(event.key==='ArrowLeft') {event.preventDefault();showProjectImage(activeImageIndex-1);}
});
modal?.addEventListener('close',()=>{activeProject=null;document.getElementById('modal-image').removeAttribute('src');});

// V3.3: Full-screen screenshot view above the existing project dialog.
// Clicking the large project preview opens it; Escape closes only this top dialog.
function updateLightboxImage() {
  if (!activeProject) return;
  const item = activeProject.images[activeImageIndex];
  const image = document.getElementById('lightbox-image');
  image.src = item.src;
  image.alt = `${activeProject.name}: ${item.label}`;
  document.getElementById('lightbox-title').textContent = activeProject.name;
  document.getElementById('lightbox-caption').textContent = item.label;
  document.getElementById('lightbox-counter').textContent = `${String(activeImageIndex + 1).padStart(2, '0')} / ${String(activeProject.images.length).padStart(2, '0')}`;
  document.getElementById('lightbox-prev').disabled = activeProject.images.length < 2;
  document.getElementById('lightbox-next').disabled = activeProject.images.length < 2;
}
function openLightbox() {
  if (!activeProject || !lightbox || !modal?.open || typeof lightbox.showModal !== 'function') return;
  updateLightboxImage();
  if (!lightbox.open) lightbox.showModal();
}
enlargeButton?.addEventListener('click', openLightbox);
document.getElementById('lightbox-close')?.addEventListener('click', () => lightbox?.close());
document.getElementById('lightbox-prev')?.addEventListener('click', () => showProjectImage(activeImageIndex - 1));
document.getElementById('lightbox-next')?.addEventListener('click', () => showProjectImage(activeImageIndex + 1));
lightbox?.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); showProjectImage(activeImageIndex + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); showProjectImage(activeImageIndex - 1); }
});
// A click directly on the backdrop dismisses the fullscreen image, but not the project dialog.
lightbox?.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
lightbox?.addEventListener('close', () => {
  document.getElementById('lightbox-image')?.removeAttribute('src');
  if (modal?.open) enlargeButton?.focus({ preventScroll: true });
});
