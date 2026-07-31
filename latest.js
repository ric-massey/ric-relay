// Curated additions shown by each room's native "latest" banner.
// Newest first. Keep these meaningful: projects and posts, not implementation commits.
window.RELAY_LATEST = [
  {
    date: "2026-07-31",
    kind: "interactive",
    title: "How Speed Affects Time",
    description: "One slider, two clocks, and the real night sky. Fly out at any speed, watch the sky fold into the view ahead, then come home and read what the trip cost you.",
    href: "projects/how-speed-affects-time/index.html",
  },
  {
    date: "2026-07-24",
    kind: "game update",
    title: "Starfield: A Relativistic Rocket",
    description: "Rebuilt on real physics. Burn at one gravity through the actual solar neighbourhood and watch twelve years of your life cross the galaxy.",
    href: "projects/starfield/index.html",
  },
  {
    date: "2026-07-24",
    kind: "interactive",
    title: "FARLIGHT",
    description: "A playable experiment in momentum, contact, and clean landings.",
    href: "projects/farlight/index.html",
  },
  {
    date: "2026-07-23",
    kind: "new room",
    title: "Psyche: Human Systems",
    description: "Mood, criteria, substances, and the imperfect tools we use to understand them.",
    href: "psyche.html",
  },
  {
    date: "2026-07-23",
    kind: "research",
    title: "The Shape of Harm",
    description: "An evidence framework for comparing psychoactive-substance harms without hiding the uncertainty.",
    href: "projects/the-shape-of-harm/start.html",
  },
  {
    date: "2026-07-23",
    kind: "visualization",
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
      const item = items.find((candidate) => {
        const destination = new URL(candidate.href, here);
        return destination.pathname !== here.pathname;
      });
      if (!item) {
        banner.hidden = true;
        return;
      }

      banner.href = item.href;
      banner.setAttribute("aria-label", `Latest addition: ${item.title}`);

      const kicker = document.createElement("span");
      kicker.className = "latest-kicker";
      // The climbing entry already reads as an announcement ("new routes sent"),
      // so it speaks for itself instead of taking the room's prefix.
      kicker.textContent = item === climb
        ? item.kind
        : `${banner.dataset.latestPrefix || "latest"} // ${item.kind}`;

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
