// Curated additions shown by each room's native "latest" banner.
// Newest first. Keep these meaningful: projects and posts, not implementation commits.
//
// `room` is which room the item belongs to. There is one global newest item and
// every room shows it, so a room only gets to use its own flavoured wording when
// the item is actually its own — see data-latest-prefix-own below. Set it.
// Held back on purpose, not forgotten — "How Big Everything Is" is live at
// projects/how-big-everything-is/ and linked from Exploration, but it is not
// being announced yet. Every room's banner shows the newest entry in this
// list, so putting it back at the top is the whole of "announce it".
//   {
//     date: "2026-08-01",
//     kind: "interactive",
//     room: "exploration",
//     title: "How Big Everything Is",
//     description: "One rail from an electron to the observable universe, everything on it drawn to the same scale. Zoom out and watch each thing you were just looking at collapse into a speck next to the next one.",
//     href: "projects/how-big-everything-is/index.html",
//   },
window.RELAY_LATEST = [
  {
    date: "2026-08-17",
    kind: "new room",
    room: "training",
    title: "The Training Log",
    description: "A year of climbing and running, planned to the day and ticked off from wherever it actually happens. Fifty-two weeks, a calendar you can walk through, and every session opening onto what to do.",
    href: "training.html",
  },
  {
    date: "2026-08-04",
    kind: "interactive",
    room: "workbench",
    title: "CROSSFIRE",
    description: "Asteroids, with walls. Share one pile of lives against the rocks, or fight it out on a map sixteen screens wide while the wall closes in around you.",
    href: "projects/crossfire/index.html",
  },
  {
    date: "2026-07-31",
    kind: "interactive",
    room: "exploration",
    title: "How Speed Affects Time",
    description: "One slider, two clocks, and the real night sky. Fly out at any speed, watch the sky fold into the view ahead, then come home and read what the trip cost you.",
    href: "projects/how-speed-affects-time/index.html",
  },
  {
    date: "2026-07-24",
    kind: "game update",
    room: "exploration",
    title: "Starfield: A Relativistic Rocket",
    description: "Rebuilt on real physics. Burn at one gravity through the actual solar neighborhood and watch twelve years of your life cross the galaxy.",
    href: "projects/starfield/index.html",
  },
  {
    date: "2026-07-24",
    kind: "interactive",
    room: "workbench",
    title: "FARLIGHT",
    description: "A playable experiment in momentum, contact, and clean landings.",
    href: "projects/farlight/index.html",
  },
  {
    date: "2026-07-23",
    kind: "new room",
    room: "psyche",
    title: "Psyche: Human Systems",
    description: "Mood, criteria, substances, and the imperfect tools we use to understand them.",
    href: "psyche.html",
  },
  {
    date: "2026-07-23",
    kind: "research",
    room: "psyche",
    title: "The Shape of Harm",
    description: "An evidence framework for comparing psychoactive-substance harms without hiding the uncertainty.",
    href: "projects/the-shape-of-harm/start.html",
  },
  {
    date: "2026-07-23",
    kind: "visualization",
    room: "psyche",
    title: "State-of-Mind Line",
    description: "An animated model of bipolar mood patterns moving through time.",
    href: "projects/state-of-mind-line/index.html",
  },
];

(() => {
  function installLatestBanners() {
    const curated = Array.isArray(window.RELAY_LATEST) ? window.RELAY_LATEST : [];
    // projects/climbing/latest-climb.js is regenerated from climbs.md, so the
    // newest day out announces itself without anyone editing this list.
    const climb = window.RELAY_LATEST_CLIMB;
    const items = (climb ? [climb, ...curated] : curated)
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    // The terminal's `latest` command reads this too, so both agree on what's newest.
    window.RELAY_LATEST_ALL = items;
    const here = new URL(location.href);

    document.querySelectorAll("[data-latest-banner]").forEach((banner) => {
      // data-latest-skip-linked (opt-in): don't announce something the
      // page already puts in front of the reader. /exploration lists all
      // three of its own projects, so the newest one was printed twice —
      // once as the banner, once as the card immediately beneath it.
      // Nav links don't count: being able to walk to a room is not the
      // same as being told it changed. Rooms that want the banner to
      // repeat one of their own entries simply don't set the attribute.
      const linked = banner.hasAttribute("data-latest-skip-linked")
        ? new Set(
            Array.from(document.querySelectorAll("a[href]"))
              .filter((link) => link !== banner && !link.closest("nav"))
              .map((link) => new URL(link.getAttribute("href"), here).pathname)
          )
        : null;

      const item = items.find((candidate) => {
        const destination = new URL(candidate.href, here);
        if (destination.pathname === here.pathname) return false;
        return !linked || !linked.has(destination.pathname);
      });
      if (!item) {
        banner.hidden = true;
        return;
      }

      banner.href = item.href;
      banner.setAttribute("aria-label", `Latest addition: ${item.title}`);

      const kicker = document.createElement("span");
      kicker.className = "latest-kicker";
      // Two prefixes per banner:
      //   data-latest-prefix      always safe — used for anything from anywhere
      //   data-latest-prefix-own  the room's own wording, ONLY for its own items
      //                           (pair it with data-latest-room)
      // The banner shows the newest thing on the whole site, not this room's
      // newest, so an unguarded flavoured prefix lies: /climbing announced a
      // relativity explainer as a "new route", /captures called it a "fresh
      // frame". If it isn't this room's item, fall back to the plain prefix.
      const ownsItem = banner.dataset.latestRoom && item.room === banner.dataset.latestRoom;
      const prefix = (ownsItem && banner.dataset.latestPrefixOwn)
        || banner.dataset.latestPrefix
        || "latest";
      // The climbing entry already reads as an announcement ("new routes sent"),
      // so it speaks for itself instead of taking the room's prefix.
      kicker.textContent = item === climb ? item.kind : `${prefix} // ${item.kind}`;

      const title = document.createElement("strong");
      title.className = "latest-title";
      title.textContent = item.title;

      const description = document.createElement("span");
      description.className = "latest-description";
      description.textContent = item.description;

      const meta = document.createElement("span");
      meta.className = "latest-meta";
      const time = document.createElement("time");
      time.dateTime = item.date;
      time.textContent = item.date;
      const arrow = document.createElement("span");
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "open →";
      meta.append(time, arrow);

      banner.replaceChildren(kicker, title, description, meta);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installLatestBanners, { once: true });
  } else {
    installLatestBanners();
  }
})();
