/* City Life - data tables for the single-player explorer. Edit these to tune or
   re-theme the game: venue categories, busyness curves, zones, townsfolk
   schedules and weekly events. */
(function (CL) {
  CL.CONFIG = {
    title: "City Life: Inner West",
    saveKey: "citylife-explore-v2",
    speeds: [0, 1, 4, 12],            // game-minutes per real second (clock only)
    startMinutes: 5 * 1440 + 9 * 60,  // Saturday 9am (market day)
    walkSpeed: 7,                     // player metres per real second on the street
    runSpeed: 18,                     // holding Shift
    npcSpeed: 75,                     // townsfolk metres per game-minute
    insideSpeed: 4.5,                 // tiles per real second indoors
    discoverRadius: 70,               // metres
    arriveRadius: 22,                 // metres: close enough to count as "at" a place
  };

  /* ---------- things you can do at a place ----------
     id: { e: emoji, l: label, min: game-minutes it takes, say: what happens ({place} = its name),
           ev: event tag that must be on, from/to: only between these hours } */
  CL.ACTIVITIES = {
    coffee:     { e: "☕", l: "Order a coffee", min: 12, say: "You order a flat white at {place} and grab a stool by the window. It's good - properly hot, not burnt." },
    pastry:     { e: "🥐", l: "Grab a pastry", min: 8, say: "Something flaky from the cabinet at {place}. Crumbs everywhere." },
    sitread:    { e: "📖", l: "Sit and read", min: 45, say: "You find a quiet corner at {place} and lose three-quarters of an hour to a book." },
    barista:    { e: "💬", l: "Chat to the barista", min: 6, say: "The barista at {place} has opinions about the new roaster and is happy to share them." },
    drink:      { e: "🍺", l: "Have a schooner", min: 40, say: "A cold schooner at {place}. The front bar hums along around you." },
    pubmeal:    { e: "🍔", l: "Pub meal", min: 45, say: "Schnitzel, chips, a bit of salad nobody eats. Classic {place}." },
    trivia:     { e: "🧠", l: "Join the trivia", min: 90, say: "You slot into a team at {place}. You get the sport round wrong and the 90s music round right.", ev: "trivia" },
    dance:      { e: "💃", l: "Dance", min: 40, say: "The DJ at {place} finds the right song and the floor fills.", from: 20, to: 27 },
    cocktail:   { e: "🍸", l: "Order a cocktail", min: 35, say: "The bartender at {place} makes a very serious negroni." },
    bartender:  { e: "💬", l: "Chat to the bartender", min: 8, say: "The bartender at {place} tells you who's playing on the weekend and which tap's just been changed." },
    eatin:      { e: "🍽️", l: "Eat in", min: 50, say: "You get a table at {place} and order more than you should." },
    takeaway:   { e: "🥡", l: "Get takeaway", min: 15, say: "Takeaway from {place}, eaten on the walk. Worth it." },
    picnic:     { e: "🧺", l: "Lie on the grass", min: 40, say: "You stretch out on the grass at {place} and watch the clouds and the dogs." },
    jog:        { e: "🏃", l: "Go for a jog", min: 25, say: "A couple of laps of {place}. Everyone else is faster than you." },
    peoplewatch:{ e: "👀", l: "People-watch", min: 20, say: "You grab a spot at {place} and watch the world go by." },
    study:      { e: "📝", l: "Find a desk", min: 60, say: "You find a desk at {place}. An hour passes in the good kind of silence." },
    stacks:     { e: "📚", l: "Browse the stacks", min: 25, say: "You wander the stacks at {place} and come out with something you weren't looking for." },
    workout:    { e: "🏋️", l: "Work out", min: 50, say: "A solid session at {place}. You'll feel it tomorrow." },
    swim:       { e: "🏊", l: "Swim a few laps", min: 35, say: "Lap lanes at {place}. The water's colder than the sign says." },
    groceries:  { e: "🛒", l: "Pick up groceries", min: 20, say: "A basket of bits from {place}. You forget the one thing you came for." },
    browseart:  { e: "🖼️", l: "Look at the art", min: 35, say: "You take your time with the work at {place}. One piece stays with you." },
    opening:    { e: "🥂", l: "Go to the opening", min: 60, say: "Wine, artists, a crowd spilling onto the footpath at {place}.", ev: "opening" },
    explore:    { e: "🏺", l: "Explore the exhibits", min: 45, say: "Antiquities, natural history and a few very odd objects at {place}." },
    stalls:     { e: "🧺", l: "Browse the stalls", min: 45, say: "Records, ceramics, vintage denim and a man selling hot sauce at {place}.", ev: "market" },
    streetfood: { e: "🥟", l: "Street food", min: 20, say: "Dumplings from a stall at {place}, eaten standing up." },
    gig:        { e: "🎸", l: "See the gig", min: 120, say: "The band at {place} is loud and tight, and the crowd knows every word.", ev: "gig" },
    show:       { e: "🎭", l: "Catch a show", min: 120, say: "The lights go down at {place}. Two hours later you're still thinking about it.", from: 18, to: 23 },
    movie:      { e: "🎬", l: "Watch a film", min: 120, say: "A film at {place}, with a choc top." },
    books:      { e: "📖", l: "Browse books", min: 30, say: "The staff picks at {place} are dangerously good. You leave with two." },
    browse:     { e: "🛍️", l: "Browse", min: 20, say: "You poke around {place}. Nearly buy something." },
    lawn:       { e: "🌿", l: "Sit on the lawn", min: 30, say: "You sit on the lawn at {place} with everyone else who has a free period." },
    lookaround: { e: "📸", l: "Have a look around", min: 15, say: "You take in {place} properly for once." },
    carillon:   { e: "🔔", l: "Listen to the carillon", min: 45, say: "The bells ring out over {place}. People stop mid-sentence to listen.", ev: "*" },
  };

  /* ---------- venue categories ----------
     capacity: people inside (busyness); curve: busyness profile; price: default priceLevel 0-4;
     hours: default when no real hours are known; things: CL.ACTIVITIES ids shown on the card */
  CL.CATEGORIES = {
    home        : { label: "Home", icon: "🏠", things: [], capacity: 6, curve: "none", price: 0, hours: null },
    cafe        : { label: "Cafe", icon: "☕", things: ["coffee","pastry","sitread","barista"], capacity: 12, curve: "cafe", price: 2, hours: "Mo-Fr 7-15; Sa,Su 8-15" },
    pub         : { label: "Pub", icon: "🍺", things: ["drink","pubmeal","trivia","dance","bartender"], capacity: 40, curve: "pub", price: 2, hours: "Mo-Sa 11-24; Su 11-22" },
    bar         : { label: "Bar", icon: "🍸", things: ["cocktail","dance","bartender"], capacity: 30, curve: "bar", price: 3, hours: "Tu-Su 16-24" },
    restaurant  : { label: "Restaurant", icon: "🍽️", things: ["eatin","takeaway"], capacity: 24, curve: "restaurant", price: 2, hours: "Mo-Su 11.5-22" },
    park        : { label: "Park", icon: "🌳", things: ["picnic","jog","peoplewatch"], capacity: 200, curve: "park", price: 0, hours: null },
    library     : { label: "Library", icon: "📚", things: ["study","stacks"], capacity: 150, curve: "library", price: 0, hours: "Mo-Fr 8-22; Sa,Su 10-18" },
    gym         : { label: "Gym", icon: "🏋️", things: ["workout","swim"], capacity: 35, curve: "gym", price: 2, hours: "Mo-Fr 5.5-22; Sa,Su 7-19" },
    supermarket : { label: "Supermarket", icon: "🛒", things: ["groceries"], capacity: 80, curve: "shop", price: 1, hours: "Mo-Su 7-22" },
    laundromat  : { label: "Laundromat", icon: "🧺", things: ["peoplewatch"], capacity: 10, curve: "shop", price: 1, hours: "Mo-Su 6-22" },
    gallery     : { label: "Gallery", icon: "🖼️", things: ["browseart","opening"], capacity: 60, curve: "gallery", price: 0, hours: "We-Su 10-17" },
    museum      : { label: "Museum", icon: "🏛️", things: ["explore"], capacity: 120, curve: "gallery", price: 0, hours: "Mo-Fr 10-17; Sa,Su 12-16" },
    market      : { label: "Market", icon: "🧺", things: ["stalls","streetfood"], capacity: 300, curve: "market", price: 1, hours: "Sa 10-16" },
    fishmarket  : { label: "Fish market", icon: "🐟", things: ["streetfood","lookaround"], capacity: 200, curve: "market", price: 2, hours: "Mo-Su 7-16" },
    livemusic   : { label: "Live music venue", icon: "🎸", things: ["gig","show"], capacity: 400, curve: "bar", price: 3, hours: "Mo-Su 18-24" },
    cinema      : { label: "Cinema", icon: "🎬", things: ["movie"], capacity: 150, curve: "restaurant", price: 2, hours: "Mo-Su 10-23.5" },
    theatre     : { label: "Theatre", icon: "🎭", things: ["show"], capacity: 300, curve: "bar", price: 3, hours: "Tu-Su 17-23" },
    bookshop    : { label: "Bookshop", icon: "📖", things: ["books"], capacity: 25, curve: "shop", price: 1, hours: "Mo-Sa 9.5-21; Su 10-19" },
    vintageshop : { label: "Vintage shop", icon: "🏺", things: ["browse"], capacity: 15, curve: "shop", price: 2, hours: "Mo-Su 10-18" },
    shop        : { label: "Shop", icon: "🛍️", things: ["browse"], capacity: 20, curve: "shop", price: 1, hours: "Mo-Su 10-18" },
    campus      : { label: "Campus", icon: "🎓", things: ["lawn","peoplewatch","lookaround"], capacity: 500, curve: "library", price: 0, hours: null },
    landmark    : { label: "Landmark", icon: "📍", things: ["lookaround"], capacity: 200, curve: "park", price: 0, hours: null },
  };

  // Busyness 0..1 by hour of day
  const H = arr => arr;
  CL.BUSY = {
    none:       H(new Array(24).fill(0)),
    cafe:       H([0, 0, 0, 0, 0, 0, .15, .55, .95, .8, .6, .55, .7, .55, .35, .2, .1, 0, 0, 0, 0, 0, 0, 0]),
    pub:        H([.1, .05, 0, 0, 0, 0, 0, 0, 0, 0, .05, .15, .35, .3, .2, .2, .35, .6, .75, .8, .85, .95, .8, .45]),
    bar:        H([.35, .15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, .05, .05, .05, .1, .2, .35, .5, .65, .8, .95, 1, .7]),
    restaurant: H([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, .05, .3, .75, .6, .2, .1, .15, .45, .85, .95, .7, .35, .15, .05]),
    park:       H([0, 0, 0, 0, 0, .05, .25, .35, .3, .3, .35, .45, .55, .5, .45, .5, .55, .5, .35, .2, .1, .05, 0, 0]),
    library:    H([0, 0, 0, 0, 0, 0, 0, 0, .2, .45, .7, .8, .75, .85, .8, .7, .55, .4, .35, .3, .25, .15, 0, 0]),
    gym:        H([0, 0, 0, 0, 0, .3, .8, .7, .4, .25, .2, .3, .45, .3, .2, .3, .5, .9, 1, .75, .45, .2, 0, 0]),
    shop:       H([0, 0, 0, 0, 0, 0, 0, .15, .25, .4, .5, .6, .7, .6, .55, .55, .65, .8, .6, .4, .25, .15, 0, 0]),
    gallery:    H([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, .2, .35, .45, .55, .6, .5, .3, .3, .5, .6, .3, 0, 0, 0]),
    market:     H([0, 0, 0, 0, 0, 0, 0, .2, .4, .6, .85, 1, 1, .9, .7, .45, .2, 0, 0, 0, 0, 0, 0, 0]),
  };
  CL.PLACES_PRICE = { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };

  // Places API primaryType -> game category (anything unlisted is ignored)
  CL.PLACES_TYPES = {
    cafe: "cafe", coffee_shop: "cafe", bakery: "cafe", tea_house: "cafe",
    bar: "bar", night_club: "bar", wine_bar: "bar", cocktail_bar: "bar", pub: "pub", irish_pub: "pub", brewery: "pub",
    restaurant: "restaurant", meal_takeaway: "restaurant", fast_food_restaurant: "restaurant", thai_restaurant: "restaurant",
    vietnamese_restaurant: "restaurant", italian_restaurant: "restaurant", japanese_restaurant: "restaurant", pizza_restaurant: "restaurant",
    chinese_restaurant: "restaurant", indian_restaurant: "restaurant", lebanese_restaurant: "restaurant", sushi_restaurant: "restaurant",
    park: "park", dog_park: "park", playground: "park", garden: "park",
    library: "library", university: "campus",
    gym: "gym", fitness_center: "gym", yoga_studio: "gym",
    supermarket: "supermarket", grocery_store: "supermarket", convenience_store: "supermarket",
    laundry: "laundromat",
    art_gallery: "gallery", museum: "museum", market: "market",
    movie_theater: "cinema", performing_arts_theater: "theatre", concert_hall: "livemusic", live_music_venue: "livemusic",
    book_store: "bookshop", clothing_store: "shop", thrift_store: "vintageshop", gift_shop: "shop",
  };
  // Nearby Search: one request per zone, this type list (max 50 types per request)
  CL.NEARBY_TYPES = ["cafe", "coffee_shop", "bar", "pub", "restaurant", "park", "library", "gym", "supermarket", "laundry",
    "art_gallery", "museum", "market", "movie_theater", "performing_arts_theater", "book_store", "thrift_store"];

  CL.ZONES = {
    camperdown:  { label: "Camperdown & USyd", lat: -33.8878, lng: 151.1830, r: 900 },
    newtown:     { label: "Newtown & Enmore", lat: -33.8985, lng: 151.1770, r: 900 },
    glebe:       { label: "Glebe & Forest Lodge", lat: -33.8800, lng: 151.1850, r: 900 },
    chippendale: { label: "Chippendale & Darlington", lat: -33.8875, lng: 151.1985, r: 800 },
    pyrmont:     { label: "Pyrmont, Ultimo & Darling Harbour", lat: -33.8700, lng: 151.1940, r: 900 },
  };

  /* ---------- NPCs: regulars + staff with weekly schedules ----------
     sched: [days, fromHour, toHour, venueId] - first match wins, otherwise home */
  CL.NPCS = [
    { id: "n:priya", name: "Priya", role: "Barista", shirt: "#7b2cbf", skin: "#a0673c", hair: "#1a1a1a", home: [-33.8985, 151.1805],
      sched: [["Mo-Su", 6.5, 15, "newtown-cafe-cafe-newtown"]] },
    { id: "n:tom", name: "Tom", role: "Bartender", shirt: "#1b4332", skin: "#f1c27d", hair: "#6b4226", home: [-33.8905, 151.1995],
      sched: [["Tu-Sa", 16, 24, "chippendale-pub-old-clare"]] },
    { id: "n:kieran", name: "Kieran", role: "Bartender", shirt: "#9d0208", skin: "#ffdbac", hair: "#b5651d", home: [-33.8790, 151.1880],
      sched: [["Mo-Su", 15, 24, "glebe-pub-friend-in-hand"]] },
    { id: "n:june", name: "June", role: "Librarian", shirt: "#344e41", skin: "#8d5524", hair: "#dddddd", home: [-33.8835, 151.1830],
      sched: [["Mo-Fr", 8, 17, "camperdown-usyd-fisher"]] },
    { id: "n:lena", name: "Lena", role: "Gallery attendant", shirt: "#e63946", skin: "#f1c27d", hair: "#222", home: [-33.8880, 151.2010],
      sched: [["We-Su", 10, 17, "city-gallery-white-rabbit"], ["Th", 17.5, 20.5, "city-gallery-white-rabbit"]] },
    { id: "n:hamish", name: "Hamish", role: "Regular", shirt: "#577590", skin: "#ffdbac", hair: "#8b5a2b", home: [-33.8950, 151.1760],
      sched: [["Mo-Su", 8, 9.5, "newtown-cafe-cafe-newtown"], ["Fr", 20, 23.5, "newtown-pub-marlborough"], ["Sa", 11, 13, "glebe-market-glebe-markets"]] },
    { id: "n:aroha", name: "Aroha", role: "Regular", shirt: "#2a9d8f", skin: "#a0673c", hair: "#111", home: [-33.8790, 151.1900],
      sched: [["Mo-Fr", 7, 8, "camperdown-park-victoria"], ["Mo-Su", 9, 11, "glebe-cafe-badde-manors"], ["Sa", 12, 14, "glebe-market-glebe-markets"], ["Tu", 18.5, 21.5, "glebe-pub-friend-in-hand"]] },
    { id: "n:dev", name: "Dev", role: "PhD student", shirt: "#f4a261", skin: "#8d5524", hair: "#111", home: [-33.8860, 151.1780],
      sched: [["Mo-Fr", 10, 16, "camperdown-usyd-fisher"], ["Tu", 18.5, 21.5, "glebe-pub-friend-in-hand"], ["Sa", 15, 17, "newtown-shop-better-read"]] },
    { id: "n:sofia", name: "Sofia", role: "Regular", shirt: "#bc4749", skin: "#f1c27d", hair: "#3b2a1a", home: [-33.9010, 151.1740],
      sched: [["Mo-Fr", 8, 9, "camperdown-cafe-deus"], ["We", 19.5, 23.5, "enmore-venue-enmore-theatre"], ["Fr-Sa", 19.5, 23.5, "enmore-venue-enmore-theatre"], ["Su", 12, 14, "enmore-restaurant-cairo-takeaway"]] },
    { id: "n:marcus", name: "Marcus", role: "Regular", shirt: "#264653", skin: "#6b4226", hair: "#111", home: [-33.8930, 151.1850],
      sched: [["Mo-Fr", 6, 7.5, "game-gym-missenden"], ["Th-Sa", 20, 23, "newtown-pub-bank"], ["Su", 10, 12, "camperdown-park-memorial-rest"]] },
    { id: "n:grace", name: "Grace", role: "Regular", shirt: "#e9c46a", skin: "#ffdbac", hair: "#c68642", home: [-33.8830, 151.1900],
      sched: [["Mo-Su", 15, 16.5, "camperdown-park-memorial-rest"], ["We-Sa", 17, 19, "glebe-cafe-sappho"], ["Sa", 9, 11, "game-laundromat-king"]] },
    { id: "n:yuki", name: "Yuki", role: "Illustrator", shirt: "#8338ec", skin: "#f1c27d", hair: "#111", home: [-33.8870, 151.1990],
      sched: [["Th", 17.5, 20.5, "city-gallery-white-rabbit"], ["Sa", 10, 12.5, "newtown-shop-better-read"], ["Mo-We", 13, 15, "camperdown-cafe-twelve"]] },
    { id: "n:ben", name: "Ben", role: "Regular", shirt: "#6a994e", skin: "#e0ac69", hair: "#5a3825", home: [-33.8965, 151.1830],
      sched: [["Fr", 18.5, 21, "newtown-restaurant-bloodwood"], ["Su", 14, 17, "newtown-pub-courthouse"], ["Mo-Th", 18, 19, "camperdown-shop-broadway"]] },
  ];

  /* ---------- timed venue events (weekly; game fiction layered on real venues) ---------- */
  CL.EVENTS = [
    { id: "trivia", tag: "trivia", poi: "glebe-pub-friend-in-hand", days: [2], start: 19, end: 21.5, title: "Trivia at the Friend in Hand, Glebe", emoji: "🧠" },
    { id: "opening", tag: "opening", poi: "city-gallery-white-rabbit", days: [4], start: 18, end: 20.5, title: "Gallery opening at White Rabbit, Chippendale", emoji: "🥂" },
    { id: "gig", tag: "gig", poi: "enmore-venue-enmore-theatre", days: [3, 5, 6], start: 20, end: 23, title: "Live music at the Enmore Theatre tonight 8pm", emoji: "🎸", chanceOtherNights: 0.3 },
    { id: "gig2", tag: "gig", poi: "camperdown-usyd-manning", days: [4], start: 19, end: 22.5, title: "Band night at Manning Bar, USyd", emoji: "🎸" },
    { id: "market", tag: "market", poi: "glebe-market-glebe-markets", days: [6], start: 10, end: 16, title: "Glebe Markets are on today", emoji: "🧺" },
    { id: "dance", tag: "dance", poi: "newtown-pub-marlborough", days: [5, 6], start: 21, end: 26, title: "DJs upstairs at the Marly from 9pm", emoji: "💃" },
  ];
  CL.EVENT_LEAD_HOURS = 3;


  /* ---------- small talk: {goal} where they're headed, {tip} a local tip about it, {here} where they are ---------- */
  CL.NPC_LINES = {
    greet: ["Oh, hey!", "G'day!", "Hi there!", "Hey, you're the new one at Rhodes House, right?", "Morning! Or is it arvo already?"],
    going: ["I'm off to {goal}. {tip}", "Heading to {goal} - come along sometime.", "Can't stop, {goal} is calling. {tip}", "{goal} next. Honestly my favourite spot round here."],
    at: ["You found {here}! {tip}", "I'm here most days. {tip}", "Nice, isn't it? {tip}"],
    home: ["Just heading home. Big day.", "Home time. See you round the neighbourhood!", "Off home. Try the cafes on King St tomorrow."],
    role: {
      Barista: ["Oat flat white? You look like an oat flat white.", "The morning rush here is wild before 9."],
      Bartender: ["Kitchen closes at 9 but the bar goes late.", "Ask for whatever the local brewery has on tap."],
      Librarian: ["Fisher's open late in semester. Quiet floors are upstairs.", "Returns go in the chute out the front."],
      "PhD student": ["Thesis is going... fine. Totally fine.", "Best coffee on campus is by the library, don't @ me."],
      Illustrator: ["I sketch the terraces on Wilson St. The iron lace is unreal.", "White Rabbit has a new show on - go."],
      "Gallery attendant": ["Free entry, and the building used to be a Coca-Cola depot.", "Thursday openings are the best night."],
    },
  };

  /* ---------- what people say depends on where you meet them ----------
     LOCAL_LINES: by street-life zone (see CL.LIVELY); PLACE_LINES: by the category of the nearest place */
  CL.LOCAL_LINES = {
    "eastern-ave": ["Lecture's at two in the Law School and I haven't done the reading.", "The food caravan's dumplings sell out by one - go now.", "Fisher's packed. Try the Law Library, it's quieter.", "Club stalls are giving out free sausage sandwiches today.", "Is it just me or is Eastern Ave always a wind tunnel?"],
    "quad": ["They filmed a bit of a movie here once. Everyone says a different one.", "Look up - there's a kangaroo gargoyle on the east side.", "The carillon plays Tuesdays at one. Best from the south-west corner.", "Graduations in the Great Hall - watch out for the gowns and tripods."],
    "science-rd": ["The Anderson Stuart has a museum of pathology specimens. Not for lunch.", "I've been in the lab since eight. What day is it?", "Short cut to Victoria Park is past the Holme building."],
    "king-st": ["Better Read Than Dead has an author talk tonight.", "Don't try walking King St on a Saturday arvo unless you like crowds.", "The I Have a Dream mural is right by the station.", "Every second shop's a Thai place - they're all good.", "Enmore Theatre's got a gig on, the line goes round the block."],
    "glebe-pt-rd": ["Glebe markets are Saturdays at the school - get there before eleven.", "Gleebooks is dangerous for my wallet.", "Walk down to the water at Blackwattle Bay, it's nice at sunset.", "Half the terraces round here have iron lace older than the country's flag."],
    "missenden": ["Just finished a night shift at RPA. Coffee first, then sleep.", "Parking near the hospital is a nightmare - I walk.", "The Lifehouse garden's a good quiet spot if you need a minute.", "Rhodes House used to be a warehouse, you know. Look at those windows.", "Happy Campa does the best toastie on Missenden."],
  };
  CL.PLACE_LINES = {
    cafe: ["Grab a flat white here, you won't regret it.", "Their banana bread is a meal on its own."],
    pub: ["Schooner o'clock yet?", "Pub's got a good beer garden out the back."],
    park: ["Nice day for sitting on the grass.", "Watch out for the ibis, they will take your lunch."],
    library: ["Shh. Kidding. Mostly.", "Late opening tonight, I'm camping here."],
    landmark: ["Take a photo - everyone does.", "I walk past this every day and still look at it."],
    campus: ["Class in ten. Or twenty. Who's counting.", "Uni's basically a small town, isn't it?"],
    restaurant: ["Try the special, it's always the special.", "It's BYO here if you've got a bottle."],
    bookshop: ["I came in for one book. You can guess how that went."],
    gym: ["Leg day. Pray for me."],
  };
  CL.PASSERBY = { students: ["Alex", "Priyanka", "Tom", "Mei", "Jack", "Zara", "Liam", "Aisha", "Ben", "Chloe", "Hiro", "Isla"], town: ["Pat", "Marg", "Nikos", "Leila", "Dave", "Sione", "Rosa", "Kev", "Tran", "Jo", "Sam", "Ruby"] };

  /* ---------- quick travel: the Go to menu ---------- */
  CL.AREAS = [
    { id: "home", label: "Home", sub: "Rhodes House, Missenden Rd", poi: "home-rhodes-house", e: "🏠" },
    { id: "usyd-east", label: "USyd: Eastern Ave", sub: "Fisher, Carslaw, the Law lawns", lat: -33.8872, lng: 151.1901, e: "🎓" },
    { id: "usyd-quad", label: "USyd: the Quad", sub: "Clocktower, Great Hall, jacaranda", poi: "camperdown-usyd-quadrangle", e: "🏛️" },
    { id: "usyd-west", label: "USyd: Manning & Holme", sub: "Manning Bar, the Courtyard, Victoria Park", lat: -33.8863, lng: 151.1855, e: "🎸" },
    { id: "newtown", label: "Newtown: King St", sub: "Cafes, pubs, bookshops, street art", lat: -33.8965, lng: 151.1797, e: "🛍️" },
    { id: "enmore", label: "Enmore Rd", sub: "Enmore Theatre, late-night eats", lat: -33.8992, lng: 151.1740, e: "🎭" },
    { id: "glebe", label: "Glebe Point Rd", sub: "Bookshops, cafes, Saturday markets", lat: -33.8795, lng: 151.1872, e: "📚" },
    { id: "chippendale", label: "Chippendale", sub: "Kensington St, Spice Alley, galleries", lat: -33.8850, lng: 151.2000, e: "🥢" },
    { id: "darlingharbour", label: "Darling Harbour & Pyrmont", sub: "Harbourside, the Fish Market", lat: -33.8730, lng: 151.1990, e: "🐟" },
    { id: "camperdown-park", label: "Camperdown Memorial Rest Park", sub: "Dog park, the old cemetery wall, big fig trees", poi: "camperdown-park-memorial-rest", lat: -33.8958, lng: 151.1768, e: "🌳" },
  ];

  /* ---------- street life: ambient crowds on the busiest strips ----------
     lat/lng + r (metres) bound where walkers wander; max walkers at peak; weekday/weekend hourly curves 0..1 */
  const CAMPUS_WD = [0, 0, 0, 0, 0, 0, .02, .08, .45, .7, .75, .8, 1, .95, .75, .7, .6, .45, .3, .2, .15, .08, .03, 0];
  const CAMPUS_WE = [0, 0, 0, 0, 0, 0, 0, .02, .05, .1, .15, .2, .22, .2, .18, .15, .1, .08, .05, .03, .02, 0, 0, 0];
  const STRIP_WD = [.1, .05, 0, 0, 0, 0, .05, .2, .35, .3, .3, .45, .6, .5, .4, .4, .5, .7, .85, .9, .85, .7, .45, .25];
  const STRIP_WE = [.25, .15, .05, 0, 0, 0, .03, .1, .35, .55, .7, .8, .85, .8, .75, .7, .7, .8, .9, 1, .95, .8, .6, .4];
  CL.LIVELY = [
    { id: "eastern-ave", label: "Eastern Avenue", lat: -33.8876, lng: 151.1900, r: 190, max: 140, wd: CAMPUS_WD, we: CAMPUS_WE, palette: "students" },
    { id: "quad", label: "The Quadrangle", lat: -33.8858, lng: 151.1889, r: 110, max: 50, wd: CAMPUS_WD, we: CAMPUS_WE, palette: "students" },
    { id: "science-rd", label: "Science Rd & Physics Rd", lat: -33.8878, lng: 151.1872, r: 140, max: 26, wd: CAMPUS_WD, we: CAMPUS_WE, palette: "students" },
    { id: "king-st", label: "King St", lat: -33.8965, lng: 151.1797, r: 380, max: 60, wd: STRIP_WD, we: STRIP_WE, palette: "town" },
    { id: "glebe-pt-rd", label: "Glebe Point Rd", lat: -33.8805, lng: 151.1875, r: 260, max: 26, wd: STRIP_WD, we: STRIP_WE, palette: "town" },
    { id: "missenden", label: "Missenden Rd", lat: -33.8885, lng: 151.1805, r: 220, max: 18, wd: STRIP_WD, we: STRIP_WE, palette: "town" },
  ];
})(window.CL = window.CL || {});
