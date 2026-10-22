/* =============================================================================
   NOVA — main.js
   Vanilla JS. Un solo IIFE, sin módulos, sin fetch, sin dependencias.
   Pensado para abrirse con doble clic (protocolo file://).

   Contenido:
     1. Utilidades
     2. Header: estado .is-scrolled (scroll con rAF)
     3. Menú móvil (teclado, click fuera, resize)
     4. Reveal al hacer scroll (IntersectionObserver; la red de seguridad está
        en el <script> del <head> de index.html)
     5. Video de la tarjeta de animación (autoplay sólo si no hay movimiento reducido)
     6. Guardia de desborde horizontal (.is-clipped en <html>)
     7. Filtro del portafolio
     8. Enlace de navegación activo (IntersectionObserver)
     9. Formulario de contacto -> mailto:
     10. Año del pie de página
   ========================================================================== */
(function () {
  'use strict';

  /* ===========================================================================
     1. UTILIDADES
     =========================================================================== */
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  var DESKTOP_BP = 900;   // px — por debajo de esto el nav pasa a menú hamburguesa

  /* ===========================================================================
     2. HEADER — .is-scrolled al pasar de 8px de scroll (throttle con rAF)
     =========================================================================== */
  (function headerScroll() {
    var header = $('#site-header');
    if (!header) { return; }

    var ticking = false;

    function apply() {
      ticking = false;
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    }

    function onScroll() {
      if (ticking) { return; }   // una sola lectura por frame
      ticking = true;
      window.requestAnimationFrame(apply);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    apply(); // por si la página se recarga ya desplazada
  }());

  /* ===========================================================================
     3. MENÚ MÓVIL
     =========================================================================== */
  (function mobileMenu() {
    var toggle = $('#nav-toggle');
    var nav = $('#nav-primary');
    if (!toggle || !nav) { return; }

    function open() {
      nav.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Cerrar menú');
    }

    function close(returnFocus) {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menú');
      if (returnFocus) { toggle.focus(); }
    }

    toggle.addEventListener('click', function () {
      if (nav.classList.contains('is-open')) { close(false); } else { open(); }
    });

    // Click en cualquier enlace del menú lo cierra
    $$('.nav__link, .nav__cta', nav).forEach(function (link) {
      link.addEventListener('click', function () { close(false); });
    });

    // Escape cierra y devuelve el foco al botón
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        close(true);
      }
    });

    // Click fuera del header lo cierra
    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('is-open')) { return; }
      if (nav.contains(e.target) || toggle.contains(e.target)) { return; }
      close(false);
    });

    // Al pasar a escritorio el menú móvil deja de tener sentido
    window.addEventListener('resize', function () {
      if (window.innerWidth > DESKTOP_BP && nav.classList.contains('is-open')) {
        close(false);
      }
    });
  }());

  /* ===========================================================================
     4. REVEAL AL HACER SCROLL
     -------------------------------------------------------------------------
     La red de seguridad (error, promesa rechazada y timeout de 2500 ms) vive en
     el <script> del <head> de index.html, no aquí: ese script lo ejecuta el
     documento, así que sigue funcionando aunque este archivo no llegue a
     cargarse. `window.forceRevealAll` es su punto de entrada; aquí sólo se
     llama. SinIntersectionObserver o con movimiento reducido: todo visible ya.
     =========================================================================== */
  (function reveal() {
    var targets = $$('[data-reveal]');
    if (!targets.length) { return; }

    /* Si el script del <head> no estuviera (no debería pasar), revelamos igual. */
    var revealAll = window.forceRevealAll || function () {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
    };

    function show(el) {
      el.classList.add('is-visible');
      if (el._revealObserver) { el._revealObserver.unobserve(el); }
    }

    // Sin IntersectionObserver, o con movimiento reducido: todo visible ya mismo.
    if (!('IntersectionObserver' in window) || reduceMotion.matches) {
      revealAll();
      return;
    }

    // Red de seguridad extra. La del <head> es la que manda; esta es el cinturón.
    window.setTimeout(revealAll, 2500);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { show(entry.target); }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -8% 0px'
    });

    targets.forEach(function (el) {
      el._revealObserver = io;
      io.observe(el);
    });
  }());

  /* ===========================================================================
     4b. VIDEO DE LA TARJETA DE ANIMACIÓN
     -------------------------------------------------------------------------
     El clip va con muted + playsinline para que el navegador lo deje arrancar
     solo. Si quien visita pidió movimiento reducido, no se reproduce: se queda
     el póster, que es un fotograma real de la animación.
     =========================================================================== */
  (function autoplayMedia() {
    var vids = $$('video[data-autoplay]');
    if (!vids.length || reduceMotion.matches) { return; }

    vids.forEach(function (v) {
      // El <video> ya trae el atributo muted en el HTML; se repite aquí porque
      // algunos navegadores sólo respetan la propiedad cuando se pone al crear.
      v.muted = true;
      var p = v.play();
      if (p && typeof p.catch === 'function') {
        // Autoplay bloqueado (batería, ahorro de datos): el póster se queda.
        p.catch(function () { v.removeAttribute('data-autoplay'); });
      }
    });
  }());

  /* ===========================================================================
     4c. GUARDIA DE DESBORDE HORIZONTAL
     -------------------------------------------------------------------------
     body{overflow-x:hidden} esconde el desbordamiento en vez de resolverlo, y
     eso hace que un fallo pase desapercibido. Aquí se marca <html class=
     "is-clipped"> y se dice en consola qué elemento se está saliendo, para poder
     cazarlo mirando la consola en lugar de a ojo.
     =========================================================================== */
  (function overflowGuard() {
    var doc = document.documentElement;

    function offenders() {
      var limit = doc.clientWidth;
      return $$('body *').filter(function (el) {
        if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') { return false; }
        var r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > limit + 1 || r.left < -1);
      });
    }

    function check() {
      var over = doc.scrollWidth > window.innerWidth + 1;
      doc.classList.toggle('is-clipped', over);
      if (over && window.console && console.warn) {
        var list = offenders();
        console.warn('[Nova] Desborde horizontal. Elementos:',
          list.length ? list.slice(0, 8) : '(sólo el documento)');
      }
    }

    window.addEventListener('resize', check, { passive: true });
    window.addEventListener('load', check);
    check();
  }());

  /* ===========================================================================
     7. FILTRO DEL PORTAFOLIO
     =========================================================================== */
  (function portfolioFilter() {
    var buttons = $$('.filters__btn');
    var cards = $$('.grid-cards .card');
    var status = $('#filtro-status');
    if (!buttons.length || !cards.length) { return; }

    var total = cards.length;

    function apply(filter) {
      var shown = 0;

      cards.forEach(function (card) {
        var match = (filter === 'todos') || (card.getAttribute('data-category') === filter);

        if (match) {
          card.classList.remove('is-hidden');
          // Una tarjeta filtrada nunca debe quedarse invisible por el reveal:
          // se muestra ya, sin esperar al observer.
          card.style.setProperty('--reveal-delay', '0ms');
          card.classList.add('is-visible');
          shown += 1;
        } else {
          card.classList.add('is-hidden');
        }
      });

      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-filter') === filter ? 'true' : 'false');
      });

      if (status) {
        status.textContent = 'Mostrando ' + shown + ' de ' + total + ' proyectos.';
      }
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        apply(btn.getAttribute('data-filter'));
      });
    });
  }());

  /* ===========================================================================
     8. ENLACE DE NAVEGACIÓN ACTIVO
     =========================================================================== */
  (function activeNavLink() {
    var links = $$('.nav__link');
    var sections = links
      .map(function (link) {
        var id = link.getAttribute('href');
        return id && id.charAt(0) === '#' ? document.querySelector(id) : null;
      })
      .filter(Boolean);

    if (!sections.length || !('IntersectionObserver' in window)) { return; }

    function setCurrent(id) {
      links.forEach(function (link) {
        if (link.getAttribute('href') === '#' + id) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    var visible = {};

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible[entry.target.id] = entry.isIntersecting ? entry.intersectionRatio : 0;
      });

      // Gana la sección más visible; si ninguna lo está, la primera del documento.
      var bestId = null;
      var bestRatio = 0;
      Object.keys(visible).forEach(function (id) {
        if (visible[id] > bestRatio) { bestRatio = visible[id]; bestId = id; }
      });

      if (bestId) { setCurrent(bestId); }
    }, {
      threshold: [0, 0.15, 0.35, 0.6, 0.9],
      rootMargin: '-25% 0px -55% 0px'
    });

    sections.forEach(function (s) { io.observe(s); });
  }());

  /* ===========================================================================
     9. FORMULARIO DE CONTACTO -> mailto:
     -------------------------------------------------------------------------
     No hay backend: armamos el enlace y lo navegamos.
     Nunca action="mailto:" — está roto en los navegadores modernos.
     =========================================================================== */
  (function contactForm() {
    var form = $('#contact-form');
    if (!form) { return; }

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var DESTINO = 'carmen_alexandra06@hotmail.com';
    var status = $('#form-status');

    var fields = {
      nombre:    { input: $('#nombre'),    error: $('#error-nombre') },
      correo:    { input: $('#correo'),    error: $('#error-correo') },
      necesidad: { input: $('#necesidad'), error: $('#error-necesidad') },
      mensaje:   { input: $('#mensaje'),   error: $('#error-mensaje') }
    };

    function say(msg) {
      if (status) { status.textContent = msg; }
    }

    function setError(field, message) {
      if (!field.input) { return false; }
      if (message) {
        field.input.setAttribute('aria-invalid', 'true');
        if (field.error) { field.error.textContent = message; }
        return false;
      }
      field.input.removeAttribute('aria-invalid');
      if (field.error) { field.error.textContent = ''; }
      return true;
    }

    // Limpia el error en cuanto el usuario corrige
    Object.keys(fields).forEach(function (key) {
      var input = fields[key].input;
      if (!input) { return; }
      var ev = (input.tagName === 'SELECT') ? 'change' : 'input';
      input.addEventListener(ev, function () {
        if (input.getAttribute('aria-invalid') === 'true') {
          input.removeAttribute('aria-invalid');
          if (fields[key].error) { fields[key].error.textContent = ''; }
        }
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var nombre    = (fields.nombre.input    && fields.nombre.input.value    || '').trim();
      var correo    = (fields.correo.input    && fields.correo.input.value    || '').trim();
      var necesidad = (fields.necesidad.input && fields.necesidad.input.value || '').trim();
      var mensaje   = (fields.mensaje.input   && fields.mensaje.input.value   || '').trim();

      var ok = true;
      var firstBad = null;

      if (!nombre) {
        ok = setError(fields.nombre, 'Escribe tu nombre para saber cómo dirigirme.');
        if (!firstBad) { firstBad = fields.nombre.input; }
      } else {
        setError(fields.nombre, '');
      }

      if (!correo) {
        ok = setError(fields.correo, 'Necesito un correo para poder responderte.');
        if (!firstBad) { firstBad = fields.correo.input; }
      } else if (!EMAIL_RE.test(correo)) {
        setError(fields.correo, 'Revisa el correo: no parece una dirección válida.');
        if (!firstBad) { firstBad = fields.correo.input; }
        ok = false;
      } else {
        setError(fields.correo, '');
      }

      // El selector es opcional: sólo validamos si se eligió algo mal escrito
      if (necesidad === 'Elige una opción') { necesidad = ''; }
      setError(fields.necesidad, '');

      if (!mensaje) {
        ok = setError(fields.mensaje, 'Cuéntame un poco qué tienes en mente.');
        if (!firstBad) { firstBad = fields.mensaje.input; }
      } else {
        setError(fields.mensaje, '');
      }

      if (!ok) {
        say('Revisa los campos marcados para poder continuar.');
        if (firstBad && firstBad.focus) { firstBad.focus(); }
        return;
      }

      var subject = 'Nova — ' + (necesidad || 'Consulta desde el portafolio') +
                    ' — ' + nombre;

      var body =
        'Hola Carmen,\n\n' +
        mensaje + '\n\n' +
        '---\n' +
        'Nombre: ' + nombre + '\n' +
        'Correo: ' + correo + '\n' +
        'Me interesa: ' + (necesidad || 'Aún no lo tengo claro') + '\n';

      say('Abriendo tu aplicación de correo…');

      window.location.href = 'mailto:' + DESTINO +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);

      // Si el navegador no abre ningún cliente de correo, el enlace sigue aquí.
      window.setTimeout(function () {
        say('Si no se abrió tu aplicación de correo, escríbeme directo a ' + DESTINO + '.');
      }, 1200);
    });
  }());

  /* ===========================================================================
     10. AÑO DEL PIE DE PÁGINA
     =========================================================================== */
  (function footerYear() {
    var el = document.getElementById('year');
    if (el) { el.textContent = String(new Date().getFullYear()); }
  }());

}());