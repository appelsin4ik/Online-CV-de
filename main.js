// Scroll reveal
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.2,
  }
);

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));


// ===== Draggable cards + Reset layout + Zoom =====
(function () {
  const cards = Array.from(document.querySelectorAll('.card'));
  if (!cards.length) return;

  const stateByCard = new Map();
  let currentDrag = null;

  const resetButton = document.querySelector('.layout-reset-btn');

  // Init: save current state & add zoom btn
  cards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    stateByCard.set(card, {
      parent: card.parentElement,
      nextSibling: card.nextSibling,
      originalRect: rect,
      placeholder: null,
    });

    card.style.touchAction = 'none';

    card.addEventListener('mousedown', onDragStart);
    card.addEventListener('touchstart', onDragStart, { passive: false });

    // zoom btn
    const zoomBtn = document.createElement('button');
    zoomBtn.type = 'button';
    zoomBtn.className = 'card-zoom-btn';
    zoomBtn.setAttribute('data-no-drag', 'true');
    zoomBtn.textContent = '⤢';
    card.appendChild(zoomBtn);

    zoomBtn.addEventListener('click', (e) => onZoomClick(e, card));
  });

  if (resetButton) {
    resetButton.disabled = true;
    resetButton.addEventListener('click', resetAllCards);
  }

  // ===== helper: visibility of reset btn =====
  function updateResetButtonVisibility() {
    if (!resetButton) return;

    const anyOffLayout = Array.from(stateByCard.values()).some(
      (state) => state.placeholder
    );

    if (anyOffLayout) {
      if (!resetButton.classList.contains('layout-reset-btn--visible')) {
        resetButton.classList.add('layout-reset-btn--visible');
        resetButton.disabled = false;

        requestAnimationFrame(() => {
          resetButton.classList.add('layout-reset-btn--shown');
        });
      } else {
        resetButton.disabled = false;
      }
    } else {
      if (!resetButton.classList.contains('layout-reset-btn--visible')) {
        resetButton.disabled = true;
        return;
      }

      resetButton.disabled = true;
      resetButton.classList.remove('layout-reset-btn--shown');

      const onTransitionEnd = (ev) => {
        if (ev.propertyName !== 'opacity') return;
        resetButton.classList.remove('layout-reset-btn--visible');
        resetButton.removeEventListener('transitionend', onTransitionEnd);
      };

      resetButton.addEventListener('transitionend', onTransitionEnd);
    }
  }

  // ===== Drag start =====
  function onDragStart(event) {
    if (event.type === 'mousedown' && event.button !== 0) return;

    // deny drag on link/btns/...
    const interactive = event.target.closest('a, button, [data-no-drag]');
    if (interactive) {
      return;
    }

    event.preventDefault();
    const card = event.currentTarget;
    const state = stateByCard.get(card);
    if (!state) return;

    const rect = card.getBoundingClientRect();
    const point = getPoint(event);
    const offsetX = point.x - rect.left;
    const offsetY = point.y - rect.top;

    // create placeholder (if not there)
    if (!state.placeholder) {
      const placeholder = document.createElement('div');
      placeholder.className = 'card-placeholder';
      placeholder.style.height = rect.height + 'px';
      state.placeholder = placeholder;

      if (state.parent.contains(card)) {
        state.parent.insertBefore(placeholder, card.nextSibling);
      }

      updateResetButtonVisibility();
    }

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    card.classList.add('dragging');
    card.classList.add('card-floating'); // float mode

    const ZOOM_FACTOR = 1.25; // should be the same with : CSS .card-floating.card-zoomed { transform: scale(...) } !!!!!!!!

    let baseWidth = rect.width;
    if (card.classList.contains('card-zoomed')) {
      // rect.width with scale -> devide by factor for "real" width
      baseWidth = rect.width / ZOOM_FACTOR;
    }
    card.style.width = baseWidth + 'px';

    card.style.position = 'absolute';
    card.style.left = rect.left + scrollX + 'px';
    card.style.top = rect.top + scrollY + 'px';
    card.style.zIndex = '1000';
    card.style.pointerEvents = 'none';

    document.body.appendChild(card);

    currentDrag = {
      card,
      state,
      offsetX,
      offsetY,
    };

    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('touchend', onDragEnd);
    window.addEventListener('touchcancel', onDragEnd);
  }


  function onDragMove(event) {
    if (!currentDrag) return;
    event.preventDefault();

    const { card, offsetX, offsetY } = currentDrag;
    const point = getPoint(event);
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    card.style.left = point.x + scrollX - offsetX + 'px';
    card.style.top = point.y + scrollY - offsetY + 'px';
  }

  // ===== Drag end =====
  function onDragEnd() {
    if (!currentDrag) return;

    const { card, state } = currentDrag;

    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    window.removeEventListener('touchmove', onDragMove);
    window.removeEventListener('touchend', onDragEnd);
    window.removeEventListener('touchcancel', onDragEnd);

    card.style.pointerEvents = '';

    if (state.placeholder) {
      const placeholderRect = state.placeholder.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();

      const placeholderCenterX = placeholderRect.left + placeholderRect.width / 2;
      const placeholderCenterY = placeholderRect.top + placeholderRect.height / 2;

      const cardCenterX = cardRect.left + cardRect.width / 2;
      const cardCenterY = cardRect.top + cardRect.height / 2;

      const dist = Math.hypot(cardCenterX - placeholderCenterX, cardCenterY - placeholderCenterY);
      const SNAP_DISTANCE = 50;

      if (dist < SNAP_DISTANCE) {
        // back to layout
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        const targetLeft = placeholderRect.left + scrollX;
        const targetTop = placeholderRect.top + scrollY;

        card.style.transition = 'top 0.2s ease-out, left 0.2s ease-out';
        card.style.left = targetLeft + 'px';
        card.style.top = targetTop + 'px';

        const onTransitionEnd = () => {
          card.style.transition = '';
          card.classList.remove('dragging', 'card-floating', 'card-zoomed');
          card.style.position = '';
          card.style.left = '';
          card.style.top = '';
          card.style.zIndex = '';
          card.style.transform = ''; // kill zoom

          if (state.parent.contains(state.placeholder)) {
            state.parent.insertBefore(card, state.placeholder);
          } else {
            state.parent.appendChild(card);
          }

          if (state.placeholder && state.placeholder.parentNode) {
            state.placeholder.remove();
          }
          state.placeholder = null;

          card.removeEventListener('transitionend', onTransitionEnd);
          updateResetButtonVisibility();
        };

        card.addEventListener('transitionend', onTransitionEnd);
      } else {
        // still floating + zoomed
        card.classList.remove('dragging');
        card.classList.add('card-floating');
      }
    } else {
      card.classList.remove('dragging');
    }

    currentDrag = null;
  }

  // ===== Zoom btn =====
  function onZoomClick(event, card) {
    event.preventDefault();
    event.stopPropagation();

    const state = stateByCard.get(card);
    if (!state) return;

    if (!state.placeholder) {
      const rect = card.getBoundingClientRect();

      const placeholder = document.createElement('div');
      placeholder.className = 'card-placeholder';
      placeholder.style.height = rect.height + 'px';
      state.placeholder = placeholder;

      if (state.parent.contains(card)) {
        state.parent.insertBefore(placeholder, card.nextSibling);
      }

      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      card.classList.add('card-floating');
      card.style.position = 'absolute';
      card.style.left = rect.left + scrollX + 'px';
      card.style.top = rect.top + scrollY + 'px';
      card.style.zIndex = '1000';

      document.body.appendChild(card);

      updateResetButtonVisibility();
    } else {
      card.classList.add('card-floating');
    }

    // toggle zoom state
    if (card.classList.contains('card-zoomed')) {
      card.classList.remove('card-zoomed');
      card.style.transform = '';
    } else {
      card.classList.add('card-zoomed');
    }
  }

  // ===== Reset all =====
  function resetAllCards() {
    if (currentDrag) return;

    const toReset = [];
    stateByCard.forEach((state, card) => {
      if (state.placeholder) {
        toReset.push({ state, card });
      }
    });

    if (!toReset.length) return;

    if (resetButton) {
      resetButton.disabled = true;
    }

    playResetSound();

    let pending = toReset.length;

    const finishOne = () => {
      pending--;
      if (pending === 0) {
        updateResetButtonVisibility();
      }
    };

    toReset.forEach(({ state, card }) => {
      const placeholder = state.placeholder;
      if (!placeholder) {
        finishOne();
        return;
      }

      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      const placeholderRect = placeholder.getBoundingClientRect();
      const targetLeft = placeholderRect.left + scrollX;
      const targetTop = placeholderRect.top + scrollY;

      card.classList.add('dragging');
      card.classList.remove('card-floating', 'card-zoomed');
      card.style.transition = 'top 0.25s ease-out, left 0.25s ease-out';
      card.style.left = targetLeft + 'px';
      card.style.top = targetTop + 'px';
      card.style.transform = ''; // zoom off 

      const onTransitionEnd = () => {
        card.style.transition = '';
        card.classList.remove('dragging');
        card.style.position = '';
        card.style.left = '';
        card.style.top = '';
        card.style.zIndex = '';

        if (state.parent.contains(placeholder)) {
          state.parent.insertBefore(card, placeholder);
        } else {
          state.parent.appendChild(card);
        }

        if (state.placeholder && state.placeholder.parentNode) {
          state.placeholder.remove();
        }
        state.placeholder = null;

        card.removeEventListener('transitionend', onTransitionEnd);
        finishOne();
      };

      card.addEventListener('transitionend', onTransitionEnd);
    });
  }

  // "beep" sound
  function playResetSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = 880;

      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);

      osc.onended = () => ctx.close();
    } catch (e) {
    }
  }

  function getPoint(event) {
    if (event.touches && event.touches[0]) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    if (event.changedTouches && event.changedTouches[0]) {
      return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
    }
    return { x: event.clientX, y: event.clientY };
  }
})();

// ===== Intro overlay: show once =====
(function () {
  const overlay = document.getElementById('intro-overlay');
  const okBtn = document.getElementById('intro-ok-btn');
  if (!overlay || !okBtn) return;

  // Show 1 time
  const SEEN_KEY = 'cvIntroSeen_v1';
  const alreadySeen = window.localStorage ? localStorage.getItem(SEEN_KEY) : null;

  if (alreadySeen === '1') {
    overlay.style.display = 'none';
    return;
  }

  // Overlay
  overlay.style.display = 'flex';

  okBtn.addEventListener('click', () => {
    overlay.classList.add('intro-overlay-hide');

    setTimeout(() => {
      overlay.style.display = 'none';
    }, 260);

    try {
      if (window.localStorage) {
        localStorage.setItem(SEEN_KEY, '1');
      }
    } catch (e) {
    }
  });
})();