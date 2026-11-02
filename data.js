/* Stek: fishing knowledge.
   Species curves are general angling knowledge, not measurements.
   Legal figures come from the Sportvisunie Veldgids and Kleine Lijst 2026. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StekData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const CENTER = { lat: 53.2194, lon: 6.5665, name: 'Groningen centre' };

  /* How fast the water follows the air, per day. Stek uses a typical canal as its reference. */
  const WATER_TYPES = { shipcanal: { label: 'Canal', k: 0.12 } };

  /* temp: [too cold, active from, active to, too warm] in water °C.
     light: how well it feeds by time of day. cloud: extra on an overcast day.
     press: barometer sensitivity. calm: score in flat calm. rain: score in light rain. */
  const SPECIES = [
    { id: 'pike', name: 'Pike', nl: 'Snoek', group: 'Predator', recommend: true, kleine: false,
      temp: [2, 6, 16, 24], light: { dawn: .95, day: .6, dusk: .9, night: .12 }, cloud: .15, press: 1, calm: .6, rain: .8,
      months: [.8, .7, .25, .15, .3, .45, .4, .5, .75, 1, 1, .9],
      how: {
        cold: { where: 'Sheltered harbour corners, deeper basins and slack water where baitfish gather.', rig: 'Dead bait on the bottom or under a float, or a big soft lure worked slowly. Always use a wire trace.', bait: 'Whole dead fish, 12 to 20 cm shads.', tip: 'Slow everything down. Let the lure rest for several seconds on the bottom.' },
        mid: { where: 'Plant edges, reed corners, moored boats and bridge shadow from the bank.', rig: 'Spinnerbait, jerkbait or 12 to 20 cm shad. Always use a wire trace.', bait: 'Natural colours in clear water, bright colours in murky water.', tip: 'Make a few casts in a fan pattern, then move on.' },
        warm: { where: 'Shade, deeper water and anywhere with fresh oxygen. Dawn is your best chance.', rig: 'Topwater or a shallow lure early on. Keep the fight short and always use a wire trace.', bait: 'Fast, visible lures.', tip: 'Warm water is hard on pike. Unhook quickly in the water, or stop fishing for pike on very warm days.' }
      },
      rules: { min: 45, closed: 'pike', take: 'Keep at most 1 between 45 and 80 cm.' } },
    { id: 'zander', name: 'Zander', nl: 'Snoekbaars', group: 'Predator', recommend: true, kleine: false,
      temp: [3, 8, 20, 27], light: { dawn: .9, day: .35, dusk: 1, night: .85 }, cloud: .3, press: .7, calm: .7, rain: .8,
      months: [.6, .6, .35, .15, .2, .6, .7, .8, .9, 1, .9, .7],
      how: {
        cold: { where: 'The deepest line, the foot of the slope and harbour mouths.', rig: 'Jig a 7 to 12 cm shad on 10 to 20 g, or fish a dropshot close to the bottom.', bait: 'Slim shads, or a dead fish on the bottom.', tip: 'Bites are small. Fish slowly and stay in contact with the bottom.' },
        mid: { where: 'Stone banks and the slope down to the shipping channel, mainly around dusk.', rig: 'Jighead with a slim shad, or a dead-bait rod on the slope.', bait: 'Pearl and natural colours, brighter in murky water.', tip: 'Fish from an hour before sunset until dark. Zander can feed close to the bank in low light.' },
        warm: { where: 'Shallow stone edges after dark and deeper shade during the day.', rig: 'Light jig or dead bait. Keep fights short in warm water.', bait: 'Slim shads, small dead fish.', tip: 'Dusk and night beat the middle of the day by a wide margin.' }
      },
      rules: { min: 42, closed: 'zander', take: 'Keep at most 2 between 42 and 70 cm.' } },
    { id: 'perch', name: 'Perch', nl: 'Baars', group: 'Predator', recommend: true, kleine: true,
      temp: [2, 8, 22, 28], light: { dawn: .85, day: .7, dusk: .8, night: .1 }, cloud: .05, press: .6, calm: .8, rain: .7,
      months: [.55, .55, .35, .2, .3, .6, .7, .8, .9, 1, .9, .7],
      how: {
        cold: { where: 'Harbours, quay walls and deep corners. Perch group up in cold water.', rig: 'Dropshot, ned rig or a small jig, fished slowly.', bait: 'Small creature baits, or worm where lures are not allowed.', tip: 'Found one? Stay put. There are usually more close by.' },
        mid: { where: 'Walls, posts, boats and bridge shadow from the bank.', rig: 'Small spinner, 5 to 8 cm shad or dropshot.', bait: 'Small lures or a lively worm.', tip: 'Fish close to structure before casting far out.' },
        warm: { where: 'Shade near structure, and open water where small fish scatter.', rig: 'Small crankbait or spinner.', bait: 'Fast small lures early on, worm later.', tip: 'Watch for small fish jumping. It often means perch are hunting.' }
      },
      rules: { min: 22, closed: 'zander', take: 'Keep at most 3 between 22 and 45 cm.' } },
    { id: 'asp', name: 'Asp', nl: 'Roofblei', group: 'Predator', recommend: true, kleine: false,
      temp: [8, 14, 24, 28], light: { dawn: .9, day: .55, dusk: .8, night: .05 }, cloud: 0, press: .4, calm: .7, rain: .6,
      months: [.1, .1, .2, .3, .6, .9, 1, 1, .9, .6, .3, .1],
      how: {
        cold: { where: 'Not a good cold-water target. Try harbour mouths if you see any activity.', rig: 'Small metal lure, fished a little slower.', bait: 'Slim metal lures.', tip: 'Choose another species until the water warms up.' },
        mid: { where: 'Open water near the surface, often around harbours and wide canals.', rig: 'Cast far with a 15 to 30 g metal lure and retrieve fast.', bait: 'Slim, silver metal lures.', tip: 'Look for sudden surface boils and cast past them.' },
        warm: { where: 'Open water and fast surface action, mainly early in the day.', rig: 'Long-casting metal lure on a fast retrieve.', bait: 'Silver and white lures.', tip: 'Speed matters. If you cannot get a follow, reel faster.' }
      },
      rules: {} },
    { id: 'carp', name: 'Carp', nl: 'Karper', group: 'Whitefish', recommend: true, kleine: true,
      temp: [8, 16, 26, 30], light: { dawn: .95, day: .55, dusk: .8, night: .8 }, cloud: .1, press: .5, calm: 1, rain: .8,
      months: [.1, .1, .2, .4, .7, .9, 1, 1, .9, .6, .3, .1],
      how: {
        cold: { where: 'Deeper, wind-sheltered water. Expect few bites.', rig: 'Small hookbait on a light bottom rig.', bait: 'Small sweetcorn or a single boilie, little loose feed.', tip: 'Feed very little. Patience matters more than quantity.' },
        mid: { where: 'Plant edges and the side the warm wind is blowing towards.', rig: 'Bottom rig or float close to the bank.', bait: 'Sweetcorn, boilie, bread.', tip: 'Look for bubbles and moving plants before you cast.' },
        warm: { where: 'Plants, shade and surface fish on calm days.', rig: 'Floater rig or a bottom rig at dusk.', bait: 'Floating bread, sweetcorn, boilie.', tip: 'Dawn and night are usually better. Use a landing net and mat.' }
      },
      rules: { release: true } },
    { id: 'crucian', name: 'Crucian carp', nl: 'Kroeskarper', group: 'Whitefish', recommend: true, kleine: true,
      temp: [10, 16, 25, 30], light: { dawn: .9, day: .55, dusk: .8, night: .3 }, cloud: .1, press: .3, calm: 1, rain: .7,
      months: [.1, .1, .2, .4, .8, 1, 1, .9, .7, .4, .2, .1],
      how: {
        cold: { where: 'Sheltered ditches. Few bites in cold water.', rig: 'Very light float.', bait: 'Maggot.', tip: 'Try a warmer month for this one.' },
        mid: { where: 'Quiet, plant-rich ditches and ponds.', rig: 'Delicate float, small hook.', bait: 'Bread, maggots, sweetcorn.', tip: 'Bites can be tiny. Strike on any float movement.' },
        warm: { where: 'Close to plants, mainly at dawn.', rig: 'Delicate float.', bait: 'Bread or sweetcorn.', tip: 'A vulnerable species, so release it with care.' }
      },
      rules: { releaseAdvised: true } },
    { id: 'tench', name: 'Tench', nl: 'Zeelt', group: 'Whitefish', recommend: true, kleine: true,
      temp: [10, 16, 24, 28], light: { dawn: 1, day: .35, dusk: .8, night: .3 }, cloud: .15, press: .4, calm: 1, rain: .8,
      months: [.05, .05, .1, .3, .9, 1, .9, .8, .6, .3, .1, .05],
      how: {
        cold: { where: 'Tench are close to dormant in cold water.', rig: 'Light float.', bait: 'Worm.', tip: 'Wait for spring. Tench are rarely worth targeting now.' },
        mid: { where: 'Along plants and lily pads. Look for fine bubbles.', rig: 'Float set just on the bottom, lift-bite style.', bait: 'Worm, maggots, sweetcorn.', tip: 'Be on the water at first light.' },
        warm: { where: 'Plant-rich water at first light.', rig: 'Float close to the plants.', bait: 'Sweetcorn or worm.', tip: 'Tench handle low oxygen better than most fish, but the bite usually ends once the sun is up.' }
      },
      rules: { min: 25 } },
    { id: 'bream', name: 'Bream', nl: 'Brasem', group: 'Whitefish', recommend: true, kleine: true,
      temp: [5, 12, 22, 27], light: { dawn: .9, day: .55, dusk: 1, night: .75 }, cloud: .2, press: .5, calm: .7, rain: .8,
      months: [.35, .35, .45, .6, .8, .95, 1, 1, .9, .75, .5, .4],
      how: {
        cold: { where: 'Deeper water and sheltered basins. Bream shoals move slowly.', rig: 'Light feeder or float on the bottom.', bait: 'Worm and maggots with little feed.', tip: 'Start with a small amount of feed. You can always add more.' },
        mid: { where: 'Across the canal at the foot of the slope.', rig: 'Feeder or waggler.', bait: 'Maggots, worm, sweetcorn.', tip: 'Feed regularly to hold the shoal in one place.' },
        warm: { where: 'Far side of the canal and deeper water in daytime, closer at dusk.', rig: 'Feeder or float.', bait: 'Sweetcorn, worm.', tip: 'Evening is usually best.' }
      },
      rules: {} },
    { id: 'roach', name: 'Roach', nl: 'Blankvoorn', group: 'Whitefish', recommend: true, kleine: true,
      temp: [2, 8, 20, 26], light: { dawn: .8, day: .7, dusk: .85, night: .2 }, cloud: .1, press: .35, calm: .7, rain: .8,
      months: [.7, .7, .75, .8, .8, .85, .85, .85, .9, .95, .9, .75],
      how: {
        cold: { where: 'Harbours and sheltered basins. Roach keep feeding in cold water.', rig: 'Light waggler or pole, small hook.', bait: 'Maggot, pinkie, bread punch.', tip: 'Fine line and small bait get more bites in clear, cold water.' },
        mid: { where: 'Canal edges and near plants.', rig: 'Waggler or stick float.', bait: 'Maggots, bread, hemp.', tip: 'Feed little and often.' },
        warm: { where: 'Shade and plants, higher in the water.', rig: 'Float set shallower.', bait: 'Hemp, bread, maggots.', tip: 'Change depth until you find them.' }
      },
      rules: {} },
    { id: 'rudd', name: 'Rudd', nl: 'Ruisvoorn', group: 'Whitefish', recommend: true, kleine: true,
      temp: [10, 16, 25, 29], light: { dawn: .8, day: .8, dusk: .85, night: .1 }, cloud: 0, press: .25, calm: .9, rain: .6,
      months: [.1, .1, .2, .4, .8, 1, 1, 1, .8, .5, .25, .1],
      how: {
        cold: { where: 'Sheltered plant-rich corners. Few bites in cold water.', rig: 'Light float.', bait: 'Maggot.', tip: 'Roach are the better choice right now.' },
        mid: { where: 'Plants and reeds, near the surface.', rig: 'Light float, shallow.', bait: 'Floating bread, maggots.', tip: 'Stay low. Rudd see you easily in clear water.' },
        warm: { where: 'Surface layer near plants.', rig: 'Surface float or a light fly rod.', bait: 'Bread crust, insects.', tip: 'Warm, still evenings are a good time to look for rises.' }
      },
      rules: {} },
    { id: 'ide', name: 'Ide', nl: 'Winde', group: 'Whitefish', recommend: true, kleine: true,
      temp: [5, 10, 22, 26], light: { dawn: .85, day: .6, dusk: .85, night: .2 }, cloud: .1, press: .35, calm: .7, rain: .75,
      months: [.4, .4, .45, .4, .4, .8, .9, .9, .9, .85, .6, .45],
      how: {
        cold: { where: 'Deeper, slower sections of flowing water.', rig: 'Bottom rig or trotted float.', bait: 'Worm, maggots.', tip: 'Fish slowly along the bottom.' },
        mid: { where: 'Bends, junctions and any moving water.', rig: 'Float or small spinner.', bait: 'Bread, sweetcorn, small lures.', tip: 'Often swims high in the water. Scan the surface.' },
        warm: { where: 'Upper water layer and near inflows.', rig: 'Floating bread or small lure.', bait: 'Bread crust, small spinner.', tip: 'Can be shy. Approach quietly.' }
      },
      rules: { closed: 'ide' } },
    { id: 'bleak', name: 'Bleak', nl: 'Alver', group: 'Whitefish', recommend: true, kleine: true,
      temp: [8, 14, 26, 30], light: { dawn: .7, day: .95, dusk: .85, night: .05 }, cloud: 0, press: .15, calm: .9, rain: .5,
      months: [.1, .1, .2, .4, .75, 1, 1, 1, .85, .55, .25, .1],
      how: {
        cold: { where: 'Sheltered harbours. Few are active now.', rig: 'Very small float.', bait: 'Single maggot.', tip: 'Wait for warmer water.' },
        mid: { where: 'Just under the surface in open water.', rig: 'Small float, set very shallow.', bait: 'Maggot, tiny bread flake.', tip: 'Feed a light cloud to bring them up.' },
        warm: { where: 'Surface layer near harbours and quays.', rig: 'Whip with a tiny float.', bait: 'Maggot.', tip: 'Quick fishing and a good way to catch your own count on a slow day.' }
      },
      rules: {} },
    { id: 'catfish', name: 'Wels catfish', nl: 'Meerval', group: 'Protected', recommend: false, kleine: false,
      temp: [10, 16, 26, 30], light: { dawn: .6, day: .2, dusk: .8, night: 1 }, cloud: .1, press: .7, calm: .8, rain: .9,
      months: [.05, .05, .1, .3, .6, .8, 1, 1, .8, .5, .1, .05],
      how: {
        cold: { where: 'Closed all year.', rig: 'Not recommended.', bait: 'None.', tip: 'If you catch one, release it straight away.' },
        mid: { where: 'Closed all year.', rig: 'Not recommended.', bait: 'None.', tip: 'If you catch one, release it straight away.' },
        warm: { where: 'Closed all year.', rig: 'Not recommended.', bait: 'None.', tip: 'If you catch one, release it straight away.' }
      },
      rules: { release: true, closed: 'allyear', protect: 'Closed all year. Release immediately.' } }
  ];

  /* General tips per type of water. No places, so they work anywhere. */
  const WATER_TIPS = {
    pike: { canal: 'Work the bank edges, moored boats and bridge shadow from the bank.', lake: 'Search plant edges and reed corners, then keep moving.', small: 'Make short casts along plants and bends.' },
    zander: { canal: 'Fish the slope down to the deepest part, especially around dusk.', lake: 'Try drop-offs and deeper open water, and the shallows at dusk.', small: 'Less likely. Try the deepest bends if the water is murky.' },
    perch: { canal: 'Fish close to posts, walls, boats and anything solid.', lake: 'Try jetties, plant edges and places where small fish scatter.', small: 'Try bends, bridges and overhanging cover.' },
    asp: { canal: 'Cast far across open water and watch for surface boils.', lake: 'Rarely a good bet.', small: 'Rarely a good bet.' },
    carp: { canal: 'Look for quiet stretches and warm, shallow corners.', lake: 'Try plants and shallow bays on the side the wind blows towards.', small: 'Try deeper pools and shaded bends.' },
    crucian: { canal: 'Rarely a good bet.', lake: 'Try sheltered corners with plenty of plants.', small: 'Fish quiet ponds and ditches with plants.' },
    tench: { canal: 'Rarely a good bet, except in quiet side arms with plants.', lake: 'Fish along plants and lily pads at first light.', small: 'Try plant-rich ditches and look for fine bubbles.' },
    bream: { canal: 'Feed one spot at the foot of the slope or on the far side.', lake: 'Feed over deeper water with a soft bottom.', small: 'Try the deeper sections and wide bends.' },
    roach: { canal: 'Fish along the edges, close to plants or structure.', lake: 'Try plant edges, and shallower water in warm weather.', small: 'Use a light float near plants and bends.' },
    rudd: { canal: 'Rarely a good bet, except in side arms with plants.', lake: 'Fish near the surface around reeds and plants.', small: 'Fish the surface close to plants.' },
    ide: { canal: 'Try junctions, inflows and anywhere the water moves.', lake: 'Rarely a good bet.', small: 'Try bends, inflows and moving water.' },
    bleak: { canal: 'Fish just under the surface near quays.', lake: 'Fish the open surface close to shore.', small: 'Try slow, open stretches near the surface.' }
  };

  /* Largest believable size in Dutch water: [cm, kg], and typical body weight (g per cm cubed). */
  const LIMITS = {
    pike: [150, 30, .006], zander: [125, 20, .009], perch: [65, 5, .013], asp: [110, 15, .01], carp: [130, 45, .018],
    crucian: [60, 5, .025], tench: [80, 10, .016], bream: [95, 12, .013], roach: [60, 4, .012], rudd: [60, 4, .013],
    ide: [90, 10, .012], bleak: [30, .3, .007], catfish: [280, 140, .006], other: [300, 150, 0]
  };

  const LEVELS = [
    [0, 'Rookie Angler'], [100, 'Casual Angler'], [300, 'Apprentice Angler'], [600, 'Keen Angler'],
    [1000, 'Intermediate Angler'], [1500, 'Experienced Angler'], [2200, 'Advanced Angler'], [3000, 'Expert Angler'],
    [4000, 'Master Angler'], [5500, 'Grandmaster Angler'], [7500, 'Legendary Angler'], [10000, 'Mythical Angler']
  ];

  const LEGAL = {
    source: 'Sportvisunie Veldgids and Kleine Lijst van VISwateren 2026',
    takeTotal: 'At most 15 fish in total, with at most 5 over 25 cm.',
    night: 'The night period runs from 2 hours after sunset to 1 hour before sunrise.',
    keepnet: 'Keepnets may only be used from sunrise to sunset.',
    live: 'Live vertebrates as bait are not allowed. Worms, maggots and midge larvae are fine.'
  };

  return { CENTER, WATER_TYPES, WATER_TIPS, LIMITS, SPECIES, LEVELS, LEGAL };
});
