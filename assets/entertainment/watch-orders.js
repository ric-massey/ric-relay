/* Watch orders — the franchises whose story order is not their release order,
   or whose shows belong in among the films. Hand-kept (Ric, 2026-10-31: "look
   up a movie and it tells me the order to watch them. And chronological order
   and the year that they were released").

   Each order is written in STORY order. Release order is not written down
   anywhere: the page sorts the same titles by the release date TMDB gives it
   (by the year here until that has answered), so the two can never disagree
   about which titles are in it.

   An item is [kind, title, year, note]: kind 'm' a film, 't' a show (its year
   is when it first aired); the note is shown beside it and is for where a
   placement needs explaining. The title and year are what /tmdb/find looks
   the item up by, so write the title the way TMDB has it.

   Franchises that run in release order (Bond, Mission: Impossible, Rocky,
   Pirates …) are not here — the page shows them from TMDB's own collection,
   in release order, and says so. Add one here only when the story order
   differs or a show belongs in the run.

   `also` is what a search for the franchise might be typed as. */
window.WATCH_ORDERS = [
  {
    id: 'mcu', name: 'Marvel Cinematic Universe',
    also: ['marvel', 'mcu', 'avengers', 'infinity saga', 'multiverse saga'],
    note: "Films and the Marvel Studios shows on Disney+, in the order Disney+ puts them on its own timeline.",
    items: [
      ['m', 'Captain America: The First Avenger', 2011],
      ['m', 'Captain Marvel', 2019],
      ['m', 'Iron Man', 2008],
      ['m', 'Iron Man 2', 2010],
      ['m', 'The Incredible Hulk', 2008],
      ['m', 'Thor', 2011],
      ['m', 'The Avengers', 2012],
      ['m', 'Iron Man 3', 2013],
      ['m', 'Thor: The Dark World', 2013],
      ['m', 'Captain America: The Winter Soldier', 2014],
      ['m', 'Guardians of the Galaxy', 2014],
      ['m', 'Guardians of the Galaxy Vol. 2', 2017],
      ['m', 'Avengers: Age of Ultron', 2015],
      ['m', 'Ant-Man', 2015],
      ['m', 'Captain America: Civil War', 2016],
      ['m', 'Black Widow', 2021],
      ['m', 'Black Panther', 2018],
      ['m', 'Spider-Man: Homecoming', 2017],
      ['m', 'Doctor Strange', 2016],
      ['m', 'Thor: Ragnarok', 2017],
      ['m', 'Ant-Man and the Wasp', 2018],
      ['m', 'Avengers: Infinity War', 2018],
      ['m', 'Avengers: Endgame', 2019],
      ['t', 'Loki', 2021, 'outside time — starts right after a scene in Endgame'],
      ['t', 'What If...?', 2021, 'animated, across the multiverse'],
      ['t', 'WandaVision', 2021],
      ['m', 'Shang-Chi and the Legend of the Ten Rings', 2021],
      ['t', 'The Falcon and the Winter Soldier', 2021],
      ['m', 'Spider-Man: Far From Home', 2019],
      ['m', 'Eternals', 2021],
      ['m', 'Spider-Man: No Way Home', 2021],
      ['m', 'Doctor Strange in the Multiverse of Madness', 2022],
      ['t', 'Hawkeye', 2021],
      ['t', 'Moon Knight', 2022],
      ['m', 'Black Panther: Wakanda Forever', 2022],
      ['t', 'Echo', 2024],
      ['t', 'She-Hulk: Attorney at Law', 2022],
      ['t', 'Ms. Marvel', 2022],
      ['m', 'Thor: Love and Thunder', 2022],
      ['m', 'Ant-Man and the Wasp: Quantumania', 2023],
      ['m', 'Guardians of the Galaxy Vol. 3', 2023],
      ['t', 'Secret Invasion', 2023],
      ['m', 'The Marvels', 2023],
      ['m', 'Deadpool & Wolverine', 2024],
      ['t', 'Agatha All Along', 2024],
      ['m', 'Captain America: Brave New World', 2025],
      ['t', 'Daredevil: Born Again', 2025],
      ['m', 'Thunderbolts*', 2025],
      ['t', 'Ironheart', 2025],
      ['m', 'The Fantastic Four: First Steps', 2025, 'its own universe until Avengers: Doomsday'],
      ['t', 'Wonder Man', 2026],
      ['m', 'Spider-Man: Brand New Day', 2026],
      ['m', 'Avengers: Doomsday', 2026]
    ]
  },
  {
    id: 'star-wars', name: 'Star Wars',
    also: ['star wars', 'skywalker saga', 'mandalorian', 'jedi'],
    note: 'Films and the live-action and animated shows, in Lucasfilm’s own timeline order.',
    items: [
      ['t', 'The Acolyte', 2024, 'about a hundred years before the films'],
      ['m', 'Star Wars: Episode I - The Phantom Menace', 1999],
      ['m', 'Star Wars: Episode II - Attack of the Clones', 2002],
      ['m', 'Star Wars: The Clone Wars', 2008, 'the film that starts the show'],
      ['t', 'Star Wars: The Clone Wars', 2008],
      ['m', 'Star Wars: Episode III - Revenge of the Sith', 2005],
      ['t', 'Star Wars: The Bad Batch', 2021],
      ['m', 'Solo: A Star Wars Story', 2018],
      ['t', 'Obi-Wan Kenobi', 2022],
      ['t', 'Andor', 2022],
      ['t', 'Star Wars Rebels', 2014],
      ['m', 'Rogue One: A Star Wars Story', 2016],
      ['m', 'Star Wars', 1977, 'Episode IV – A New Hope'],
      ['m', 'The Empire Strikes Back', 1980],
      ['m', 'Return of the Jedi', 1983],
      ['t', 'The Mandalorian', 2019],
      ['t', 'The Book of Boba Fett', 2021, 'between seasons 2 and 3 of The Mandalorian'],
      ['t', 'Star Wars: Skeleton Crew', 2024],
      ['m', 'The Mandalorian and Grogu', 2026],
      ['t', 'Ahsoka', 2023],
      ['m', 'Star Wars: The Force Awakens', 2015],
      ['m', 'Star Wars: The Last Jedi', 2017],
      ['m', 'Star Wars: The Rise of Skywalker', 2019]
    ]
  },
  {
    id: 'wizarding-world', name: 'Harry Potter and Fantastic Beasts',
    also: ['harry potter', 'wizarding world', 'fantastic beasts', 'hogwarts'],
    items: [
      ['m', 'Fantastic Beasts and Where to Find Them', 2016, '1926'],
      ['m', 'Fantastic Beasts: The Crimes of Grindelwald', 2018],
      ['m', 'Fantastic Beasts: The Secrets of Dumbledore', 2022],
      ['m', "Harry Potter and the Philosopher's Stone", 2001, "Sorcerer's Stone in the US"],
      ['m', 'Harry Potter and the Chamber of Secrets', 2002],
      ['m', 'Harry Potter and the Prisoner of Azkaban', 2004],
      ['m', 'Harry Potter and the Goblet of Fire', 2005],
      ['m', 'Harry Potter and the Order of the Phoenix', 2007],
      ['m', 'Harry Potter and the Half-Blood Prince', 2009],
      ['m', 'Harry Potter and the Deathly Hallows: Part 1', 2010],
      ['m', 'Harry Potter and the Deathly Hallows: Part 2', 2011]
    ]
  },
  {
    id: 'middle-earth', name: 'Middle-earth',
    also: ['lord of the rings', 'lotr', 'the hobbit', 'hobbit', 'rings of power', 'tolkien'],
    items: [
      ['t', 'The Lord of the Rings: The Rings of Power', 2022, 'the Second Age, thousands of years before'],
      ['m', 'The Lord of the Rings: The War of the Rohirrim', 2024, 'about 180 years before The Hobbit'],
      ['m', 'The Hobbit: An Unexpected Journey', 2012],
      ['m', 'The Hobbit: The Desolation of Smaug', 2013],
      ['m', 'The Hobbit: The Battle of the Five Armies', 2014],
      ['m', 'The Lord of the Rings: The Fellowship of the Ring', 2001],
      ['m', 'The Lord of the Rings: The Two Towers', 2002],
      ['m', 'The Lord of the Rings: The Return of the King', 2003]
    ]
  },
  {
    id: 'x-men', name: 'X-Men',
    also: ['x-men', 'xmen', 'wolverine', 'deadpool', 'mutants'],
    note: 'Days of Future Past rewrites the timeline, so no order is perfect — this is the one most people use.',
    items: [
      ['m', 'X-Men: First Class', 2011, '1962'],
      ['m', 'X-Men Origins: Wolverine', 2009],
      ['m', 'X-Men: Apocalypse', 2016, '1983'],
      ['m', 'Dark Phoenix', 2019, '1992'],
      ['m', 'X-Men', 2000],
      ['m', 'X2', 2003],
      ['m', 'X-Men: The Last Stand', 2006],
      ['m', 'The Wolverine', 2013],
      ['m', 'X-Men: Days of Future Past', 2014],
      ['m', 'Deadpool', 2016],
      ['m', 'Deadpool 2', 2018],
      ['m', 'Logan', 2017, '2029'],
      ['m', 'Deadpool & Wolverine', 2024, 'also part of the MCU']
    ]
  },
  {
    id: 'fast-furious', name: 'Fast & Furious',
    also: ['fast and furious', 'fast & furious', 'fast furious', 'furious', 'tokyo drift'],
    items: [
      ['m', 'The Fast and the Furious', 2001],
      ['m', '2 Fast 2 Furious', 2003],
      ['m', 'Fast & Furious', 2009],
      ['m', 'Fast Five', 2011],
      ['m', 'Fast & Furious 6', 2013],
      ['m', 'The Fast and the Furious: Tokyo Drift', 2006, 'set after 6 — Han is alive in 4 to 6 for a reason'],
      ['m', 'Furious 7', 2015],
      ['m', 'The Fate of the Furious', 2017],
      ['m', 'Fast & Furious Presents: Hobbs & Shaw', 2019],
      ['m', 'F9', 2021],
      ['m', 'Fast X', 2023]
    ]
  },
  {
    id: 'conjuring', name: 'The Conjuring Universe',
    also: ['conjuring', 'annabelle', 'the nun', 'la llorona', 'warrens'],
    items: [
      ['m', 'The Nun', 2018, '1952'],
      ['m', 'Annabelle: Creation', 2017, '1955'],
      ['m', 'The Nun II', 2023, '1956'],
      ['m', 'Annabelle', 2014, '1967'],
      ['m', 'The Conjuring', 2013, '1971'],
      ['m', 'Annabelle Comes Home', 2019, '1972'],
      ['m', 'The Curse of La Llorona', 2019, '1973'],
      ['m', 'The Conjuring 2', 2016, '1977'],
      ['m', 'The Conjuring: The Devil Made Me Do It', 2021, '1981'],
      ['m', 'The Conjuring: Last Rites', 2025, '1986']
    ]
  },
  {
    id: 'alien', name: 'Alien',
    also: ['alien', 'aliens', 'xenomorph', 'prometheus'],
    items: [
      ['m', 'Prometheus', 2012],
      ['m', 'Alien: Covenant', 2017],
      ['t', 'Alien: Earth', 2025, 'two years before Alien'],
      ['m', 'Alien', 1979],
      ['m', 'Alien: Romulus', 2024, 'between Alien and Aliens'],
      ['m', 'Aliens', 1986],
      ['m', 'Alien³', 1992],
      ['m', 'Alien Resurrection', 1997]
    ]
  },
  {
    id: 'predator', name: 'Predator',
    also: ['predator', 'prey'],
    items: [
      ['m', 'Predator: Killer of Killers', 2025, 'three stories, from 841 to 1942'],
      ['m', 'Prey', 2022, '1719'],
      ['m', 'Predator', 1987],
      ['m', 'Predator 2', 1990],
      ['m', 'Predators', 2010],
      ['m', 'The Predator', 2018],
      ['m', 'Predator: Badlands', 2025, 'far in the future']
    ]
  },
  {
    id: 'jurassic', name: 'Jurassic Park and Jurassic World',
    also: ['jurassic', 'jurassic park', 'jurassic world', 'dinosaurs'],
    items: [
      ['m', 'Jurassic Park', 1993],
      ['m', 'The Lost World: Jurassic Park', 1997],
      ['m', 'Jurassic Park III', 2001],
      ['m', 'Jurassic World', 2015],
      ['t', 'Jurassic World: Camp Cretaceous', 2020, 'during Jurassic World, and after'],
      ['m', 'Jurassic World: Fallen Kingdom', 2018],
      ['t', 'Jurassic World: Chaos Theory', 2024],
      ['m', 'Jurassic World Dominion', 2022],
      ['m', 'Jurassic World Rebirth', 2025]
    ]
  },
  {
    id: 'monsterverse', name: 'The MonsterVerse',
    also: ['monsterverse', 'godzilla', 'kong', 'king kong', 'monarch'],
    items: [
      ['m', 'Kong: Skull Island', 2017, '1973'],
      ['m', 'Godzilla', 2014],
      ['t', 'Monarch: Legacy of Monsters', 2023, 'the 1950s and right after Godzilla'],
      ['m', 'Godzilla: King of the Monsters', 2019],
      ['m', 'Godzilla vs. Kong', 2021],
      ['m', 'Godzilla x Kong: The New Empire', 2024]
    ]
  },
  {
    id: 'john-wick', name: 'John Wick',
    also: ['john wick', 'wick', 'continental', 'ballerina'],
    items: [
      ['t', 'The Continental: From the World of John Wick', 2023, 'the 1970s'],
      ['m', 'John Wick', 2014],
      ['m', 'John Wick: Chapter 2', 2017],
      ['m', 'John Wick: Chapter 3 - Parabellum', 2019],
      ['m', 'Ballerina', 2025, 'during Chapter 3'],
      ['m', 'John Wick: Chapter 4', 2023]
    ]
  },
  {
    id: 'dceu', name: 'DC Extended Universe',
    also: ['dc', 'dceu', 'justice league', 'snyderverse', 'wonder woman', 'aquaman', 'shazam'],
    note: 'The films from Man of Steel to Aquaman 2. James Gunn’s DC Universe is its own order.',
    items: [
      ['m', 'Wonder Woman', 2017, '1918'],
      ['m', 'Wonder Woman 1984', 2020],
      ['m', 'Man of Steel', 2013],
      ['m', 'Batman v Superman: Dawn of Justice', 2016],
      ['m', 'Suicide Squad', 2016],
      ['m', "Zack Snyder's Justice League", 2021, 'or the 2017 cut, Justice League'],
      ['m', 'Aquaman', 2018],
      ['m', 'Shazam!', 2019],
      ['m', 'Birds of Prey', 2020],
      ['m', 'The Suicide Squad', 2021],
      ['t', 'Peacemaker', 2022],
      ['m', 'Black Adam', 2022],
      ['m', 'Shazam! Fury of the Gods', 2023],
      ['m', 'The Flash', 2023],
      ['m', 'Blue Beetle', 2023],
      ['m', 'Aquaman and the Lost Kingdom', 2023]
    ]
  },
  {
    id: 'dcu', name: 'DC Universe',
    also: ['dcu', 'superman', 'supergirl', 'creature commandos', 'james gunn'],
    note: 'James Gunn’s DC, from 2024. Peacemaker’s second season belongs here too.',
    items: [
      ['t', 'Creature Commandos', 2024],
      ['m', 'Superman', 2025],
      ['t', 'Peacemaker', 2022, 'season 2'],
      ['m', 'Supergirl', 2026]
    ]
  },
  {
    id: 'the-batman', name: 'The Batman (Matt Reeves)',
    also: ['the batman', 'batman', 'penguin'],
    items: [
      ['m', 'The Batman', 2022],
      ['t', 'The Penguin', 2024]
    ]
  },
  {
    id: 'despicable-me', name: 'Despicable Me and Minions',
    also: ['despicable me', 'minions', 'gru'],
    items: [
      ['m', 'Minions', 2015, '1968'],
      ['m', 'Minions: The Rise of Gru', 2022, '1976'],
      ['m', 'Despicable Me', 2010],
      ['m', 'Despicable Me 2', 2013],
      ['m', 'Despicable Me 3', 2017],
      ['m', 'Despicable Me 4', 2024]
    ]
  },
  {
    id: 'hunger-games', name: 'The Hunger Games',
    also: ['hunger games', 'mockingjay', 'catching fire', 'panem'],
    items: [
      ['m', 'The Hunger Games: The Ballad of Songbirds & Snakes', 2023, '64 years before'],
      ['m', 'The Hunger Games: Sunrise on the Reaping', 2026, '24 years before'],
      ['m', 'The Hunger Games', 2012],
      ['m', 'The Hunger Games: Catching Fire', 2013],
      ['m', 'The Hunger Games: Mockingjay - Part 1', 2014],
      ['m', 'The Hunger Games: Mockingjay - Part 2', 2015]
    ]
  },
  {
    id: 'indiana-jones', name: 'Indiana Jones',
    also: ['indiana jones', 'indy'],
    items: [
      ['m', 'Indiana Jones and the Temple of Doom', 1984, '1935 — a year before Raiders'],
      ['m', 'Raiders of the Lost Ark', 1981, '1936'],
      ['m', 'Indiana Jones and the Last Crusade', 1989, '1938'],
      ['m', 'Indiana Jones and the Kingdom of the Crystal Skull', 2008, '1957'],
      ['m', 'Indiana Jones and the Dial of Destiny', 2023, '1969']
    ]
  },
  {
    id: 'mad-max', name: 'Mad Max',
    also: ['mad max', 'furiosa', 'fury road'],
    items: [
      ['m', 'Mad Max', 1979],
      ['m', 'Mad Max 2', 1981, 'The Road Warrior'],
      ['m', 'Mad Max Beyond Thunderdome', 1985],
      ['m', 'Furiosa: A Mad Max Saga', 2024],
      ['m', 'Mad Max: Fury Road', 2015]
    ]
  },
  {
    id: 'saw', name: 'Saw',
    also: ['saw', 'jigsaw', 'spiral'],
    items: [
      ['m', 'Saw', 2004],
      ['m', 'Saw X', 2023, 'between Saw and Saw II'],
      ['m', 'Saw II', 2005],
      ['m', 'Saw III', 2006],
      ['m', 'Saw IV', 2007, 'runs alongside Saw III'],
      ['m', 'Saw V', 2008],
      ['m', 'Saw VI', 2009],
      ['m', 'Saw 3D', 2010],
      ['m', 'Jigsaw', 2017],
      ['m', 'Spiral', 2021]
    ]
  },
  {
    id: 'insidious', name: 'Insidious',
    also: ['insidious', 'the further'],
    items: [
      ['m', 'Insidious: Chapter 3', 2015],
      ['m', 'Insidious: The Last Key', 2018],
      ['m', 'Insidious', 2010],
      ['m', 'Insidious: Chapter 2', 2013],
      ['m', 'Insidious: The Red Door', 2023]
    ]
  },
  {
    id: 'purge', name: 'The Purge',
    also: ['purge', 'the purge'],
    items: [
      ['m', 'The First Purge', 2018],
      ['m', 'The Purge', 2013],
      ['m', 'The Purge: Anarchy', 2014],
      ['m', 'The Purge: Election Year', 2016],
      ['m', 'The Forever Purge', 2021]
    ]
  },
  {
    id: 'final-destination', name: 'Final Destination',
    also: ['final destination'],
    items: [
      ['m', 'Final Destination 5', 2011, 'a prequel — its ending says so'],
      ['m', 'Final Destination', 2000],
      ['m', 'Final Destination 2', 2003],
      ['m', 'Final Destination 3', 2006],
      ['m', 'The Final Destination', 2009],
      ['m', 'Final Destination Bloodlines', 2025]
    ]
  },
  {
    id: 'transformers', name: 'Transformers',
    also: ['transformers', 'bumblebee', 'optimus prime'],
    items: [
      ['m', 'Transformers One', 2024, 'on Cybertron, long before'],
      ['m', 'Bumblebee', 2018, '1987'],
      ['m', 'Transformers: Rise of the Beasts', 2023, '1994'],
      ['m', 'Transformers', 2007],
      ['m', 'Transformers: Revenge of the Fallen', 2009],
      ['m', 'Transformers: Dark of the Moon', 2011],
      ['m', 'Transformers: Age of Extinction', 2014],
      ['m', 'Transformers: The Last Knight', 2017]
    ]
  },
  {
    id: 'kingsman', name: 'Kingsman',
    also: ['kingsman'],
    items: [
      ['m', "The King's Man", 2021, 'the First World War'],
      ['m', 'Kingsman: The Secret Service', 2014],
      ['m', 'Kingsman: The Golden Circle', 2017]
    ]
  },
  {
    id: 'shrek', name: 'Shrek',
    also: ['shrek', 'puss in boots'],
    items: [
      ['m', 'Puss in Boots', 2011, 'before he meets Shrek'],
      ['m', 'Shrek', 2001],
      ['m', 'Shrek 2', 2004],
      ['m', 'Shrek the Third', 2007],
      ['m', 'Shrek Forever After', 2010],
      ['m', 'Puss in Boots: The Last Wish', 2022]
    ]
  },
  {
    id: 'breaking-bad', name: 'Breaking Bad',
    also: ['breaking bad', 'better call saul', 'el camino', 'heisenberg'],
    items: [
      ['t', 'Better Call Saul', 2015, 'mostly before — its last season runs past the end of Breaking Bad'],
      ['t', 'Breaking Bad', 2008],
      ['m', 'El Camino: A Breaking Bad Movie', 2019]
    ]
  },
  {
    id: 'westeros', name: 'Game of Thrones',
    also: ['game of thrones', 'got', 'house of the dragon', 'westeros', 'knight of the seven kingdoms'],
    items: [
      ['t', 'House of the Dragon', 2022, 'about 170 years before'],
      ['t', 'A Knight of the Seven Kingdoms', 2026, 'about 90 years before'],
      ['t', 'Game of Thrones', 2011]
    ]
  },
  {
    id: 'yellowstone', name: 'Yellowstone',
    also: ['yellowstone', 'dutton', '1883', '1923'],
    items: [
      ['t', '1883', 2021],
      ['t', '1923', 2022],
      ['t', 'Yellowstone', 2018]
    ]
  },
  {
    id: 'dexter', name: 'Dexter',
    also: ['dexter'],
    items: [
      ['t', 'Dexter: Original Sin', 2024, '1991'],
      ['t', 'Dexter', 2006],
      ['t', 'Dexter: New Blood', 2021],
      ['t', 'Dexter: Resurrection', 2025]
    ]
  },
  {
    id: 'the-boys', name: 'The Boys',
    also: ['the boys', 'gen v', 'vought'],
    items: [
      ['t', 'The Boys', 2019, 'seasons 1 to 3'],
      ['t', 'Gen V', 2023, 'season 1, before The Boys season 4'],
      ['t', 'The Boys', 2019, 'season 4 on']
    ]
  },
  {
    id: 'sopranos', name: 'The Sopranos',
    also: ['sopranos', 'many saints of newark'],
    items: [
      ['m', 'The Many Saints of Newark', 2021, 'the 1960s and 70s'],
      ['t', 'The Sopranos', 1999]
    ]
  }
];
