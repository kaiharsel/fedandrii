// ===== Масштаб заблоковано =====
// Метатег viewport вимикає pinch-zoom на телефонах; тут добиваються
// десктопні шляхи: Ctrl+колесо, Ctrl +/-/0 та жести трекпада в Safari.
(function () {
  window.addEventListener("wheel", function (e) {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });

  window.addEventListener("keydown", function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (["+", "=", "-", "_", "0"].indexOf(e.key) !== -1) e.preventDefault();
  });

  ["gesturestart", "gesturechange", "gestureend"].forEach(function (type) {
    document.addEventListener(type, function (e) { e.preventDefault(); });
  });
})();

// ===== Єдина точка підписки на прокрутку =====
// Нативна подія scroll на цій сторінці не приходить - прокруткою керує Lenis.
// Тому кожен слухач реєструється тут: його викликає і нативна подія (якщо
// браузер усе ж її кине), і Lenis. Дублювання нешкідливе - усі обробники
// рахують позицію заново.
// ===== ХТО САМЕ ПРОКРУЧУЄТЬСЯ =====
// Так само, як на olhalazarieva.com: там html і body стоять з overflow:hidden,
// а весь вміст гортається всередині окремого контейнера. Сенс не в контейнері
// як такому - сенс у тому, що КОРІНЬ сторінки не прокручується ніколи.
// Мобільний браузер ховає адресний рядок тільки тоді, коли гортається корінь.
// Не гортається корінь - не ховається рядок - висота екрана не міняється -
// і нічого не «дихає» під пальцем.
//
// У нас те саме зроблено на рівень простіше: прокручується сам <body>, а
// overflow:hidden стоїть на <html> (див. блок у style.css). Це дає той самий
// ефект, але не вимагає ні зайвого div у розмітці, ні переписування жодного
// селектора виду "body > .section": діти body лишаються дітьми body.
//
// Умова та сама, що вмикає CSS-блок: лише сенсорні екрани. На ПК гортається
// документ, як і гортався, і Lenis працює як працював.
var MQ_COARSE = window.matchMedia("(hover: none) and (pointer: coarse)");
var COARSE = MQ_COARSE.matches;

// елемент, у якого справді є scrollTop
var SC = COARSE ? document.body : (document.scrollingElement || document.documentElement);

// Той самий медіазапит у CSS браузер перевіряє наново, коли міняється тип
// вказівника: до планшета під'єднали мишу, перемкнули режим пристрою в
// DevTools. Якщо тут лишити значення, пораховане при завантаженні, CSS і
// скрипт розійдуться - сторінка гортатиметься одним елементом, а рахуватись
// буде по іншому.
function applyScroller() {
  COARSE = MQ_COARSE.matches;
  SC = COARSE ? document.body : (document.scrollingElement || document.documentElement);
  lastScrollY = -1;   // позиція міряється від іншого елемента
}
if (MQ_COARSE.addEventListener) { MQ_COARSE.addEventListener("change", applyScroller); }

function sy() { return SC.scrollTop; }

function scrollMax() {
  return COARSE
    ? Math.max(SC.scrollHeight - SC.clientHeight, 0)
    : Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
}

function scrollToY(y, smooth) {
  if (COARSE) {
    if (smooth && SC.scrollTo) { SC.scrollTo({ top: y, behavior: "smooth" }); }
    else { SC.scrollTop = y; }
    return;
  }
  window.scrollTo({ top: y, behavior: smooth ? "smooth" : "auto" });
}

// ===== Стабільна висота екрана =====
// На телефоні window.innerHeight (і рівний йому dvh) міняється щоразу, коли
// ховається чи вилазить адресний рядок - на 60-100px, просто під пальцем.
// Для приколених секцій це отрута: у слогана обгортка заввишки 3.5 екрана,
// тож зсув рядка на 70px стрибком міняв її висоту на 245px, а з нею і всю
// сторінку нижче. Саме це читалось як дьоргання на приколеній секції.
//
// Тому геометрію пінів рахуємо від висоти, яка НЕ реагує на адресний рядок:
// перемірюємо її лише тоді, коли справді змінилась ширина (поворот екрана,
// зміна розміру вікна на ПК).
var stableVH = window.innerHeight;
var stableVW = window.innerWidth;
var stableSubs = [];

function onStableResize(fn) { stableSubs.push(fn); }

window.addEventListener("resize", function () {
  // Ігноруємо зміну самої лише висоти ТІЛЬКИ на сенсорному екрані: там це
  // адресний рядок, а не справжня зміна розміру. На ПК вертикальне
  // перетягування вікна - подія справжня, і піни треба перемірити.
  var coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  if (coarse && window.innerWidth === stableVW) return;
  stableVW = window.innerWidth;
  stableVH = window.innerHeight;
  for (var i = 0; i < stableSubs.length; i++) {
    try { stableSubs[i](); } catch (e) {}
  }
}, { passive: true });

window.addEventListener("orientationchange", function () {
  setTimeout(function () {
    stableVW = window.innerWidth;
    stableVH = window.innerHeight;
    for (var i = 0; i < stableSubs.length; i++) {
      try { stableSubs[i](); } catch (e) {}
    }
  }, 260);
});

var scrollSubs = [];
var lastScrollY = -1;

function onScrollBound(fn) {
  scrollSubs.push(fn);
}

// Джерел прокрутки два - нативна подія і Lenis, - а список підписок один.
// Раніше кожна з них була ще й окремим слухачем window, тож на телефоні,
// де подія scroll справді приходить, усі одинадцять рахувались двічі за
// кадр. Тепер вхід один, і якщо scrollY не змінився - рахувати нічого.
function fireScrollSubs() {
  var y = sy();
  if (y === lastScrollY) return;
  lastScrollY = y;
  for (var i = 0; i < scrollSubs.length; i++) {
    try { scrollSubs[i](); } catch (e) {}
  }
}

document.addEventListener("scroll", fireScrollSubs, { passive: true, capture: true });
// після зміни розміру геометрія інша навіть на тій самій позиції
window.addEventListener("resize", function () { lastScrollY = -1; }, { passive: true });

// ===== Smooth scroll (Lenis) =====
var lenis = null;
(function () {
  if (typeof Lenis === "undefined") return;
  // На телефоні Lenis вимкнений: згладжувати він уміє колесо, дотику не
  // чіпає, а його постійний rAF-цикл і щокадрова подія scroll забирають
  // той самий кадр, у якому вже їде трек, падають букви і горить полумʼя.
  // Усі виклики lenis.scrollTo нижче мають запасний window.scrollTo.
  if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;
  lenis = new Lenis({
    duration: 1.15,
    smoothWheel: true,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Lenis веде прокрутку сам і нативної події scroll на window не лишає:
  // scrollY змінюється, а слухачі мовчать. На цій сторінці від них залежить
  // усе - горизонтальний трек, поява секцій, друкування тексту, паралакс,
  // стрічка робіт. Тому підписки йдуть через onScrollBound, а тут ми просто
  // смикаємо їх напряму. Синтетичну window-подію кидати НЕ можна: Lenis
  // слухає scroll сам, подія поверталась би до нього і стек переповнювався б.
  lenis.on("scroll", fireScrollSubs);

})();

// ===== Lenis: тримати межу прокрутки в актуальному стані =====
// Lenis міряє висоту сторінки при старті й кешує її. Тут розкладка
// змінюється вже після цього: скрипт горизонтального треку виносить
// секції з <main> і вставляє розпірку, вантажиться герой-картинка,
// секція букв отримує 350vh. Кеш лишався старим, межа прокрутки -
// заниженою, і сторінка просто відмовлялася гортатися далі неї.
(function () {
  if (!lenis) return;
  var t = 0;
  function sync() {
    clearTimeout(t);
    t = setTimeout(function () { lenis.resize(); }, 80);
  }
  window.addEventListener("load", sync);
  if (document.fonts) document.fonts.ready.then(sync);
  if ("ResizeObserver" in window) new ResizeObserver(sync).observe(document.body);
  sync();
})();

// ===== Hybrid scroll: horizontal track, then vertical tail (desktop) =====
// The page keeps its native vertical scroll (wheel, touchpad, keyboard and
// Lenis all work untouched). While scrollY is inside the track range the
// fixed <main> is translated sideways, so the site moves left-to-right.
// `data-hscroll` names the last section that rides the track: everything
// after it is moved out and scrolls normally, top to bottom.
var hScroll = { active: false, travel: 0 };

// чи трек уже вмикався в цьому завантаженні (щоб не скидати позицію двічі)
var wasActive = false;
(function () {
  var body = document.body;
  if (!body.hasAttribute("data-hscroll")) return;
  var main = document.querySelector("main");
  var footer = document.querySelector("footer.footer");
  if (!main || !footer) return;

  var lastPanel = document.getElementById(body.getAttribute("data-hscroll"));
  if (!lastPanel || lastPanel.parentElement !== main) return;
  var hero = main.querySelector(".hero");

  // Sections after the split point form the vertical tail, footer included
  var tail = [];
  for (var n = lastPanel.nextElementSibling; n; n = n.nextElementSibling) tail.push(n);
  tail.push(footer);

  // Трек лишається десктопним. Спроба пустити його на телефон була, і на
  // живому пристрої вона дьоргалась: нативну прокрутку веде композитор, а
  // transform треку пише JS з обробника прокрутки - головний потік завжди
  // на кадр позаду, і панель не встигає за пальцем. На ПК цього немає, бо
  // там прокрутку веде Lenis із того самого JS, в одному кадрі з трансформом.
  // На телефоні натомість лишається вертикальне накриття: воно чистий
  // CSS-sticky, тобто теж на композиторі, і плавне безкоштовно.
  var mq = window.matchMedia("(min-width: 1025px)");
  var spacer = document.createElement("div");
  spacer.className = "hspacer";
  spacer.setAttribute("aria-hidden", "true");

  function trackWidth() {
    var last = 0;
    Array.prototype.forEach.call(main.children, function (el) {
      last = Math.max(last, el.offsetLeft + el.offsetWidth);
    });
    return last;
  }

  function measure() {
    hScroll.travel = Math.max(trackWidth() - window.innerWidth, 0);
    spacer.style.height = hScroll.travel + window.innerHeight + "px";
  }

  function apply() {
    // На iOS гумовий відскок робить scrollY від'ємним, на Android - те саме
    // при pull-to-refresh. Без нижньої межі трек від'їжджав би праворуч за
    // початок, і герой на мить від'їжджав з екрана.
    var y = Math.max(sy(), 0);
    var x = Math.min(y, hScroll.travel);
    var lift = Math.max(y - hScroll.travel, 0);
    main.style.transform = "translate3d(" + -x + "px, " + -lift + "px, 0)";
    // The hero cancels the sideways shift, so it holds still under the
    // viewport while the "about" panel rides in from the right and closes
    // over it - the horizontal cousin of the vertical cover effect. The
    // vertical lift is NOT cancelled: past the track the hero leaves with
    // the rest of the page.
    if (hero) hero.style.transform = "translate3d(" + x + "px, 0, 0)";
  }

  function enable() {
    if (hScroll.active) return;
    hScroll.active = true;
    // move the tail out of the track, keeping its order, after a spacer
    main.parentNode.insertBefore(spacer, main.nextSibling);
    var anchor = spacer;
    tail.forEach(function (el) {
      anchor.parentNode.insertBefore(el, anchor.nextSibling);
      anchor = el;
    });
    body.classList.add("hscroll-on");
    // IntersectionObserver geometry is unreliable inside a transformed fixed
    // track, so the panels that stay on it are revealed up front
    main.querySelectorAll(".reveal, .reveal-scale, .split").forEach(function (el) {
      el.classList.add("visible");
    });
    // Скидаємо на початок тільки при холодному старті. Раніше це стояло
    // безумовно: на телефоні поворот екрана або повернення кнопкою «назад»
    // викидали читача на герой посеред сторінки.
    if (!wasActive && sy() === 0) { scrollToY(0, false); }
    wasActive = true;
    measure();
    apply();
  }

  function disable() {
    if (!hScroll.active) return;
    hScroll.active = false;
    body.classList.remove("hscroll-on");
    main.style.transform = "";
    if (hero) hero.style.transform = "";
    // restore the original document order
    tail.forEach(function (el) {
      if (el === footer) { body.appendChild(el); } else { main.appendChild(el); }
    });
    if (spacer.parentNode) spacer.parentNode.removeChild(spacer);
  }
  // ---- Full-screen sections (layout only: scrolling stays smooth) ----
  var fullMQ = window.matchMedia("(min-width: 1025px) and (min-height: 700px)");
  var fullOn = false;

  function enableFull() {
    if (fullOn || !hScroll.active) return;
    fullOn = true;
    body.classList.add("snap-on");
    measure();                  // section heights change with the class
  }

  function disableFull() {
    if (!fullOn) return;
    fullOn = false;
    body.classList.remove("snap-on");
    measure();
  }

  function syncSnap() {
    if (hScroll.active && fullMQ.matches) { enableFull(); } else { disableFull(); }
  }
  function sync() {
    if (mq.matches) { enable(); } else { disable(); }
    syncSnap();
  }

  sync();
  if (mq.addEventListener) mq.addEventListener("change", sync);
  if (fullMQ.addEventListener) fullMQ.addEventListener("change", sync);

  // Пишемо transform прямо з обробника, без rAF-тротлінгу: Lenis і так
  // смикає підписки раз на кадр, а зайвий кадр затримки тут відчувався б
  // як відставання треку від пальця.
  onScrollBound(function () {
    if (hScroll.active) apply();
  }, { passive: true });

  window.addEventListener("resize", function () {
    sync();
    if (hScroll.active) { measure(); apply(); }
  });

  // fonts and images settle after load: remeasure the track
  window.addEventListener("load", function () {
    if (hScroll.active) { measure(); apply(); }
  });
})();

// ===== First screen: one gesture = one screen, then free =====
// Поки сторінка стоїть на самому верху, рух униз (колесо, свайп,
// стрілка) не гортає потроху, а одним проїздом довозить до наступної
// секції. Далі снап знімається і решта сторінки гортається як завжди.
// Повернення на верх заряджає його знову.
var firstSnap = { armed: true, running: false };
(function () {
  var body = document.body;
  var html = document.documentElement;
  if (!body.hasAttribute("data-hscroll")) return;
  var main = document.querySelector("main");
  var hero = main && main.querySelector(".hero");
  var next = document.getElementById(body.getAttribute("data-hscroll"));
  if (!hero || !next) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // Лише там, де є горизонтальний трек (від 1025px). На телефоні й планшеті
  // сторінка вертикальна, і "залипання" першого екрана з різким проїздом
  // там сприймалося як поломка прокрутки, а не як прийом.
  if (window.matchMedia("(max-width: 1024px)").matches) return;

  var TOP = 6;         // px: скільки ще вважається "на першому екрані"
  var SWIPE = 26;      // px: мінімальний свайп пальцем
  var DURATION = 1.2;  // с: тривалість проїзду
  var DOWN_KEYS = ["ArrowDown", "PageDown", " ", "Spacebar"];
  var SCROLL_KEYS = DOWN_KEYS.concat(["ArrowUp", "PageUp", "Home", "End"]);
  var heroFits = true;
  var guard = 0;
  var touchY = null;
  var touchArmed = false;

  function measure() {
    // Якщо герой сам по собі вищий за екран, до наступної секції більше
    // ніж один екран: стрибок з'їв би контент, тож снап не вмикаємо.
    heroFits = hero.offsetHeight <= window.innerHeight + 8;
  }

  function ready() {
    return firstSnap.armed && !firstSnap.running &&
      (hScroll.active || heroFits) && sy() <= TOP;
  }

  // Поки снап заряджений або їде, палець не гортає сторінку сам: жест
  // цілком віддається снапу (правило touch-action у style.css).
  function gate() {
    html.classList.toggle("snap-armed", ready() || firstSnap.running);
  }

  function done() {
    clearTimeout(guard);
    firstSnap.running = false;
    firstSnap.armed = false;
    // Страховка від застряглого замка Lenis: якщо його поставив хтось
    // інший і не зняв, колесо глухе до перезавантаження. Сеттер публічний.
    if (lenis && lenis.isLocked) lenis.isLocked = false;
    gate();
  }

  function snap() {
    if (firstSnap.running || !firstSnap.armed) return false;
    // На горизонтальному треку панель адресується зсувом по X
    // (скрол сторінки = зсув треку), інакше - звичайним offsetTop.
    var y = hScroll.active ? next.offsetLeft : next.offsetTop;
    if (y <= sy() + 1) return false;
    firstSnap.running = true;
    gate();
    // Без lock: true. Замок Lenis знімається лише в onComplete, а якщо проїзд
    // перебити (клік по логотипу чи меню під час снапу), новий scrollTo
    // підміняє анімацію, onComplete не приходить - і замок лишається назавжди:
    // колесо глухе, індикатор стоїть. Від зайвого вводу під час проїзду
    // і так захищають обробники wheel/touch/keydown вище.
    if (lenis) {
      lenis.scrollTo(y, { duration: DURATION, force: true, onComplete: done });
    } else {
      scrollToY(y, true);
    }
    // Страховка: якщо onComplete не прийде, снап однаково відпускає
    // сторінку, а не лишає її замкненою.
    guard = setTimeout(done, DURATION * 1000 + 400);
    return true;
  }

  function editable(t) {
    return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  // Жест ловиться у фазі захоплення - раніше за Lenis. Поки проїзд іде,
  // вхід глушиться тут же, інакше наступний рух колеса перехопив би
  // кермо в Lenis і зупинив би сторінку на півдорозі.
  window.addEventListener("wheel", function (e) {
    if (e.ctrlKey) return;
    if (firstSnap.running) { e.preventDefault(); e.stopPropagation(); return; }
    if (!ready() || e.deltaY + e.deltaX <= 0) return;
    if (snap()) { e.preventDefault(); e.stopPropagation(); }
  }, { passive: false, capture: true });

  window.addEventListener("touchstart", function (e) {
    touchArmed = ready() && e.touches.length === 1;
    touchY = touchArmed ? e.touches[0].clientY : null;
  }, { passive: true, capture: true });

  window.addEventListener("touchmove", function (e) {
    if (firstSnap.running) {
      if (e.cancelable) { e.preventDefault(); e.stopPropagation(); }
      return;
    }
    if (!touchArmed || touchY === null) return;
    if (touchY - e.touches[0].clientY < SWIPE) return;
    touchArmed = false;
    touchY = null;
    if (snap() && e.cancelable) { e.preventDefault(); e.stopPropagation(); }
  }, { passive: false, capture: true });

  window.addEventListener("touchend", function () {
    touchArmed = false;
    touchY = null;
  }, { passive: true, capture: true });

  window.addEventListener("keydown", function (e) {
    if (SCROLL_KEYS.indexOf(e.key) === -1 || editable(e.target)) return;
    if (firstSnap.running) { e.preventDefault(); return; }
    if (DOWN_KEYS.indexOf(e.key) === -1 || !ready()) return;
    if (snap()) e.preventDefault();
  }, { capture: true });

  // Повернулись на самий верх - снап знову заряджений
  onScrollBound(function () {
    if (!firstSnap.running && sy() <= TOP) firstSnap.armed = true;
    gate();
  }, { passive: true });

  window.addEventListener("resize", function () { measure(); gate(); });
  window.addEventListener("load", function () { measure(); gate(); });
  measure();
  gate();
})();

// Anchor links work with Lenis
document.querySelectorAll('a[href^="#"]').forEach(function (link) {
  link.addEventListener("click", function (e) {
    var id = link.getAttribute("href");

    // Логотип веде href="#" - це не якір, а «на початок». Раніше браузер
    // просто стрибав туди без нічого; тепер шлях той самий, що й у переходів
    // між секціями: під шторкою, з тією ж тривалістю.
    if (id === "#") {
      e.preventDefault();
      var toTop = function (instant) {
        if (lenis) { lenis.scrollTo(0, { force: true, immediate: instant }); }
        else { scrollToY(0, !instant); }
      };
      if (window.pageVeil && window.pageVeil.cover(function () { toTop(true); })) return;
      toTop(false);
      return;
    }

    if (id.length < 2) return;
    var target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();

    // Panels inside the horizontal track are addressed by their X offset,
    // the sections after it by their document top.
    function goTo(instant) {
      // Панелі на горизонтальному треку адресуються своїм зсувом по X
      var panel = hScroll.active ? target.closest("main > *") : null;
      if (panel) {
        if (lenis) { lenis.scrollTo(panel.offsetLeft, { force: true, immediate: instant }); }
        else { scrollToY(panel.offsetLeft, !instant); }
        return;
      }

      // «Послуги» і «Портфоліо» - липкі секції всередині обгорток-пінів.
      // Поточна позиція такої секції - це не початок, а те місце, де вона
      // зараз застигла, тож стрибок по ній кидав у середину або зовсім повз.
      // Ціль - верх обгортки: саме звідти секція починає приколюватись.
      var pin = target.closest(".works-pin, .services-pin, .statement-pin");
      var box = pin || target;
      // піни починаються рівно під шапкою, звичайні секції треба відсунути
      var y = box.getBoundingClientRect().top + sy() - (pin ? 0 : 70);
      if (y < 0) y = 0;

      if (lenis) { lenis.scrollTo(y, { force: true, immediate: instant }); }
      else { scrollToY(y, !instant); }
    }

    // Перехід між секціями грає ту саму шторку, що й перехід між сторінками:
    // стрибок відбувається під нею, тому він миттєвий. Якщо шторки немає
    // (увімкнено "менше руху") - лишається звичайна плавна прокрутка.
    if (window.pageVeil && window.pageVeil.cover(function () { goTo(true); })) return;
    goTo(false);
  });
});

// ===== Page veil: transitions between pages =====
// One fixed sheet plays both halves of the trip. A click on an internal
// link slides it up from the bottom, closing the old page; a sessionStorage
// flag tells the next page it was reached from inside the site, so it loads
// already covered and sends the sheet on upward, unveiling itself. Browser
// back/forward out of bfcache resets the sheet so the page is never stuck
// behind it.
(function () {
  var FLAG = "fa-veil";
  var cameFromSite = false;
  try {
    cameFromSite = sessionStorage.getItem(FLAG) === "1";
    sessionStorage.removeItem(FLAG);
  } catch (err) { /* storage blocked: every load is a cold one */ }

  // Кнопка «назад» прапорця не лишає: кліку по посиланню не було. Але це
  // такий самий перехід усередині сайту, і без шторки він виглядав різко:
  // головна зʼявлялась сирою, а вже потім під нею оживали фізика, полумʼя
  // і решта модулів - звідси і блимання, і смикання. Тепер повернення
  // накривається так само, як звичайний перехід, і сторінка встигає
  // зібратись під шторкою.
  if (!cameFromSite) {
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      if (nav && nav.type === "back_forward") cameFromSite = true;
      // старіші браузери: 2 - це саме back/forward
      else if (!nav && performance.navigation && performance.navigation.type === 2) cameFromSite = true;
    } catch (err) { /* немає Navigation Timing: лишається як було */ }
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var veil = document.createElement("div");
  veil.className = "page-veil";
  veil.setAttribute("aria-hidden", "true");
  document.body.appendChild(veil);

  // Arrival half: start covered, then continue the sheet upward. The
  // cleanup timer starts only once the reveal actually begins, so a tab
  // loaded in the background (rAF paused) just stays covered until shown.
  if (cameFromSite) {
    document.body.classList.add("veil-arrived");
    veil.classList.add("is-covering");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        veil.classList.add("is-leaving");
        // timer instead of transitionend: it fires even under load
        setTimeout(function () {
          veil.classList.remove("is-covering", "is-leaving");
        }, 950);
      });
    });
  }

  // Та сама шторка для переходів між секціями: накриває екран, під нею
  // сторінка миттєво стрибає на потрібну секцію, і шторка йде вгору.
  // Повертає false, якщо перехід уже грає - тоді клік просто ігнорується.
  var busy = false;
  var guard = 0;

  function clear() {
    clearTimeout(guard);
    veil.classList.remove("is-closing", "is-covering", "is-leaving");
    busy = false;
  }

  window.pageVeil = {
    cover: function (jump) {
      if (busy) return false;
      busy = true;
      veil.classList.add("is-closing");
      // страховка: навіть якщо щось піде не так, екран не лишиться чорним
      guard = setTimeout(clear, 2400);
      setTimeout(function () {
        try { jump(); } catch (err) { /* стрибок не вдався - шторку однаково знімаємо */ }
        veil.classList.remove("is-closing");
        veil.classList.add("is-covering");
        // таймер, а не rAF: у фоновій вкладці кадри можуть не приходити,
        // і шторка лишалася б опущеною
        setTimeout(function () {
          veil.classList.add("is-leaving");
          setTimeout(clear, 900);
        }, 40);
      }, 560);
      return true;
    }
  };

  // Departure half: internal links close the sheet, then navigate
  var navigating = false;
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!link) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;
    var url;
    try { url = new URL(link.href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin) return;
    // same-page anchors keep their smooth scroll
    if (url.pathname === location.pathname && url.hash) return;
    e.preventDefault();
    if (navigating) return;
    navigating = true;
    try { sessionStorage.setItem(FLAG, "1"); } catch (err) {}
    veil.classList.add("is-closing");
    // navigate just as the sheet lands: the load happens behind it
    setTimeout(function () { location.href = url.href; }, 560);
  });

  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    navigating = false;
    veil.classList.remove("is-closing", "is-covering", "is-leaving");
  });
})();

// ===== Preloader with percentage counter =====
(function () {
  var preloader = document.getElementById("preloader");
  var count = document.getElementById("preloaderCount");
  if (!preloader || !count) return;

  // The counter plays once per visit, on whichever page is opened first.
  // That first page sets a session flag; every later load in the visit
  // (html.warm from the inline head script, or an arrival through the
  // page veil) skips straight to the content.
  if (document.documentElement.classList.contains("warm") ||
      document.body.classList.contains("veil-arrived")) {
    preloader.style.display = "none";
    return;
  }
  try { sessionStorage.setItem("fa-seen", "1"); } catch (err) {}

  // Лічильник іде неспішно і під кінець ще пригальмовує: до 85% кроки
  // великі, далі дрібні - остання ділянка тягнеться, як у справжньому
  // завантаженні. Крок 70мс: разом близько 2.0 с. Було 95мс і 2.7 с -
  // відчутно довго для повторного гостя, але й миттєвим робити не варто,
  // інакше зникає сам ефект завантаження.
  var value = 0;
  var timer = setInterval(function () {
    value += value < 85
      ? Math.floor(Math.random() * 6) + 2
      : Math.floor(Math.random() * 4) + 1;
    if (value >= 100) {
      value = 100;
      clearInterval(timer);
      setTimeout(function () {
        preloader.classList.add("done");
        // Вступна поява кнопки й підказки прокрутки чекала на фіксованій
        // затримці й при довшому прелоадері встигала відіграти під ним.
        // Тепер вона стартує звідси - рівно коли завіса починає танути.
        document.documentElement.classList.add("intro-ready");
      }, 280);
    }
    count.textContent = value + "%";
  }, 70);
})();

// ===== Header: background on scroll (never hides) =====
(function () {
  var header = document.getElementById("header");
  if (!header) return;

  function onScroll() {
    header.classList.toggle("scrolled", sy() > 40);
  }
  onScrollBound(onScroll);
  onScroll();
})();


// Клік по логотипу веде нагору через ту саму шторку, що й переходи між
// секціями - це робить обробник якорів вище (гілка id === "#"). Окремий
// модуль, який просто плавно прокручував угору, звідси прибрано: він
// запускав свою прокрутку паралельно зі стрибком під шторкою.

// ===== Mobile menu =====
(function () {
  var burger = document.getElementById("burger");
  var nav = document.getElementById("nav");
  var header = document.getElementById("header");
  if (!burger || !nav) return;

  var lockedY = 0;

  function setMenu(open) {
    nav.classList.toggle("open", open);
    burger.classList.toggle("open", open);
    // Самого body{overflow:hidden} на iOS замало - свайп протікає, а з
    // фіксованим <main> це крутить трек за непрозорою шторою. Тому ще й
    // запамʼятовуємо позицію і повертаємо її при закритті.
    if (open) { lockedY = sy(); }
    document.documentElement.style.overflow = open ? "hidden" : "";
    document.body.style.overflow = open ? "hidden" : "";
    if (!open && lockedY) { scrollToY(lockedY, false); }
    if (header) {
      header.classList.toggle("menu-open", open);
    }
    if (lenis) {
      // In snap mode Lenis stays stopped: the snap engine drives scrolling.
      // Restarting it here would let the wheel scroll freely again.
      if (open) { lenis.stop(); }
      else { lenis.start(); }
    }
  }

  burger.addEventListener("click", function () {
    setMenu(!nav.classList.contains("open"));
  });

  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      setMenu(false);
    });
  });

  // If the viewport grows past the burger breakpoint, reset the menu state
  var mq = window.matchMedia("(min-width: 1025px)");
  if (mq.addEventListener) {
    mq.addEventListener("change", function (e) {
      if (e.matches) setMenu(false);
    });
  }
})();

// ===== Split headings into words for staggered animation =====
(function () {
  document.querySelectorAll(".split").forEach(function (el) {
    wrapWords(el);
    var words = el.querySelectorAll(".word > i");
    words.forEach(function (w, i) {
      w.style.transitionDelay = i * 0.045 + "s";
    });
  });

  function wrapWords(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (child) {
      if (child.nodeType === 3) {
        var frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(" "));
          } else {
            var word = document.createElement("span");
            word.className = "word";
            var inner = document.createElement("i");
            inner.textContent = part;
            word.appendChild(inner);
            frag.appendChild(word);
          }
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1) {
        wrapWords(child);
      }
    });
  }
})();

// ===== Typewriter effect for section headings =====
(function () {
  var all = document.querySelectorAll(".typewrite");
  if (!all.length) return;

  // Headings pinned inside the horizontal track keep their text: the
  // IntersectionObserver that drives the typing cannot be trusted there.
  var els = Array.prototype.filter.call(all, function (el) {
    return !(hScroll.active && el.closest("main"));
  });
  if (!els.length) return;

  els.forEach(function (el) {
    el.setAttribute("data-tw", el.textContent.trim());
    el.textContent = "";
  });

  if (!("IntersectionObserver" in window)) {
    els.forEach(function (el) {
      el.textContent = el.getAttribute("data-tw");
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        type(entry.target);
      });
    },
    { threshold: 0.2 }
  );

  els.forEach(function (el) { observer.observe(el); });

  function type(el) {
    var text = el.getAttribute("data-tw");
    var i = 0;
    el.classList.add("typing");
    var timer = setInterval(function () {
      i++;
      el.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(timer);
        setTimeout(function () {
          el.classList.remove("typing");
        }, 1600);
      }
    }, 70);
  }
})();

// ===== Reveal on scroll =====
(function () {
  var items = document.querySelectorAll(".reveal, .reveal-scale, .split");
  if (!("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("visible"); });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    // Поріг 0: блок проявляється, щойно його край перетнув лінію за 40px від
    // низу екрана. З порогом 0.12 великі картки портфоліо (~700px) мусили
    // зайти в кадр на ~120px, і секція стояла порожньою ще сотні пікселів
    // прокрутки, а потім обидві картки ряду вискакували разом.
    { threshold: 0, rootMargin: "0px 0px -40px 0px" }
  );

  items.forEach(function (el) { observer.observe(el); });
})();

// ===== Animated number counters =====
(function () {
  var counters = document.querySelectorAll("[data-count]");
  if (!counters.length || !("IntersectionObserver" in window)) return;

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        animate(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach(function (el) { observer.observe(el); });

  function animate(el) {
    var target = parseInt(el.getAttribute("data-count"), 10) || 0;
    var suffix = el.getAttribute("data-suffix") || "";
    var start = null;
    var duration = 1400;

    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
})();

// ===== Parallax on work visuals =====
(function () {
  var visuals = document.querySelectorAll("[data-parallax] .mock");
  if (!visuals.length) return;

  var ticking = false;
  function update() {
    ticking = false;
    var vh = window.innerHeight;
    visuals.forEach(function (el) {
      var rect = el.parentElement.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh) return;
      var center = rect.top + rect.height / 2;
      var offset = ((center - vh / 2) / vh) * -26;
      el.style.setProperty("--py", offset.toFixed(1) + "px");
    });
  }

  // Через спільну воронку, а не власним слухачем на window: коли гортається
  // body (телефон), подія до window не спливає, і модуль мовчав би.
  onScrollBound(function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  });
  update();
})();

// ===== Live local time =====
// Годинників на сторінці два - у футері й у бургер-меню, - тож вибірка
// йде за позначкою data-localtime, а не за id: id мусить бути унікальним,
// і другий годинник із ним просто не оновлювався б.
(function () {
  var els = document.querySelectorAll("[data-localtime]");
  if (!els.length) return;

  function update() {
    var now = new Date();
    var h = String(now.getHours()).padStart(2, "0");
    var m = String(now.getMinutes()).padStart(2, "0");
    var t = h + ":" + m;
    for (var i = 0; i < els.length; i++) els[i].textContent = t;
  }
  update();
  setInterval(update, 30000);
})();

// ===== Scroll progress bar =====
(function () {
  var widget = document.getElementById("scrollKey");
  if (!widget) return;

  // Без затвора через requestAnimationFrame: якщо кадр не приходить
  // (вкладка у фоні, замерзлий рендер), прапорець "ticking" лишався
  // піднятим і індикатор більше не оновлювався. Одна CSS-змінна на
  // подію прокрутки коштує нічого - пишемо одразу.
  // Довжину сторінки міряємо НЕ на кожну подію прокрутки: scrollHeight
  // змушує браузер перерахувати розкладку, а поруч у тій самій черзі
  // одинадцять інших обробників уже щось пишуть у стилі. Читання після
  // запису - це примусовий синхронний перерахунок щокадру, і саме від
  // нього смуга смикалась. Тепер міряємо лише тоді, коли сторінка
  // справді змінює висоту.
  var max = 0;

  function update() {
    var p = max > 0 ? Math.min(Math.max(sy() / max, 0), 1) : 0;
    widget.style.setProperty("--sp", p.toFixed(4));
  }

  function measure() {
    max = scrollMax();
    update();
  }

  onScrollBound(update);
  window.addEventListener("resize", measure);
  window.addEventListener("load", measure);
  // Висота росте не лише від зміни вікна: піни рахуються скриптом, шрифти
  // приїжджають пізніше, картинки розкриваються. Спостерігач ловить це все,
  // а зациклитись не може - --sp міняє тільки трансформ, не розкладку.
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(measure);
    ro.observe(document.documentElement);
    if (document.body) ro.observe(document.body);
  }
  measure();
})();

// ===== Шапка: підсвітити пункт секції, на якій зараз стоїш =====
// Одна логіка на обидва режими прокрутки. У горизонтальному треку <main>
// зафіксований і зсунутий трансформом, тож offsetTop там бреше -
// getBoundingClientRect() трансформ враховує. Тому міряємо саме видиму
// площу секції на екрані й підсвічуємо ту, якої видно найбільше; поки
// жодна не набрала чверті екрана (герой, футер), не світиться нічого.
(function () {
  var nav = document.getElementById("nav");
  if (!nav) return;

  var links = [];
  var targets = [];
  Array.prototype.forEach.call(nav.querySelectorAll(".nav__link"), function (l) {
    // на сторінках кейсів пункти ведуть на index.html#..., там підсвічувати нічого
    var href = l.getAttribute("href") || "";
    if (href.charAt(0) !== "#" || href.length < 2) return;
    var t = document.querySelector(href);
    if (!t) return;
    links.push(l);
    targets.push(t);
  });
  if (!links.length) return;

  var current = -2;

  function update() {
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var best = -1;
    var bestArea = vw * vh * 0.25;   // менше чверті екрана - секція ще не «твоя»

    for (var i = 0; i < targets.length; i++) {
      var r = targets[i].getBoundingClientRect();
      var w = Math.min(r.right, vw) - Math.max(r.left, 0);
      var h = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (w <= 0 || h <= 0) continue;
      var area = w * h;
      if (area >= bestArea) { bestArea = area; best = i; }
    }

    if (best === current) return;
    current = best;
    for (var j = 0; j < links.length; j++) {
      var on = j === best;
      links[j].classList.toggle("is-active", on);
      if (on) { links[j].setAttribute("aria-current", "true"); }
      else { links[j].removeAttribute("aria-current"); }
    }
  }

  // Без тротлінгу через rAF: три getBoundingClientRect на подію - дешевше,
  // ніж зайвий прапорець, а Lenis і так смикає підписки раз на кадр.
  onScrollBound(update);
  window.addEventListener("resize", update);
  window.addEventListener("load", update);
  update();
})();

// ===== Case pages: highlight the current section in the page navigation =====
(function () {
  var toc = document.querySelector(".toc");
  if (!toc) return;

  var links = Array.prototype.slice.call(toc.querySelectorAll(".toc__item"));
  var targets = links.map(function (l) { return document.querySelector(l.getAttribute("href")); });
  var footer = document.querySelector("footer.footer");

  // Висоту смуги міряємо один раз, а не щокадру: вона змінюється хіба що
  // разом з розміром вікна.
  var tocH = 0;
  function measureToc() { tocH = toc.offsetHeight; }

  function update() {
    // the current section is the last one whose top has passed under the header
    var mark = sy() + 140;
    var active = 0;
    targets.forEach(function (t, i) { if (t && t.offsetTop <= mark) active = i; });
    links.forEach(function (l, i) { l.classList.toggle("is-active", i === active); });

    // Дійшли до футера - смуга йде геть. Поріг рахуємо від самої смуги, а
    // не від частки екрана: вона висить по центру, тож ховати її треба тоді,
    // коли футер підіймається до її нижнього краю.
    //
    // Було "верх футера вище 30% екрана", і це не спрацьовувало взагалі: при
    // вікні 900px поріг виходив 270px, а футер заввишки 523px навіть у самому
    // низу сторінки має верх на 378px, тож смуга висіла поверх футера до кінця.
    if (footer) {
      var ft = footer.getBoundingClientRect().top;
      var поріг = window.innerHeight / 2 + tocH / 2 + 40;
      toc.classList.toggle("is-gone", ft <= поріг);
    }
  }

  var ticking = false;
  onScrollBound(function () {
    if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); }
  }, { passive: true });
  window.addEventListener("resize", function () { measureToc(); update(); });
  window.addEventListener("load", function () { measureToc(); update(); });
  measureToc();
  update();
})();



// ===== Pricing: pick a service, its receipt prints on the right =====
(function () {
  var root = document.querySelector(".price");
  if (!root) return;

  var opts = Array.prototype.slice.call(root.querySelectorAll(".price__opt"));
  var panels = Array.prototype.slice.call(root.querySelectorAll(".receipt--panel"));
  if (!opts.length || !panels.length) return;

  function select(id) {
    opts.forEach(function (o) {
      var on = o.getAttribute("data-price") === id;
      o.classList.toggle("is-active", on);
      o.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach(function (p) {
      p.classList.toggle("is-active", p.getAttribute("data-panel") === id);
    });
  }

  opts.forEach(function (o, i) {
    o.addEventListener("click", function () { select(o.getAttribute("data-price")); });
    o.addEventListener("keydown", function (e) {
      var next = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
      if (!next) return;
      e.preventDefault();
      var t = opts[(i + next + opts.length) % opts.length];
      t.focus();
      select(t.getAttribute("data-price"));
    });
  });
})();

// ===== Services: a preview card that follows the cursor =====
// Кожен рядок показує свій візуал. Щоб поставити справжнє фото - додати
// data-shot="img/name.jpg" до потрібного <li class="skills__row">.
(function () {
  var rows = document.querySelectorAll("#services .skills__row");
  if (!rows.length) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  // Кожен рядок показує знак інструмента, яким ця послуга робиться.
  // Знаки ті самі, що в смужці під списком, тож картка під курсором і
  // смужка внизу говорять однією мовою.
  var МАРКИ = {
    figma: '<svg class="tool-mark" viewBox="0 0 16 24" aria-hidden="true"><path d="M8 0H4a4 4 0 0 0 0 8h4V0z"/><path d="M8 0h4a4 4 0 0 1 0 8H8V0z"/><path d="M8 8H4a4 4 0 0 0 0 8h4V8z"/><path d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"/><path d="M8 20a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"/></svg>',
    framer: '<svg class="tool-mark" viewBox="0 0 16 24" aria-hidden="true"><path d="M0 0h16v8H8zM0 8h8l8 8H0zM0 16h8v8z"/></svg>',
    webflow: '<svg class="tool-mark tool-mark--wide" viewBox="0 4.515 24 14.97" aria-hidden="true"><path d="m24 4.515-7.658 14.97H9.149l3.205-6.204h-.144C9.566 16.713 5.621 18.973 0 19.485v-6.118s3.596-.213 5.71-2.435H0V4.515h6.417v5.278l.144-.001 2.622-5.277h4.854v5.244h.144l2.72-5.244H24Z"/></svg>',
    shopify: '<svg class="tool-mark tool-mark--round" viewBox="1.4 0 21.2 24" aria-hidden="true"><path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z"/></svg>',
    wordpress: '<svg class="tool-mark tool-mark--round" viewBox="0 0 24 24" aria-hidden="true"><path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0"/></svg>',
    code: '<svg class="tool-mark tool-mark--code" viewBox="1.4 2.5 21.2 19" aria-hidden="true"><path d="M8.5 6.5 2.5 12l6 5.5"/><path d="M15.5 6.5l6 5.5-6 5.5"/><path d="M13.6 3.6 10.4 20.4"/></svg>',
    telegram: '<svg class="tool-mark tool-mark--tg" viewBox="3 4.44 18.02 15.12" aria-hidden="true"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>'
  };

  // Колонки за кількістю знаків, щоб коробка виходила близькою до квадрата:
  // один знак - один стовпчик, два - два, до чотирьох - два, більше - три.
  function картка(ids) {
    var cols = ids.length <= 2 ? ids.length : (ids.length <= 4 ? 2 : 3);
    return '<div class="tool-shot" style="--cols:' + cols + '">' +
      ids.map(function (id) { return МАРКИ[id]; }).join('') + '</div>';
  }

  // Набори інструментів за рядками, строго в порядку розмітки. З одного й
  // того самого списку будується і картка під курсором, і підсвічування у
  // смужці під списком - інакше вони рано чи пізно розʼїхались би.
  var НАБОРИ = [
    ['figma'],                                                      // UI/UX-дизайн
    ['framer', 'webflow', 'shopify', 'wordpress', 'code'],          // Сайти під ключ
    ['code'],                                                       // Фронтенд і бекенд
    ['telegram', 'code'],                                           // Telegram-боти
    // підхоплюю будь-що з того, чим працюю, тож тут увесь набір
    ['figma', 'framer', 'webflow', 'shopify', 'wordpress', 'code']  // Доопрацювання
  ];

  var SHOTS = НАБОРИ.map(function (ids) { return картка(ids); });

  // Смужка під списком підсвічує ті самі інструменти. Telegram у ній немає,
  // тож на його рядку засвітиться лише знак коду - і це чесно.
  var плитки = document.querySelectorAll(".tools__item[data-tool]");

  function підсвітити(ids) {
    Array.prototype.forEach.call(плитки, function (плитка) {
      var свій = !!ids && ids.indexOf(плитка.getAttribute("data-tool")) !== -1;
      плитка.classList.toggle("is-lit", свій);
    });
  }

  var card = document.createElement("div");
  card.className = "cursor-card";
  card.setAttribute("aria-hidden", "true");
  document.body.appendChild(card);

  var half = { w: 0, h: 0 };
  var current = null;                 // the row whose visual is loaded
  var pointer = { x: 0, y: 0, seen: false };

  function place() {
    if (!half.w) {
      // layout size, not the rect: the hidden card is scaled down by CSS
      half.w = card.offsetWidth / 2;
      half.h = card.offsetHeight / 2;
    }
    // keep the card inside the viewport, a little ahead of the cursor
    var x = Math.min(Math.max(pointer.x + 26 + half.w, half.w + 8), window.innerWidth - half.w - 8);
    var y = Math.min(Math.max(pointer.y, half.h + 8), window.innerHeight - half.h - 8);
    card.style.setProperty("--x", x + "px");
    card.style.setProperty("--y", y + "px");
  }

  function show(row) {
    if (row !== current) {           // only redraw when the row really changes
      var i = Array.prototype.indexOf.call(rows, row);
      var photo = row.getAttribute("data-shot");
      card.innerHTML = photo ? '<img src="' + photo + '" alt="">' : (SHOTS[i] || SHOTS[0]);
      підсвітити(НАБОРИ[i]);
      current = row;
      half.w = 0;                    // remeasure: content changes the size
    }
    place();
    card.classList.add("is-on");
  }

  function hide() {
    current = null;
    card.classList.remove("is-on");
    підсвітити(null);
  }

  // What is under the cursor right now? Used after the page moves beneath it.
  function refresh() {
    if (!pointer.seen) return;
    var el = document.elementFromPoint(pointer.x, pointer.y);
    var row = el && el.closest ? el.closest("#services .skills__row") : null;
    if (row) { show(row); } else { hide(); }
  }

  document.addEventListener("pointermove", function (e) {
    if (e.pointerType && e.pointerType !== "mouse") return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.seen = true;
    if (card.classList.contains("is-on")) place();
  }, { passive: true });

  Array.prototype.forEach.call(rows, function (row) {
    row.addEventListener("pointerenter", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.seen = true;
      show(row);
    });

    row.addEventListener("pointerleave", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      hide();
    });
  });

  // Scrolling moves the page under a still cursor: re-check what it points at
  // instead of blindly hiding the card, which used to leave it stuck away.
  onScrollBound(refresh);

  window.addEventListener("blur", hide);
  document.addEventListener("mouseleave", hide);
})();

// ===== Artwork drawn in code =====
// The site ships no photo files: every visual is a small SVG plate generated
// here. No downloads, no licensing, nothing to break if an image 404s.
// Add one anywhere with <figure class="art" data-art="terrain"></figure>.
(function () {
  var nodes = document.querySelectorAll("[data-art]");
  if (!nodes.length) return;

  var NS = "http://www.w3.org/2000/svg";
  var INK = "rgba(240,238,232,";
  var BGC = (getComputedStyle(document.documentElement)
    .getPropertyValue("--bg") || "").trim() || "#0a0a0a";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  // --- Terrain: rows of ridges, each filled with the page colour so it hides
  //     the rows behind it. That occlusion is what makes it read as depth.
  //     Drawn on a canvas: rewriting two dozen SVG path strings into the DOM
  //     every frame is what made this stutter.
  function terrain(host) {
    var canvas = document.createElement("canvas");
    canvas.className = "art__canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    var ctx = canvas.getContext("2d");
    var ROWS = 22, STEPS = 44;
    var xs = new Float32Array(STEPS + 1), ys = new Float32Array(STEPS + 1);
    var w = 0, h = 0, dirty = true;

    // The waves are smooth, so a reduced backing store scaled up by CSS looks
    // identical and costs a third of the pixels.
    var SCALE = 0.6;

    function measure() {
      var r = host.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      w = canvas.width = Math.max(1, Math.round(r.width * SCALE));
      h = canvas.height = Math.max(1, Math.round(r.height * SCALE));
      return true;
    }

    if (window.ResizeObserver) {
      new ResizeObserver(function () { dirty = true; }).observe(host);
    } else {
      window.addEventListener("resize", function () { dirty = true; });
    }

    return function draw(phase) {
      if (dirty) {
        if (!measure()) return;   // still laid out at zero: try again next frame
        dirty = false;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      ctx.strokeStyle = INK + "0.38)";
      ctx.fillStyle = BGC;

      for (var i = 0; i < ROWS; i++) {
        var t = i / (ROWS - 1);
        var base = (0.08 + t * 0.88) * h;
        var amp = (0.08 + t * 0.1) * h;
        var q = i * 0.4 + phase;
        var s2;

        for (s2 = 0; s2 <= STEPS; s2++) {
          var u = s2 / STEPS;
          var g = Math.exp(-Math.pow((u - 0.5) / 0.27, 2));
          var n = Math.sin(u * 15.5 + q) * 0.55 +
                  Math.sin(u * 6.8 - q * 0.7) * 0.33 +
                  Math.sin(u * 30.5 + q * 1.4) * 0.16;
          xs[s2] = u * w;
          ys[s2] = base - n * g * amp;
        }

        // filled skirt first, deep enough to bury the row behind it
        var floor = base + h * 0.1;
        ctx.beginPath();
        ctx.moveTo(xs[0], floor);
        for (s2 = 0; s2 <= STEPS; s2++) ctx.lineTo(xs[s2], ys[s2]);
        ctx.lineTo(xs[STEPS], floor);
        ctx.closePath();
        ctx.fill();

        // then the ridge on top, so the skirt edges stay invisible
        ctx.beginPath();
        ctx.moveTo(xs[0], ys[0]);
        for (s2 = 1; s2 <= STEPS; s2++) ctx.lineTo(xs[s2], ys[s2]);
        ctx.stroke();
      }
    };
  }

  // A single slow loop drives every animated plate; ~24fps is plenty for a
  // drift this gentle, and it idles whenever the tab is in the background.
  var animated = [];
  function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden || now - loop.last < 50) return;
    loop.last = now;
    loop.phase += 0.026;
    for (var i = 0; i < animated.length; i++) {
      // Хвилі малюються, лише поки їхня секція на екрані. Раніше цикл
      // крутився завжди - близько двох тисяч операцій із контуром двадцять
      // разів на секунду навіть тоді, коли секції не видно; на телефоні
      // цей кадр і так ділять трек, фізика букв і полумʼя.
      // Міряємо прямокутником, а не IntersectionObserver: у горизонтальному
      // треку секція лежить у зсунутому fixed-контейнері, і спостерігач там
      // бреше, а getBoundingClientRect враховує трансформ чесно.
      var r = animated[i].host.getBoundingClientRect();
      if (r.bottom < -80 || r.top > window.innerHeight + 80) continue;
      if (r.right < -80 || r.left > window.innerWidth + 80) continue;
      animated[i](loop.phase);
    }
  }
  loop.last = 0;
  loop.phase = 0;

  nodes.forEach(function (node) {
    if (node.getAttribute("data-art") !== "terrain") return;
    var draw = terrain(node);
    draw(0);
    if (!reduce) { draw.host = node; animated.push(draw); }
  });

  if (animated.length) requestAnimationFrame(loop);
})();

// ===== Hero background video =====
// Put a looping clip in video/ and point data-video at it:
//   <div class="hero__bg" data-video="video/hero.mp4">
// Left empty nothing is requested at all, and the drawn plate stays on screen.
// The clip is also skipped on narrow screens, on metered connections and when
// the visitor asks for reduced motion — the plate covers every one of those.
(function () {
  var bg = document.querySelector(".hero__bg[data-video]");
  if (!bg) return;
  var src = (bg.getAttribute("data-video") || "").trim();
  if (!src) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia("(min-width: 700px)").matches) return;

  var conn = navigator.connection;
  if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ""))) return;

  var video = document.createElement("video");
  video.className = "hero__video";
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.autoplay = true;
  video.playsInline = true;
  video.preload = "auto";
  // attributes as well as properties: Safari reads the markup, not the DOM
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("aria-hidden", "true");

  // only step over the drawn plate once frames are actually moving, so a
  // blocked autoplay or a missing file never leaves an empty hero
  video.addEventListener("playing", function () {
    bg.classList.add("has-video");
    video.classList.add("is-ready");
  });

  video.addEventListener("error", function () {
    bg.classList.remove("has-video");
    if (video.parentNode) video.parentNode.removeChild(video);
  });

  video.src = src;
  bg.insertBefore(video, bg.firstChild);
  var started = video.play();
  if (started && started.catch) started.catch(function () { /* plate stays */ });
})();

// ===== Logo image =====
// Лого стоїть просто в розмітці, тож із першого кадру видно саме його.
// Модуль лишається запасним: якщо в якомусь гнізді і далі текстовий напис
// (наприклад картинку прибрали), він підмінить його, коли файл знайдеться.
// Заповнені гнізда не чіпає - раніше саме та підміна і давала блимання:
// спершу малювався текст, а через мить перескакував на картинку іншої ширини.
(function () {
  var slots = [].filter.call(document.querySelectorAll("[data-logo]"), function (s) {
    return !s.classList.contains("has-logo");
  });
  if (!slots.length) return;

  // img/ lives at the site root, so pages under ua/ need to climb one level:
  // a bare "img/logo.png" would resolve to /ua/img/logo.png and 404.
  var base = location.pathname.indexOf("/ua/") !== -1 ? "../" : "";

  // png first: it is the file that ships, so a normal load makes no 404.
  // Swap the order if the logo is ever replaced with an svg.
  var sources = [base + "img/logo.png", base + "img/logo.svg"];

  function apply(src) {
    slots.forEach(function (slot) {
      var img = document.createElement("img");
      img.className = "logo-img";
      img.src = src;
      img.alt = slot.getAttribute("data-logo") || "FED.ANDRII";
      slot.textContent = "";
      slot.appendChild(img);
      slot.classList.add("has-logo");
    });
  }

  function probe(i) {
    if (i >= sources.length) return;   // no file yet: the wordmark stays
    var test = new Image();
    test.onload = function () { apply(sources[i]); };
    test.onerror = function () { probe(i + 1); };
    test.src = sources[i];
  }

  probe(0);
})();

// ===== Statement physics =====
// The same trick as on olhalazarieva.com, rebuilt from its bundle: every
// letter is a matter-js body drawn on a canvas. Entering the section drops
// the whole sentence — gravity 3, a tiny random shove per letter — and the
// pile collects on the section floor. The cursor does not drag letters, it
// repels them (120px radius, force fading out to 400px). Scrolling back
// out lerps every letter home (0.18/frame) and freezes it static again.
(function () {
  var blocks = document.querySelectorAll("[data-statement]");
  if (!blocks.length || !window.Matter) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var M = window.Matter;

  // matter-js 0.19 corrupts a body's stored mass when setStatic(true) runs
  // on an already-static body - un-freezing then yields Infinity mass and NaN
  // positions on the first engine step. Only ever flip the flag on a change.
  function setStaticSafe(b, flag) {
    if (b.isStatic !== flag) M.Body.setStatic(b, flag);
  }

  blocks.forEach(function (block) {
    var sec = block.closest(".statement");
    if (!sec) return;
    sec.classList.add("statement--physics");
    var pin = sec.closest(".statement-pin");
    if (pin) pin.classList.add("statement-pin--on");

    // split into letters up front; spaces stay text nodes so the fallback
    // sentence renders exactly as before
    var chars = [];
    block.querySelectorAll(".statement__line > span").forEach(function (wrap) {
      var dim = wrap.classList.contains("dim");
      var text = wrap.textContent;
      wrap.textContent = "";
      // letters are grouped into unbreakable word wrappers: bare
      // inline-block letters wrap anywhere, orphaning the last letter
      // of a long word onto its own line
      var word = null;
      for (var i = 0; i < text.length; i++) {
        if (text[i] === " ") { wrap.appendChild(document.createTextNode(" ")); word = null; continue; }
        if (!word) {
          word = document.createElement("span");
          word.className = "statement__word";
          wrap.appendChild(word);
        }
        var ch = document.createElement("span");
        ch.className = "statement__ch" + (dim ? " dim" : "");
        ch.textContent = text[i];
        word.appendChild(ch);
        chars.push(ch);
      }
    });
    if (!chars.length) return;

    var world = null, released = false, settleRaf = 0;
    var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    // Букви були надто чутливі до курсора з двох причин. Поштовх ішов на
    // кожну подію mousemove, а миша шле їх куди частіше за кадри фізики -
    // тож швидка миша била в кілька разів сильніше за повільну. І сама
    // крива згасання рахувалася від 400px, хоча радіус дії 120px: на межі
    // лишалося ще 70% сили, тобто буква зривалася з місця вже від дотику
    // краєм. Тепер поштовх один на кадр і згасає до нуля рівно на межі.
    var REACH = 120;
    var FORCE = fine ? 0.11 : 0.04;
    var mx = 0, my = 0, mouseMoved = false;

    // letter rects are only trustworthy once the display font is in, else
    // the fallback font's metrics get frozen into the physics bodies
    var fontsReady = !document.fonts;
    if (document.fonts) document.fonts.ready.then(function () { fontsReady = true; });
    function settledEntrance() { return fontsReady; }

    function build() {
      if (world) return true;
      if (!settledEntrance()) return false;
      var sr = sec.getBoundingClientRect();
      var W = Math.round(sr.width), H = Math.round(sr.height);
      if (!W || !H) return false;

      // Повна якість симуляції скрізь. Зниження ітерацій на телефоні було
      // спробою вигнати ривки, але справжня причина була не тут: гортався
      // корінь сторінки, і під пальцем «дихала» висота екрана. Причину
      // усунено (див. блок «ХТО САМЕ ПРОКРУЧУЄТЬСЯ»), тож фізика
      // повертається такою, якою була. Прапорець coarse лишається: від
      // нього залежить засинання двигуна, коли купа влежалась.
      var coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      var engine = M.Engine.create({ positionIterations: 8, velocityIterations: 6 });
      engine.gravity.y = 3;
      // Уповільнюємо не тяжіння, а хід самої симуляції: тоді падіння,
      // відскоки, обертання і відштовхування курсором лишаються тими самими
      // за характером - просто все йде на 40% повільніше. Якщо збивати
      // gravity, букви ще й летіли б інакше: м'якше і без ваги.
      engine.timing.timeScale = 0.6;

      var render = M.Render.create({
        element: sec,
        engine: engine,
        options: {
          width: W, height: H,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          wireframes: false,
          background: "transparent"
        }
      });
      render.canvas.className = "statement__canvas";

      var thick = 140;   // thick enough that no letter can tunnel through
      M.World.add(engine.world, [
        // floor flush with the section bottom, walls just outside the edges
        M.Bodies.rectangle(W / 2, H + thick / 2, W * 2, thick, { isStatic: true, friction: 1, restitution: 0, render: { visible: false } }),
        M.Bodies.rectangle(-thick / 2, H / 2, thick, H * 2, { isStatic: true, render: { visible: false } }),
        M.Bodies.rectangle(W + thick / 2, H / 2, thick, H * 2, { isStatic: true, render: { visible: false } })
      ]);

      var cs = getComputedStyle(block);
      var font = "800 " + parseFloat(cs.fontSize) + "px " + cs.fontFamily;
      // canvas ignores CSS text-transform, so the case conversion the DOM was
      // doing has to be applied to the characters themselves
      var upper = cs.textTransform === "uppercase";

      var bodies = [], homes = [];
      chars.forEach(function (ch) {
        var r = ch.getBoundingClientRect();
        var x = r.left - sr.left + r.width / 2;
        var y = r.top - sr.top + r.height / 2;
        var body = M.Bodies.rectangle(x, y, Math.max(6, r.width), Math.max(10, r.height * 0.78), {
          restitution: 0.1, friction: 0.01, frictionAir: 0.01, density: 5e-4,
          render: { visible: false }
        });
        body.plateChar = upper ? ch.textContent.toUpperCase() : ch.textContent;
        // Колір тримаємо числами, а не рядком: після падіння буква плавно
        // гасне, і компоненти доводиться перераховувати щокадру
        body.plateAlpha = ch.classList.contains("dim") ? 0.42 : 1;
        body.plateRest = 0;
        setStaticSafe(body, true);
        M.World.add(engine.world, body);
        bodies.push(body);
        homes.push({ x: x, y: y });
      });

      M.Events.on(render, "afterRender", function () {
        var ctx = render.context;
        ctx.font = font;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (var i = 0; i < bodies.length; i++) {
          var b = bodies[i];

          // Затемнення після падіння. plateRest росте, поки буква лежить
          // спокійно, і швидко спадає, щойно вона знову рушила. До релізу
          // (букви ще стоять реченням) і після повернення додому - нуль,
          // інакше нерухомий напис гаснув би сам собою.
          if (!released || b.isStatic) {
            b.plateRest = 0;
          } else if (b.speed > 0.3 || b.angularSpeed > 0.02) {
            b.plateRest = Math.max(0, b.plateRest - 0.08);
          } else {
            b.plateRest = Math.min(1, b.plateRest + 0.035);
          }

          var k = 1 - b.plateRest * 0.5;
          ctx.save();
          ctx.translate(b.position.x, b.position.y);
          ctx.rotate(b.angle);
          ctx.fillStyle = "rgba(" + Math.round(240 * k) + "," + Math.round(238 * k) +
                          "," + Math.round(232 * k) + "," + b.plateAlpha + ")";
          ctx.fillText(b.plateChar, 0, 0);
          ctx.restore();
        }
      });

      // gravity 3 accelerates letters enough to tunnel through walls and
      // deep-overlap, which crashes matter-js collision detection - so speed
      // is capped below the floor thickness per tick
      M.Events.on(engine, "beforeUpdate", function () {
        // курсор штовхає рівно раз на крок фізики і лише поки він рухається:
        // на нерухомій миші букви стоять, а не сповзають
        if (mouseMoved) {
          mouseMoved = false;
          for (var j = 0; j < bodies.length; j++) {
            var bb = bodies[j];
            if (bb.isStatic) continue;
            var ddx = bb.position.x - mx, ddy = bb.position.y - my;
            var dd2 = ddx * ddx + ddy * ddy;
            if (dd2 >= REACH * REACH) continue;
            var dd = Math.sqrt(dd2) || 1;
            var force = FORCE * (1 - dd / REACH);
            M.Body.applyForce(bb, bb.position, { x: ddx / dd * force, y: ddy / dd * force });
          }
        }
        for (var i = 0; i < bodies.length; i++) {
          var b = bodies[i];
          if (b.isStatic) continue;
          var v = b.velocity, sp = Math.hypot(v.x, v.y);
          if (sp > 36) M.Body.setVelocity(b, { x: v.x / sp * 36, y: v.y / sp * 36 });
        }
      });

      var calmFrames = 0;
      var runner = M.Runner.create();
      M.Runner.run(runner, engine);
      M.Render.run(render);

      // Коли купа влежалась, рахувати нічого: на сенсорному екрані миші,
      // яка б штовхнула букви, не існує. Двигун і рендер стають на паузу
      // і прокидаються лише на падіння, збирання чи зміну розміру.
      if (coarse) {
        M.Events.on(engine, "afterUpdate", function () {
          if (!world || world.asleep) return;
          // Поки букви летять додому, вони статичні, тобто "спокійні" за
          // будь-яким виміром. Без цієї перевірки лічильник добігав до 24
          // просто посеред збирання, рендер зупинявся - і букви лишались
          // лежати купою замість того, щоб зібратись у речення.
          if (world.settling) { calmFrames = 0; return; }
          var moving = false;
          for (var s = 0; s < bodies.length; s++) {
            var bb = bodies[s];
            if (bb.isStatic) continue;
            // 0.25, а не 0.08: купа з шістдесяти літер ніколи не завмирає
            // повністю - вони дрібно тремтять одна об одну ще секунд вісім.
            // Око цього тремтіння не бачить, а кадр воно з'їдає.
            if (bb.speed > 0.25 || bb.angularSpeed > 0.04) { moving = true; break; }
          }
          calmFrames = moving ? 0 : calmFrames + 1;
          // майже пів секунди спокою поспіль, а не один кадр: буква на мить
          // зупиняється і в найвищій точці відскоку
          if (calmFrames > 24) {
            world.asleep = true;
            M.Runner.stop(runner);
            M.Render.stop(render);
          }
        });
      }

      // from here the canvas is the text; only the letter lines hide, the
      // small static "start with" between them stays in the DOM
      block.querySelectorAll(".statement__line").forEach(function (l) { l.style.visibility = "hidden"; });
      world = {
        engine: engine, render: render, runner: runner,
        bodies: bodies, homes: homes, asleep: false, settling: false,
        wake: function () {
          // Лічильник спокою скидається ЗАВЖДИ, навіть якщо світ і не спав.
          // Інакше він лишався на 25 з минулого засинання, і двигун,
          // прокинувшись на друге падіння, засинав на першому ж кадрі -
          // ще до того, як букви відпускаються. Через це вся анімація
          // програвалась лише один раз за візит.
          calmFrames = 0;
          if (!this.asleep) return;
          this.asleep = false;
          M.Runner.run(runner, engine);
          M.Render.run(render);
        }
      };
      return true;
    }

    function release() {
      if (!build() || released) return;
      if (world && world.wake) world.wake();
      released = true;
      world.settling = false;
      if (settleRaf) { cancelAnimationFrame(settleRaf); settleRaf = 0; }
      world.bodies.forEach(function (b, i) {
        setStaticSafe(b, true);
        M.Body.setPosition(b, world.homes[i]);
        M.Body.setAngle(b, 0);
        M.Body.setVelocity(b, { x: 0, y: 0 });
        M.Body.setAngularVelocity(b, 0);
      });
      setTimeout(function () {
        if (!released || !world) return;
        world.bodies.forEach(function (b) {
          setStaticSafe(b, false);
          M.Body.applyForce(b, b.position, { x: 0.02 * (Math.random() - 0.5), y: 0.003 * Math.random() });
        });
      }, 40);
      window.addEventListener("mousemove", repel);
    }

    function reassemble() {
      if (!world || !released) return;
      if (world.wake) world.wake();
      world.settling = true;
      released = false;
      mouseMoved = false;
      window.removeEventListener("mousemove", repel);
      world.bodies.forEach(function (b) {
        setStaticSafe(b, true);
        M.Body.setVelocity(b, { x: 0, y: 0 });
        M.Body.setAngularVelocity(b, 0);
      });
      (function tick() {
        var done = true;
        world.bodies.forEach(function (b, i) {
          var h = world.homes[i];
          var x = b.position.x + (h.x - b.position.x) * 0.18;
          var y = b.position.y + (h.y - b.position.y) * 0.18;
          var a = b.angle * 0.82;
          M.Body.setPosition(b, { x: x, y: y });
          M.Body.setAngle(b, a);
          if (Math.abs(x - h.x) > 0.3 || Math.abs(y - h.y) > 0.3 || Math.abs(a) > 0.005) done = false;
        });
        if (done) {
          world.bodies.forEach(function (b, i) {
            M.Body.setPosition(b, world.homes[i]);
            M.Body.setAngle(b, 0);
          });
          world.settling = false;
          settleRaf = 0;
        } else {
          settleRaf = requestAnimationFrame(tick);
        }
      })();
    }

    function repel(e) {
      if (!world) return;
      var rect = world.render.canvas.getBoundingClientRect();
      mx = e.clientX - rect.left;
      my = e.clientY - rect.top;
      mouseMoved = true;
    }

    function destroy() {
      if (!world) return;
      mouseMoved = false;
      window.removeEventListener("mousemove", repel);
      if (settleRaf) { cancelAnimationFrame(settleRaf); settleRaf = 0; }
      M.Render.stop(world.render);
      M.Runner.stop(world.runner);
      if (world.render.canvas.parentNode) world.render.canvas.parentNode.removeChild(world.render.canvas);
      M.Engine.clear(world.engine);
      world = null;
      released = false;
      block.querySelectorAll(".statement__line").forEach(function (l) { l.style.visibility = ""; });
    }

    // Scroll drives everything, exactly like the reference:
    //   p = viewports scrolled past the moment the section pinned
    //   p >= 0.5  -> the sentence drops (start: "top -50%")
    //   p < 0.5   -> letters fly home, only on the way back up (onLeaveBack)
    //   p 1.5..2.5 -> the NEXT section slides up over the pile: pure CSS,
    //                 a -100vh margin pulls it into the pin (see style.css)
    // Scrolling onward past the pile changes nothing - the pile stays.
    var pinEl = sec.closest(".statement-pin") || sec;

    function onScroll() {
      var p = -pinEl.getBoundingClientRect().top / window.innerHeight;
      if (p >= 0.5 && !released) release();
      else if (p < 0.5 && released && world) reassemble();
    }

    onScrollBound(onScroll);
    if (document.fonts) document.fonts.ready.then(onScroll);
    onScroll();

    var resizeT = 0;
    window.addEventListener("resize", function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () {
        destroy();
        onScroll();
      }, 150);
    });

    // deliberate test hook: lets the physics be driven where observers and
    // rAF are unavailable (automated checks); harmless in production
    window.__stmt = {
      build: build, release: release, reassemble: reassemble,
      getWorld: function () { return world; },
      isReleased: function () { return released; }
    };
  });
})();

// ===== Typed intro =====
// The greeting types itself out when its panel scrolls into view. Characters
// are revealed against elapsed time, not a timer chain, so a throttled or
// backgrounded tab snaps up to date on return instead of crawling. Position
// is checked from the element's on-screen rect, which holds for both the
// horizontal desktop track and plain vertical scrolling.
(function () {
  var els = document.querySelectorAll("[data-typeintro]");
  if (!els.length) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  els.forEach(function (el) {
    // wrap every character in place, descending into styled spans (.accent)
    // so their colour and stroke carry over untouched
    var spans = [];
    (function wrap(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      kids.forEach(function (kid) {
        if (kid.nodeType === 1) { wrap(kid); return; }
        if (kid.nodeType !== 3) return;
        var frag = document.createDocumentFragment();
        var text = kid.textContent.replace(/\s+/g, " ");
        for (var i = 0; i < text.length; i++) {
          var s = document.createElement("span");
          s.className = "tw-ch";
          s.textContent = text[i];
          frag.appendChild(s);
          spans.push(s);
        }
        node.replaceChild(frag, kid);
      });
    })(el);
    // trim the pad the markup indentation left at either end
    while (spans.length && spans[0].textContent === " ") spans.shift().remove();
    while (spans.length && spans[spans.length - 1].textContent === " ") spans.pop().remove();
    if (!spans.length) return;

    if (reduce) {
      spans.forEach(function (s) { s.classList.add("on"); });
      return;
    }

    // the reveal clock: base cadence with a breath after punctuation
    var times = [], t = 0;
    spans.forEach(function (s) {
      var ch = s.textContent;
      t += 24 + Math.random() * 22;
      if (/[!?]/.test(ch)) t += 260;
      else if (/[,:;]/.test(ch)) t += 150;
      times.push(t);
    });
    var total = t;

    var caret = document.createElement("span");
    caret.className = "tw-caret";
    caret.setAttribute("aria-hidden", "true");

    var started = 0, shown = 0, timer = 0, caretAt = -1;

    function tick() {
      var elapsed = performance.now() - started;
      while (shown < spans.length && times[shown] <= elapsed) {
        spans[shown].classList.add("on");
        shown++;
      }
      // Курсор переставляється лише тоді, коли справді з'явилась нова
      // літера. Раніше .after() виконувався щокадру: вузол щоразу виймався
      // з потоку і вставлявся назад, і рядок помітно смикався.
      if (shown > 0 && shown < spans.length && shown !== caretAt) {
        caretAt = shown;
        // the caret rides just behind the newest character
        spans[shown - 1].after(caret);
      }
      if (shown >= spans.length) {
        clearInterval(timer);
        // курсор лишається біля останньої літери, а не в кінці елемента:
        // у заголовку з блоковими рядками appendChild кинув би його на
        // власний рядок і посунув верстку
        spans[spans.length - 1].after(caret);
        setTimeout(function () { caret.remove(); }, 1400);
        return;
      }
      requestAnimationFrame(tick);
    }

    function start() {
      if (started) return;
      started = performance.now();
      // Клас вмикає анімацію підпису-картинки: вона «дописується» рівно
      // тоді, коли починає набиратись текст поруч
      el.classList.add("tw-run");
      // Курсор ставимо перед ПЕРШОЮ літерою, а не перед усім блоком.
      // Раніше він з'являвся біля лівого краю абзацу і на першій же літері
      // перестрибував через увесь рядок: перший рядок тут картинка, а
      // наступні йдуть сходинкою з відступами.
      spans[0].before(caret);
      // interval as the safety net where rAF is paused; both call the same
      // clock, so double delivery is harmless
      timer = setInterval(tick, 200);
      requestAnimationFrame(tick);
    }

    function check() {
      if (started) return;
      var r = el.getBoundingClientRect();
      if (!r.width) return;
      var vw = window.innerWidth, vh = window.innerHeight;
      if (r.left < vw * 0.85 && r.right > vw * 0.05 && r.top < vh * 0.85 && r.bottom > vh * 0.05) {
        window.removeEventListener("scroll", check);
        start();
      }
    }

    onScrollBound(check);
    window.addEventListener("load", check);
    check();
  });
})();

// ===== Custom cursor =====
// Ported from the CursorDot component in the other portfolio, visuals intact:
// an 8px white dot in difference blend that trails the pointer on a 0.35
// lerp, grows 2.2x over genuine click targets, and carries a small "press"
// tag. Functional adaptation to this site: the label is localised from the
// page language, and the dot spawns at the pointer instead of lerping in
// from the screen centre. Mouse-class pointers only.
(function () {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  // genuine click targets only - hover-preview rows and grabbable letters
  // change on hover by themselves and would make the dot flicker
  var INTERACTIVE = 'a, button, [role="button"], input, textarea, select, summary, [data-cursor]';

  var wrap = document.createElement("div");
  wrap.className = "cursor-dot";
  wrap.setAttribute("aria-hidden", "true");

  var dot = document.createElement("span");
  dot.className = "cursor-dot__dot";
  wrap.appendChild(dot);

  var tag = document.createElement("span");
  tag.className = "cursor-dot__tag";
  var PRESS = (document.documentElement.lang || "").indexOf("uk") === 0 ? "Клік" : "Click";
  tag.textContent = PRESS;
  wrap.appendChild(tag);

  document.body.appendChild(wrap);

  var x = 0, y = 0, tx = 0, ty = 0;
  var seen = false, raf = 0, lastTouch = 0, noteTimer = 0;

  function apply() {
    wrap.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
  }

  function loop() {
    x += (tx - x) * 0.35;
    y += (ty - y) * 0.35;
    apply();
    if (Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1) {
      raf = requestAnimationFrame(loop);
    } else {
      raf = 0;
    }
  }

  window.addEventListener("mousemove", function (e) {
    if (Date.now() - lastTouch < 600) return;   // ghost events after a tap
    tx = e.clientX;
    ty = e.clientY;
    if (!seen) { seen = true; x = tx; y = ty; apply(); }
    wrap.classList.add("is-on");
    var el = e.target && e.target.closest ? e.target : document.elementFromPoint(tx, ty);
    wrap.classList.toggle("is-hover", !!(el && el.closest && el.closest(INTERACTIVE)));
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });

  function hide() {
    wrap.classList.remove("is-on");
    wrap.classList.remove("is-hover");
  }
  document.addEventListener("mouseleave", hide);
  document.addEventListener("mouseenter", function () { if (seen) wrap.classList.add("is-on"); });
  window.addEventListener("touchstart", function () { lastTouch = Date.now(); hide(); }, { passive: true });
  window.addEventListener("touchend", function () { lastTouch = Date.now(); }, { passive: true });

  // transient message on the cursor, e.g. dispatch:
  //   window.dispatchEvent(new CustomEvent("cursor-note", { detail: "Скопійовано" }))
  window.addEventListener("cursor-note", function (e) {
    tag.textContent = e.detail || PRESS;
    wrap.classList.add("is-note");
    clearTimeout(noteTimer);
    noteTimer = setTimeout(function () {
      wrap.classList.remove("is-note");
      tag.textContent = PRESS;
    }, 1500);
  });
})();


// ===== Послуги: Портфоліо наїжджає зверху (телефон і планшет) =====
// На ПК те саме робить чиста геометрія в CSS: секція рівно на екран,
// обгортка вдвічі вища. Нижче 1025px секція вища за екран, тож розміри
// рахуємо тут: обгортка = висота секції + екран, а сама секція липне так,
// щоб її НИЗ став на низ екрана - інакше при top:0 хвіст списку зрізало б.
(function () {
  var pin = document.querySelector(".services-pin");
  if (!pin) return;
  var sec = pin.querySelector("#services");
  var works = pin.nextElementSibling;
  if (!sec || !works || !works.classList.contains("works-pin")) return;

  // та сама умова, за якої CSS не вмикає панельний режим (body.snap-on)
  var mq = window.matchMedia("(max-width: 1024px), (max-height: 699px)");

  function off() {
    pin.classList.remove("services-pin--on");
    pin.style.height = "";
    pin.style.removeProperty("--services-top");
    works.style.marginTop = "";
  }

  function measure() {
    if (!mq.matches) { off(); return; }
    // висоту міряємо без власного розтягування обгортки
    pin.style.height = "";
    var h = sec.offsetHeight;
    var vh = stableVH;
    if (!h || !vh) { off(); return; }
    pin.classList.add("services-pin--on");
    // запас рівно на екран - стільки Портфоліо йде поверх
    pin.style.height = h + vh + "px";
    // вища за екран секція липне низом, нижча - верхом
    pin.style.setProperty("--services-top", Math.min(0, vh - h) + "px");
    works.style.marginTop = -vh + "px";
  }

  measure();
  // на зміну ширини, а не на кожне згортання адресного рядка
  onStableResize(measure);
  window.addEventListener("load", measure);
  if (document.fonts) document.fonts.ready.then(measure);
  if (mq.addEventListener) mq.addEventListener("change", measure);
})();

// ===== Портфоліо: приколена панель із горизонтальним проїздом =====
// Обгортка вища за екран рівно на той шлях, який має пройти стрічка.
// Поки сторінка проходить цю висоту, секція прилипла, а прогрес
// перекладається у scrollLeft стрічки. Далі сторінка йде далі сама.
(function () {
  var pin = document.querySelector(".works-pin");
  if (!pin) return;
  var rail = pin.querySelector(".works__grid");
  if (!rail) return;

  // Дзеркало умови з css/style.css (блок «.works-pin { position: relative }»):
  // якщо ці дві умови розійдуться, панель прилипне, а стрічка стоятиме.
  // На телефоні стрічки немає з тієї ж причини, що й треку: запис scrollLeft
  // з обробника прокрутки не встигає за композитором, та ще й змушує
  // перерахувати розкладку. Там картки йдуть звичайним стовпчиком.
  var mq = window.matchMedia("(min-width: 769px)");
  var travel = 0;

  function measure() {
    if (!mq.matches) {
      pin.style.height = "";
      rail.scrollLeft = 0;
      lastLeft = -1;
      travel = 0;
      return;
    }
    travel = Math.max(rail.scrollWidth - rail.clientWidth, 0);
    pin.style.height = travel ? stableVH + travel + "px" : "";
  }

  var lastLeft = -1;

  function apply() {
    if (!travel) return;
    var p = -pin.getBoundingClientRect().top / travel;
    var next = Math.round(Math.min(Math.max(p, 0), 1) * travel);
    // запис scrollLeft змушує перерахувати розкладку - робимо це лише
    // тоді, коли число справді змінилось
    if (next === lastLeft) return;
    lastLeft = next;
    rail.scrollLeft = next;
  }

  measure();
  apply();

  onScrollBound(apply);
  onStableResize(function () { measure(); apply(); });
  // шрифти й картинки міняють ширину карток уже після першого заміру
  window.addEventListener("load", function () { measure(); apply(); });
  if (document.fonts) document.fonts.ready.then(function () { measure(); apply(); });
  if (mq.addEventListener) mq.addEventListener("change", function () { measure(); apply(); });
})();

// ===== Вогонь із символів під слоганом =====
// Класичний «doom fire»: нижній ряд горить на повну, кожна клітинка вище
// успадковує жар від тієї, що під нею, з випадковим спадом і зсувом убік.
// Малюємо не пікселями, а символами - чорно-біле ASCII-полумʼя на всю
// ширину екрана. Літери слогана падають зверху і лягають у нього.
(function () {
  var sections = document.querySelectorAll(".statement");
  if (!sections.length) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var RAMP = " .'^:*+=#%@";  // тонкі знаки на вістрях, щільні в основі
  var MAX = 48;             // рівнів жару: більше запасу під три яруси кольору

  sections.forEach(function (sec) {
    var cv = document.createElement("canvas");
    cv.className = "statement__fire";
    cv.setAttribute("aria-hidden", "true");
    // першим нащадком: полотно абсолютне, тож у flex-контейнері
    // (.statement--physics) воно не стає flex-елементом і нічого не зсуває
    sec.insertBefore(cv, sec.firstChild);

    var ctx = cv.getContext("2d");
    var cols = 0, rows = 0, cw = 0, ch = 0, heat = null, dpr = 1, raf = 0, alive = false;
    var veil = "#0a0a0a";   // колір тла під секцією: ним полумʼя ховає букви

    // Тло секції може бути задане не на ній самій, а вище по дереву
    function bgOf(el) {
      for (var n = el; n && n !== document.documentElement; n = n.parentElement) {
        var c = window.getComputedStyle(n).backgroundColor;
        if (c && c !== "transparent" && c.indexOf("rgba(0, 0, 0, 0)") === -1) return c;
      }
      return "#0a0a0a";
    }

    function measure() {
      var w = window.innerWidth;
      var narrow = w < 700;
      // На телефоні смуга вища: клітинки більші, і без запасу висоти
      // лишалося б надто мало рядів, щоб полумʼя встигло звузитись догори
      var h = Math.round(Math.min(
        Math.max(sec.getBoundingClientRect().height * (narrow ? 0.28 : 0.19), narrow ? 170 : 110),
        narrow ? 280 : 210));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      veil = bgOf(sec);
      cv.style.height = h + "px";
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      // 190 колонок на 390px давали клітинку 7px - вогонь читався як шум.
      // На вузькому екрані колонок утричі менше, тож символи великі й видні
      cw = Math.max(7, Math.round(w / (narrow ? 32 : 190)));
      ch = Math.round(cw * (narrow ? 1.45 : 1.55));
      cols = Math.ceil(w / cw) + 1;
      rows = Math.ceil(h / ch) + 1;
      heat = new Uint8Array(cols * rows);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = "700 " + Math.round(ch * 0.95) + "px \"Spline Sans Mono\", \"Courier New\", monospace";
      ctx.textBaseline = "top";
      seed();
    }

    function seed() {
      for (var x = 0; x < cols; x++) heat[(rows - 1) * cols + x] = MAX;
    }

    // Рядки йдуть знизу вгору за зростанням y: кожен читає ще не зачеплений
    // ряд під собою. Якби йшли навпаки, жар за один кадр долітав би до
    // верху і полумʼя стояло б суцільною стіною.
    function step() {
      for (var y = 1; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var v = heat[y * cols + x];
          // Гострота йде від РОЗКИДУ спаду, а не від сили гасіння. 10%
          // клітинок не втрачає жару зовсім: їм щастить кілька рядів
          // поспіль, і вони тягнуться вгору вузьким вістрям, поки сусіди
          // згасають. Рівний спад давав би округлі шапки, а надто сильний
          // (як у першій спробі) гасив полумʼя на півдорозі.
          var r = Math.random();
          // 8% клітинок гасне різко (decay 7) - це провали, місця де вогню
          // на верхньому ярусі просто немає. 10% не втрачає жару зовсім -
          // це довгі вузькі язики. Решта - звичайний спад.
          var decay = r < 0.08 ? 7 : (r < 0.5 ? 3 : (r < 0.75 ? 2 : (r < 0.9 ? 1 : 0)));
          // здебільшого без зсуву (вістря лишаються вузькими), але зрідка
          // стрибок на дві клітинки - тоді язик іде вбік і виглядає широким
          var d = Math.random();
          var dx = x + (d < 0.70 ? 0 : (d < 0.82 ? -1 : (d < 0.94 ? 1 : (d < 0.97 ? -2 : 2))));
          if (dx < 0) dx = 0; else if (dx >= cols) dx = cols - 1;
          heat[(y - 1) * cols + dx] = v > decay ? v - decay : 0;
        }
      }
      // низ мерехтить, інакше вогонь виглядає мертвим
      for (var i = 0; i < cols; i++) {
        heat[(rows - 1) * cols + i] = MAX - ((Math.random() * 4) | 0);
      }
    }

    function draw() {
      ctx.clearRect(0, 0, cv.width / dpr, cv.height / dpr);
      // Смуга полумʼя непрозора, кольору тла: букви падають ЗА неї і в ній
      // зникають. Маска зверху розмиває край смуги, тож літера не обривається
      // об рівну лінію, а тане, поки провалюється в полумʼя.
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, cv.width / dpr, cv.height / dpr);
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var v = heat[y * cols + x];
          if (!v) continue;
          var t = v / MAX;
          var chr = RAMP.charAt(Math.min(RAMP.length - 1, Math.round(t * (RAMP.length - 1))));
          if (chr === " ") continue;
          // Зернистість рахуємо з координат, а не з Math.random: інакше
          // структура мерехтіла б щокадру замість того, щоб стояти на місці
          var grain = ((x * 7 + y * 13) % 5) - 2;
          var lum, a;
          if (t >= 0.80) {
            // 1 ярус - розжарена основа: майже білий, щільний
            lum = 240 + Math.round((t - 0.80) * 75);
            a = 0.92 + (t - 0.80) * 0.4;
          } else if (t >= 0.40) {
            // 2 ярус - сірий із фактурою: десь світліше, десь темніше,
            // саме тут читається структура полумʼя
            lum = 118 + Math.round((t - 0.40) * 175) + grain * 11;
            a = 0.34 + (t - 0.40) * 1.1;
          } else {
            // 3 ярус - рідкі темні язики і провали між ними
            lum = 68 + Math.round(t * 105) + grain * 7;
            a = 0.10 + t * 0.55;
          }
          if (lum < 60) lum = 60; else if (lum > 255) lum = 255;
          ctx.fillStyle = "rgba(" + lum + "," + lum + "," + lum + "," + a.toFixed(3) + ")";
          ctx.fillText(chr, x * cw, y * ch);
        }
      }
    }

    var FPS = 18, last = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (now - last < 1000 / FPS) return;
      last = now;
      step();
      draw();
    }
    function start() { if (alive || reduce) return; alive = true; raf = requestAnimationFrame(frame); }
    function stop() { if (!alive) return; alive = false; cancelAnimationFrame(raf); }
    function still() { for (var i = 0; i < 70; i++) step(); draw(); }

    measure();
    // одразу розпалюємо статичний кадр: полотно ніколи не буває порожнім,
    // навіть якщо спостерігач видимості не спрацює (headless, старі рушії)
    still();

    // поза екраном полумʼя не рахуємо, але саме зображення лишається
    if ("IntersectionObserver" in window && !reduce) {
      new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) start(); else stop();
      }, { rootMargin: "150px" }).observe(sec);
      // страховка: якщо спостерігач мовчить, за секунду запускаємось самі
      setTimeout(function () { if (!alive) start(); }, 1000);
    } else if (!reduce) {
      start();
    }

    var rt = 0;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { measure(); still(); }, 160);
    });
  });
})();

// ===== Перемикач мови: кнопка з поточною мовою і випадаючий список =====
// ЄДИНЕ МІСЦЕ, ДЕ ЖИВЕ СПИСОК МОВ САЙТУ. Щоб додати нову:
//   1) скопіюйте теку сторінок під новий код (наприклад ua/ -> de/) і
//      перекладіть їх, у <html lang="de"> поставте той самий код;
//   2) додайте <link rel="alternate" hreflang="de" href="..."> у <head>
//      кожної сторінки і рядок у sitemap.xml;
//   3) допишіть один рядок сюди - перемикач збере список сам, на всіх
//      дванадцяти сторінках одразу.
// Автовизначення мови при першому заході живе окремо, у <head> сторінок:
// туди теж треба буде додати нову мову, інакше гість просто побачить
// англійську версію і зможе перемкнутись руками.
var SITE_LANGS = [
  { code: "en", dir: "", label: "EN", name: "English" },
  { code: "uk", dir: "ua", label: "UA", name: "Українська" },
  { code: "pl", dir: "pl", label: "PL", name: "Polski" },
  { code: "de", dir: "de", label: "DE", name: "Deutsch" }
];

(function () {
  var root = document.querySelector("[data-lang-switch]");
  if (!root) return;
  var btn = root.querySelector(".lang__btn");
  var menu = root.querySelector(".lang__menu");
  if (!btn || !menu) return;

  var here = document.documentElement.lang || "en";

  // Ім'я файла і мовна тека, у якій ми зараз. "/ua/" дає порожній хвіст
  // після split, тому файл підставляємо сам.
  var parts = location.pathname.split("/");
  var file = parts.pop() || "index.html";
  var last = parts[parts.length - 1] || "";
  var inDir = "";
  SITE_LANGS.forEach(function (l) { if (l.dir && l.dir === last) inDir = l.dir; });

  function hrefFor(l) {
    if (l.dir === inDir) return file;                       // та сама тека
    return (inDir ? "../" : "") + (l.dir ? l.dir + "/" : "") + file;
  }

  var cur = null;
  var html = "";
  SITE_LANGS.forEach(function (l) {
    var on = l.code === here;
    if (on) cur = l;
    html += '<li><a href="' + hrefFor(l) + '" class="lang__item' + (on ? " is-on" : "") +
            '" hreflang="' + l.code + '" data-lang="' + l.code + '"' +
            (on ? ' aria-current="page"' : "") + '>' + l.name + '</a></li>';
  });
  menu.innerHTML = html;

  var label = btn.querySelector(".lang__cur");
  if (label && cur) label.textContent = cur.label;

  function setOpen(on) {
    root.classList.toggle("is-open", on);
    btn.setAttribute("aria-expanded", on ? "true" : "false");
  }

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    setOpen(!root.classList.contains("is-open"));
  });

  // Клік по поточній мові нічого не міняє - не перезавантажуємо сторінку
  menu.addEventListener("click", function (e) {
    var item = e.target.closest ? e.target.closest(".lang__item") : null;
    if (item && item.classList.contains("is-on")) e.preventDefault();
    setOpen(false);
  });

  document.addEventListener("click", function (e) {
    if (!root.contains(e.target)) setOpen(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && root.classList.contains("is-open")) {
      setOpen(false);
      btn.focus();
    }
  });
})();

// ===== Відгук на дотик =====
// На сенсорному екрані немає наведення: натиснута кнопка чи картка нічим не
// відповідає, і півсекунди до появи нової сторінки виглядають як зависання.
// Тут натиснутий елемент підсвічується на 0.5 с, і аж тоді відбувається
// перехід. Тримаємо тільки свої-таки сторінки: посилання в нову вкладку
// (Telegram, живі сайти) відпускаємо одразу - відкладене вікно браузер
// порахував би за спливаюче і заблокував.
(function () {
  var TAP_MS = 500;
  var SEL = "a[href], button";
  var touch = false;          // останнє натискання було пальцем
  var busy = null;            // елемент, що зараз програє анімацію

  function coarse() {
    return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  }

  function press(el) {
    if (busy === el) return;
    busy = el;
    el.classList.remove("tap-press--out");
    el.classList.add("tap-press");
    setTimeout(function () {
      el.classList.remove("tap-press");
      el.classList.add("tap-press--out");
    }, 150);
    setTimeout(function () {
      el.classList.remove("tap-press--out");
      if (busy === el) busy = null;
    }, TAP_MS);
  }

  // Гортання починається тим самим pointerdown, що й дотик, тож підсвічувати
  // одразу не можна: палець просто торкався картки, щоб прокрутити сторінку,
  // а вона вже блимала. Чекаємо трохи і дивимось, чи палець рушив.
  var ЗАТРИМКА = 120;   // стільки терпимо, перш ніж вважати це дотиком
  var ЗСУВ = 8;         // на стільки зрушив - це вже гортання
  var чекає = 0, кандидат = null, старт = null;

  function скасувати() {
    if (чекає) clearTimeout(чекає);
    чекає = 0;
    кандидат = null;
    старт = null;
  }

  document.addEventListener("pointerdown", function (e) {
    touch = e.pointerType === "touch" || e.pointerType === "pen";
    if (!touch) return;
    var el = e.target.closest ? e.target.closest(SEL) : null;
    if (!el) return;
    скасувати();
    кандидат = el;
    старт = { x: e.clientX, y: e.clientY };
    чекає = setTimeout(function () {
      чекає = 0;
      var ціль = кандидат;
      кандидат = null;
      старт = null;
      if (ціль) press(ціль);
    }, ЗАТРИМКА);
  }, { passive: true, capture: true });

  document.addEventListener("pointermove", function (e) {
    if (!кандидат || !старт) return;
    if (Math.abs(e.clientX - старт.x) > ЗСУВ || Math.abs(e.clientY - старт.y) > ЗСУВ) скасувати();
  }, { passive: true, capture: true });

  // Сторінка поїхала - значить це було гортання, хоч би як мало палець зрушив
  document.addEventListener("scroll", function () { if (кандидат) скасувати(); }, { passive: true, capture: true });
  document.addEventListener("pointercancel", скасувати, { passive: true, capture: true });

  document.addEventListener("click", function (e) {
    if (!touch || !coarse()) return;
    var el = e.target.closest ? e.target.closest(SEL) : null;
    if (!el) return;
    press(el);                                   // якщо pointerdown не спрацював

    if (el.tapGo) { el.tapGo = false; return; }  // це наш власний повторний клік
    if (el.tagName !== "A") return;              // кнопки спрацьовують одразу
    var href = el.getAttribute("href");
    if (!href || href.charAt(0) === "#") return; // якорі веде плавна прокрутка
    if (el.target === "_blank" || el.hasAttribute("download")) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var url;
    try { url = new URL(href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin) return;  // чужий сайт не тримаємо

    // Не женемо location.href самі, а через півсекунди повторюємо той самий
    // клік: так він проходить усі решта обробників заново і будь-хто з них
    // ще може його скасувати - наприклад, вибір мови, яка вже й так увімкнена.
    e.preventDefault();
    setTimeout(function () {
      el.tapGo = true;
      el.click();
    }, TAP_MS);
  }, true);
})();
