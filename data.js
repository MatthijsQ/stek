/* Stek: fishing knowledge and water data for Groningen.
   Species curves are general angling knowledge, not measurements.
   Legal figures come from the Sportvisunie Veldgids and Kleine Lijst 2026. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StekData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const CENTER = { lat: 53.2194, lon: 6.5665, name: 'Groningen centre' };

  /* Water types: k is how fast the water follows the air (per day). */
  const WATER_TYPES = {
    shipcanal: { label: 'Shipping canal', k: 0.12, exposure: 0.6, cold: 0.55 },
    harbour: { label: 'City harbour', k: 0.13, exposure: 0.25, cold: 1 },
    diep: { label: 'Small canal (diep)', k: 0.15, exposure: 0.4, cold: 0.5 },
    river: { label: 'Tidal-free river', k: 0.15, exposure: 0.55, cold: 0.5 },
    shallowlake: { label: 'Shallow lake', k: 0.18, exposure: 1, cold: 0.3 },
    pit: { label: 'Recreation lake', k: 0.08, exposure: 0.8, cold: 0.8 },
    polder: { label: 'Polder water', k: 0.2, exposure: 0.35, cold: 0.2 }
  };

  /* status: listed = named in the Kleine Lijst van VISwateren 2026.
     check = known water, but its VISpas status is not confirmed. */
  const SPOTS = [
    { id: 'oosterhaven', name: 'Oosterhaven', water: 'City harbours', type: 'harbour', lat: 53.2165, lon: 6.5783, status: 'listed',
      tips: 'Work the quay walls, moored boats and the shade near bridges. Fish from the bank or quay, never from a bridge.' },
    { id: 'zuiderhaven', name: 'Zuiderhaven & Eendrachtskanaal', water: 'City harbours', type: 'harbour', lat: 53.2137, lon: 6.5565, status: 'listed',
      tips: 'Short walk from the centre. Try houseboats, corners and bridge shadows.' },
    { id: 'verbinding', name: 'Verbindingskanaal', water: 'City harbours', type: 'harbour', lat: 53.2121, lon: 6.5681, status: 'listed',
      tips: 'Narrow city water that is sheltered in hard wind. Cast along the walls rather than across.' },
    { id: 'oosterhamrik', name: 'Oosterhamrikkanaal', water: 'City canals', type: 'diep', lat: 53.2265, lon: 6.5693, status: 'listed',
      tips: 'No fishing from the bus-lane side between Kapteynbrug and Oliemuldersbrug.' },
    { id: 'hunzehaven', name: 'Hunzehaven & Deense Haven', water: 'City harbours', type: 'harbour', lat: 53.2198, lon: 6.5938, status: 'listed',
      tips: 'Basins off the canal that can hold baitfish in cold water. Stay clear of working quays and private ground.' },
    { id: 'eemsdriebond', name: 'Eemskanaal near Driebond', water: 'Eemskanaal', type: 'shipcanal', lat: 53.2215, lon: 6.6075, status: 'listed',
      tips: 'Search the slope where the bank drops to the shipping channel. Ship wash can stir up food.' },
    { id: 'eemslageland', name: 'Eemskanaal near Lageland', water: 'Eemskanaal', type: 'shipcanal', lat: 53.241, lon: 6.66, status: 'listed',
      tips: 'Open and quiet, so it feels the wind. Cover water until you find fish.' },
    { id: 'vskstad', name: 'Van Starkenborghkanaal, Korrewegwijk', water: 'Van Starkenborghkanaal', type: 'shipcanal', lat: 53.2337, lon: 6.584, status: 'listed',
      tips: 'Big, busy canal close to town. Fish the drop-off and any change in the bank.' },
    { id: 'vsknhb', name: 'Van Starkenborghkanaal, Noorderhoogebrug', water: 'Van Starkenborghkanaal', type: 'shipcanal', lat: 53.2498, lon: 6.5737, status: 'listed',
      tips: 'Set up on the bank away from the bridge. Bridge shadow can hold predators, but fishing from the bridge is not allowed.' },
    { id: 'vskdorkwerd', name: 'Van Starkenborghkanaal, Dorkwerd', water: 'Van Starkenborghkanaal', type: 'shipcanal', lat: 53.2495, lon: 6.5134, status: 'listed',
      tips: 'Longer open stretch west of the city. Good for walking the bank with a lure.' },
    { id: 'reitdiephaven', name: 'Reitdiep at Reitdiephaven', water: 'Reitdiep', type: 'river', lat: 53.2377, lon: 6.5255, status: 'listed',
      tips: 'Try the harbour mouth and the first bends. Respect moorings and residents.' },
    { id: 'garnwerd', name: 'Reitdiep at Garnwerd', water: 'Reitdiep', type: 'river', lat: 53.3048, lon: 6.4938, status: 'listed',
      tips: 'Open, winding water and a nice ride out. Bends and reed edges are the places to start.' },
    { id: 'nwkhelpman', name: 'Noord-Willemskanaal at Helpman', water: 'Noord-Willemskanaal', type: 'shipcanal', lat: 53.195, lon: 6.566, status: 'listed',
      tips: 'Handy from the south of the city. Fish both the near slope and the far edge.' },
    { id: 'hoornsediep', name: 'Hoornsediep at Haren', water: 'Noord-Willemskanaal', type: 'shipcanal', lat: 53.1759, lon: 6.5788, status: 'listed',
      tips: 'Quieter stretch south of the city. Reed and side-water openings are worth a few casts.' },
    { id: 'wdeuvelgunne', name: 'Winschoterdiep at Euvelgunne', water: 'Winschoterdiep', type: 'shipcanal', lat: 53.205, lon: 6.62, status: 'listed',
      tips: 'Industrial banks and stone edges. Check access first and stay out of company grounds.' },
    { id: 'wdwaterhuizen', name: 'Winschoterdiep at Waterhuizen', water: 'Winschoterdiep', type: 'shipcanal', lat: 53.1868, lon: 6.6516, status: 'listed',
      tips: 'Wide canal water. Watch for baitfish and search the bank before settling.' },
    { id: 'hoendiephk', name: 'Hoendiep at Hoogkerk', water: 'Hoendiep', type: 'diep', lat: 53.2093, lon: 6.4654, status: 'listed',
      tips: 'Smaller water close to the road. Good for short sessions and light gear.' },
    { id: 'hoendiepvv', name: 'Hoendiep at Vierverlaten', water: 'Hoendiep', type: 'diep', lat: 53.2131, lon: 6.4853, status: 'listed',
      tips: 'Try the junctions and any water plants. Stay at least 50 m from fish passages and out of lock chambers.' },
    { id: 'aduarderdiep', name: 'Aduarderdiep at Nieuwklap', water: 'Aduarderdiep', type: 'diep', lat: 53.2464, lon: 6.4786, status: 'listed',
      tips: 'Quiet countryside water. Walk the bank and look for plants, bends and side ditches.' },
    { id: 'hoornsemeer', name: 'Hoornsemeer', water: 'Lakes', type: 'pit', lat: 53.1803, lon: 6.5631, status: 'check',
      tips: 'Close to the city, but check it in the VISplanner before fishing. Expect swimmers in summer.' },
    { id: 'paterswoldsemeer', name: 'Paterswoldsemeer', water: 'Lakes', type: 'shallowlake', lat: 53.1674, lon: 6.5672, status: 'check',
      tips: 'Check it in the VISplanner first. Wind and boats can change the fishing quickly. Search the plants and shore corners.' },
    { id: 'zuidlaardermeer', name: 'Zuidlaardermeer', water: 'Lakes', type: 'shallowlake', lat: 53.1276, lon: 6.6941, status: 'check',
      tips: 'Big and exposed, with valuable nature around it. Check the VISplanner and local restrictions first.' },
    { id: 'leekstermeer', name: 'Leekstermeer', water: 'Lakes', type: 'shallowlake', lat: 53.1818, lon: 6.4388, status: 'check',
      tips: 'A long ride into a nature area. Check the VISplanner and local restrictions first.' },
    { id: 'winsumerdiep', name: 'Winsumerdiep at Winsum', water: 'Winsumerdiep', type: 'diep', lat: 53.3329, lon: 6.5266, status: 'check',
      tips: 'Visit Groningen names it for pike. Check the VISplanner before you ride out.' },
    { id: 'kardingerplas', name: 'Kardingerplas', water: 'Lakes', type: 'pit', lat: 53.2384, lon: 6.6018, status: 'check',
      tips: 'In the Kardinge recreation area. Check the VISplanner before fishing.' },
    { id: 'woldmeer', name: 'Woldmeer, Meerstad', water: 'Lakes', type: 'shallowlake', lat: 53.2264, lon: 6.6681, status: 'check',
      tips: 'Newer water by Meerstad. Check the VISplanner before fishing.' }
  ];

  const allYear = [.7, .7, .7, .8, .85, .9, .9, .9, .9, .85, .8, .7];

  /* temp: [too cold, active from, active to, too warm] in water °C.
     light: how well it feeds by time of day. cloud: extra on an overcast day.
     press: barometer sensitivity. calm: score in flat calm. rain: score in light rain. */
  const SPECIES = [
    { id: 'pike', name: 'Pike', nl: 'Snoek', group: 'Predator', shape: 'long', recommend: true, kleine: false,
      temp: [2, 6, 16, 24], light: { dawn: .95, day: .6, dusk: .9, night: .12 }, cloud: .15, press: 1, calm: .6, rain: .8,
      months: [.8, .7, .25, .15, .3, .45, .4, .5, .75, 1, 1, .9],
      habitat: { shipcanal: .6, harbour: .75, diep: .8, river: .7, shallowlake: .95, pit: .6, polder: .75 },
      how: {
        cold: { where: 'Sheltered harbour corners, deeper basins and slack water where baitfish gather.', rig: 'Dead bait on the bottom or under a float, or a big soft lure worked slowly. Always use a wire trace.', bait: 'Whole dead fish, 12 to 20 cm shads.', tip: 'Slow everything down. Let the lure rest for several seconds on the bottom.' },
        mid: { where: 'Plant edges, reed corners, moored boats and bridge shadow from the bank.', rig: 'Spinnerbait, jerkbait or 12 to 20 cm shad. Always use a wire trace.', bait: 'Natural colours in clear water, bright colours in murky water.', tip: 'Make a few casts in a fan pattern, then move on.' },
        warm: { where: 'Shade, deeper water and anywhere with fresh oxygen. Dawn is your best chance.', rig: 'Topwater or a shallow lure early on. Keep the fight short and always use a wire trace.', bait: 'Fast, visible lures.', tip: 'Warm water is hard on pike. Unhook quickly in the water, or stop fishing for pike on very warm days.' }
      },
      rules: { min: 45, closed: 'pike', take: 'Keep at most 1 between 45 and 80 cm.' } },
    { id: 'zander', name: 'Zander', nl: 'Snoekbaars', group: 'Predator', shape: 'long', recommend: true, kleine: false,
      temp: [3, 8, 20, 27], light: { dawn: .9, day: .35, dusk: 1, night: .85 }, cloud: .3, press: .7, calm: .7, rain: .8,
      months: [.6, .6, .35, .15, .2, .6, .7, .8, .9, 1, .9, .7],
      habitat: { shipcanal: 1, harbour: .9, diep: .5, river: .7, shallowlake: .6, pit: .7, polder: .2 },
      how: {
        cold: { where: 'The deepest line, the foot of the slope and harbour mouths.', rig: 'Jig a 7 to 12 cm shad on 10 to 20 g, or fish a dropshot close to the bottom.', bait: 'Slim shads, or a dead fish on the bottom.', tip: 'Bites are small. Fish slowly and stay in contact with the bottom.' },
        mid: { where: 'Stone banks and the slope down to the shipping channel, mainly around dusk.', rig: 'Jighead with a slim shad, or a dead-bait rod on the slope.', bait: 'Pearl and natural colours, brighter in murky water.', tip: 'Fish from an hour before sunset until dark. Zander can feed close to the bank in low light.' },
        warm: { where: 'Shallow stone edges after dark and deeper shade during the day.', rig: 'Light jig or dead bait. Keep fights short in warm water.', bait: 'Slim shads, small dead fish.', tip: 'Dusk and night beat the middle of the day by a wide margin.' }
      },
      rules: { min: 42, closed: 'zander', take: 'Keep at most 2 between 42 and 70 cm.' } },
    { id: 'perch', name: 'Perch', nl: 'Baars', group: 'Predator', shape: 'std', recommend: true, kleine: true,
      temp: [2, 8, 22, 28], light: { dawn: .85, day: .7, dusk: .8, night: .1 }, cloud: .05, press: .6, calm: .8, rain: .7,
      months: [.55, .55, .35, .2, .3, .6, .7, .8, .9, 1, .9, .7],
      habitat: { harbour: 1, shipcanal: .8, diep: .7, river: .7, shallowlake: .6, pit: .7, polder: .5 },
      how: {
        cold: { where: 'Harbours, quay walls and deep corners. Perch group up in cold water.', rig: 'Dropshot, ned rig or a small jig, fished slowly.', bait: 'Small creature baits, or worm where lures are not allowed.', tip: 'Found one? Stay put. There are usually more close by.' },
        mid: { where: 'Walls, posts, boats and bridge shadow from the bank.', rig: 'Small spinner, 5 to 8 cm shad or dropshot.', bait: 'Small lures or a lively worm.', tip: 'Fish close to structure before casting far out.' },
        warm: { where: 'Shade near structure, and open water where small fish scatter.', rig: 'Small crankbait or spinner.', bait: 'Fast small lures early on, worm later.', tip: 'Watch for small fish jumping. It often means perch are hunting.' }
      },
      rules: { min: 22, closed: 'zander', take: 'Keep at most 3 between 22 and 45 cm.' } },
    { id: 'asp', name: 'Asp', nl: 'Roofblei', group: 'Predator', shape: 'std', recommend: true, kleine: false,
      temp: [8, 14, 24, 28], light: { dawn: .9, day: .55, dusk: .8, night: .05 }, cloud: 0, press: .4, calm: .7, rain: .6,
      months: [.1, .1, .2, .3, .6, .9, 1, 1, .9, .6, .3, .1],
      habitat: { harbour: .7, shipcanal: .8, diep: .4, river: .6, shallowlake: .3, pit: .3, polder: .1 },
      how: {
        cold: { where: 'Not a good cold-water target. Try harbour mouths if you see any activity.', rig: 'Small metal lure, fished a little slower.', bait: 'Slim metal lures.', tip: 'Choose another species until the water warms up.' },
        mid: { where: 'Open water near the surface. Local reports include the city centre.', rig: 'Cast far with a 15 to 30 g metal lure and retrieve fast.', bait: 'Slim, silver metal lures.', tip: 'Look for sudden surface boils and cast past them.' },
        warm: { where: 'Open water and fast surface action, mainly early in the day.', rig: 'Long-casting metal lure on a fast retrieve.', bait: 'Silver and white lures.', tip: 'Speed matters. If you cannot get a follow, reel faster.' }
      },
      rules: {} },
    { id: 'ruffe', name: 'Ruffe', nl: 'Pos', group: 'Bottom fish', shape: 'std', recommend: true, kleine: true,
      temp: [2, 8, 20, 26], light: { dawn: .7, day: .6, dusk: .8, night: .4 }, cloud: .1, press: .2, calm: .7, rain: .7, months: allYear,
      habitat: { shipcanal: .9, harbour: .85, diep: .6, river: .7, shallowlake: .5, pit: .5, polder: .3 },
      how: {
        cold: { where: 'On the bottom near walls and the slope.', rig: 'Light bottom rig or float set to the bottom.', bait: 'Small worm or maggots.', tip: 'A fun species to fill a collection on a slow day.' },
        mid: { where: 'Muddy bottom close to the bank.', rig: 'Light float rig, small hook.', bait: 'Worm or maggots.', tip: 'Keep the bait on the bottom.' },
        warm: { where: 'Deeper water and shade.', rig: 'Light bottom rig.', bait: 'Worm.', tip: 'Handle with care because of the spiny fin.' }
      },
      rules: {} },
    { id: 'carp', name: 'Carp', nl: 'Karper', group: 'Whitefish', shape: 'deep', recommend: true, kleine: true,
      temp: [8, 16, 26, 30], light: { dawn: .95, day: .55, dusk: .8, night: .8 }, cloud: .1, press: .5, calm: 1, rain: .8,
      months: [.1, .1, .2, .4, .7, .9, 1, 1, .9, .6, .3, .1],
      habitat: { shallowlake: 1, pit: .9, harbour: .5, shipcanal: .6, diep: .6, river: .5, polder: .6 },
      how: {
        cold: { where: 'Deeper, wind-sheltered water. Expect few bites.', rig: 'Small hookbait on a light bottom rig.', bait: 'Small sweetcorn or a single boilie, little loose feed.', tip: 'Feed very little. Patience matters more than quantity.' },
        mid: { where: 'Plant edges and the side the warm wind is blowing towards.', rig: 'Bottom rig or float close to the bank.', bait: 'Sweetcorn, boilie, bread.', tip: 'Look for bubbles and moving plants before you cast.' },
        warm: { where: 'Plants, shade and surface fish on calm days.', rig: 'Floater rig or a bottom rig at dusk.', bait: 'Floating bread, sweetcorn, boilie.', tip: 'Dawn and night are usually better. Use a landing net and mat.' }
      },
      rules: { release: true } },
    { id: 'crucian', name: 'Crucian carp', nl: 'Kroeskarper', group: 'Whitefish', shape: 'deep', recommend: true, kleine: true,
      temp: [10, 16, 25, 30], light: { dawn: .9, day: .55, dusk: .8, night: .3 }, cloud: .1, press: .3, calm: 1, rain: .7,
      months: [.1, .1, .2, .4, .8, 1, 1, .9, .7, .4, .2, .1],
      habitat: { polder: 1, shallowlake: .7, diep: .6, harbour: .2, shipcanal: .15, river: .3, pit: .3 },
      how: {
        cold: { where: 'Sheltered ditches. Few bites in cold water.', rig: 'Very light float.', bait: 'Maggot.', tip: 'Try a warmer month for this one.' },
        mid: { where: 'Quiet, plant-rich ditches and ponds.', rig: 'Delicate float, small hook.', bait: 'Bread, maggots, sweetcorn.', tip: 'Bites can be tiny. Strike on any float movement.' },
        warm: { where: 'Close to plants, mainly at dawn.', rig: 'Delicate float.', bait: 'Bread or sweetcorn.', tip: 'A vulnerable species, so release it with care.' }
      },
      rules: { releaseAdvised: true } },
    { id: 'tench', name: 'Tench', nl: 'Zeelt', group: 'Whitefish', shape: 'std', recommend: true, kleine: true,
      temp: [10, 16, 24, 28], light: { dawn: 1, day: .35, dusk: .8, night: .3 }, cloud: .15, press: .4, calm: 1, rain: .8,
      months: [.05, .05, .1, .3, .9, 1, .9, .8, .6, .3, .1, .05],
      habitat: { polder: 1, shallowlake: .9, diep: .75, harbour: .3, shipcanal: .25, river: .4, pit: .5 },
      how: {
        cold: { where: 'Tench are close to dormant in cold water.', rig: 'Light float.', bait: 'Worm.', tip: 'Wait for spring. Tench are rarely worth targeting now.' },
        mid: { where: 'Along plants and lily pads. Look for fine bubbles.', rig: 'Float set just on the bottom, lift-bite style.', bait: 'Worm, maggots, sweetcorn.', tip: 'Be on the water at first light.' },
        warm: { where: 'Plant-rich water at first light.', rig: 'Float close to the plants.', bait: 'Sweetcorn or worm.', tip: 'Tench handle low oxygen better than most fish, but the bite usually ends once the sun is up.' }
      },
      rules: { min: 25 } },
    { id: 'bream', name: 'Bream', nl: 'Brasem', group: 'Whitefish', shape: 'deep', recommend: true, kleine: true,
      temp: [5, 12, 22, 27], light: { dawn: .9, day: .55, dusk: 1, night: .75 }, cloud: .2, press: .5, calm: .7, rain: .8,
      months: [.35, .35, .45, .6, .8, .95, 1, 1, .9, .75, .5, .4],
      habitat: { shipcanal: .95, harbour: .8, diep: .7, river: .8, shallowlake: .8, pit: .7, polder: .35 },
      how: {
        cold: { where: 'Deeper water and sheltered basins. Bream shoals move slowly.', rig: 'Light feeder or float on the bottom.', bait: 'Worm and maggots with little feed.', tip: 'Start with a small amount of feed. You can always add more.' },
        mid: { where: 'Across the canal at the foot of the slope.', rig: 'Feeder or waggler.', bait: 'Maggots, worm, sweetcorn.', tip: 'Feed regularly to hold the shoal in one place.' },
        warm: { where: 'Far side of the canal and deeper water in daytime, closer at dusk.', rig: 'Feeder or float.', bait: 'Sweetcorn, worm.', tip: 'Evening is usually best. Note: keepnets may only be used from sunrise to sunset.' }
      },
      rules: {} },
    { id: 'silver', name: 'Silver bream', nl: 'Kolblei', group: 'Whitefish', shape: 'deep', recommend: true, kleine: true,
      temp: [5, 11, 22, 27], light: { dawn: .85, day: .6, dusk: .95, night: .5 }, cloud: .15, press: .4, calm: .7, rain: .8,
      months: [.35, .35, .45, .6, .8, .9, 1, 1, .9, .7, .5, .4],
      habitat: { shipcanal: .85, harbour: .8, diep: .75, river: .75, shallowlake: .7, pit: .6, polder: .4 },
      how: {
        cold: { where: 'Sheltered harbours, close to the bottom.', rig: 'Light float.', bait: 'Maggot.', tip: 'Use a small hook and fine line.' },
        mid: { where: 'Canal edges and harbours, on or just above the bottom.', rig: 'Light float or small feeder.', bait: 'Maggots, worm pieces.', tip: 'Small amounts of feed keep them working.' },
        warm: { where: 'Edges and shade.', rig: 'Light float.', bait: 'Maggots.', tip: 'Often mixed with young bream, so look closely when you log it.' }
      },
      rules: {} },
    { id: 'roach', name: 'Roach', nl: 'Blankvoorn', group: 'Whitefish', shape: 'std', recommend: true, kleine: true,
      temp: [2, 8, 20, 26], light: { dawn: .8, day: .7, dusk: .85, night: .2 }, cloud: .1, press: .35, calm: .7, rain: .8,
      months: [.7, .7, .75, .8, .8, .85, .85, .85, .9, .95, .9, .75],
      habitat: { shipcanal: .8, harbour: .9, diep: .85, river: .85, shallowlake: .8, pit: .7, polder: .75 },
      how: {
        cold: { where: 'Harbours and sheltered basins. Roach keep feeding in cold water.', rig: 'Light waggler or pole, small hook.', bait: 'Maggot, pinkie, bread punch.', tip: 'Fine line and small bait get more bites in clear, cold water.' },
        mid: { where: 'Canal edges and near plants.', rig: 'Waggler or stick float.', bait: 'Maggots, bread, hemp.', tip: 'Feed little and often.' },
        warm: { where: 'Shade and plants, higher in the water.', rig: 'Float set shallower.', bait: 'Hemp, bread, maggots.', tip: 'Change depth until you find them.' }
      },
      rules: {} },
    { id: 'rudd', name: 'Rudd', nl: 'Ruisvoorn', group: 'Whitefish', shape: 'std', recommend: true, kleine: true,
      temp: [10, 16, 25, 29], light: { dawn: .8, day: .8, dusk: .85, night: .1 }, cloud: 0, press: .25, calm: .9, rain: .6,
      months: [.1, .1, .2, .4, .8, 1, 1, 1, .8, .5, .25, .1],
      habitat: { polder: 1, shallowlake: .9, diep: .75, harbour: .4, shipcanal: .25, river: .5, pit: .5 },
      how: {
        cold: { where: 'Sheltered plant-rich corners. Few bites in cold water.', rig: 'Light float.', bait: 'Maggot.', tip: 'Roach are the better choice right now.' },
        mid: { where: 'Plants and reeds, near the surface.', rig: 'Light float, shallow.', bait: 'Floating bread, maggots.', tip: 'Stay low. Rudd see you easily in clear water.' },
        warm: { where: 'Surface layer near plants.', rig: 'Surface float or a light fly rod.', bait: 'Bread crust, insects.', tip: 'Warm, still evenings are a good time to look for rises.' }
      },
      rules: {} },
    { id: 'ide', name: 'Ide', nl: 'Winde', group: 'Whitefish', shape: 'std', recommend: true, kleine: true,
      temp: [5, 10, 22, 26], light: { dawn: .85, day: .6, dusk: .85, night: .2 }, cloud: .1, press: .35, calm: .7, rain: .75,
      months: [.4, .4, .45, .4, .4, .8, .9, .9, .9, .85, .6, .45],
      habitat: { river: 1, diep: .7, harbour: .5, shipcanal: .55, shallowlake: .35, pit: .3, polder: .4 },
      how: {
        cold: { where: 'Deeper, slower sections of the Reitdiep and side waters.', rig: 'Bottom rig or trotted float.', bait: 'Worm, maggots.', tip: 'Fish slowly along the bottom.' },
        mid: { where: 'Bends, junctions and any moving water.', rig: 'Float or small spinner.', bait: 'Bread, sweetcorn, small lures.', tip: 'Often swims high in the water. Scan the surface.' },
        warm: { where: 'Upper water layer and near inflows.', rig: 'Floating bread or small lure.', bait: 'Bread crust, small spinner.', tip: 'Can be shy. Approach quietly.' }
      },
      rules: { closed: 'ide' } },
    { id: 'bleak', name: 'Bleak', nl: 'Alver', group: 'Whitefish', shape: 'std', recommend: true, kleine: true,
      temp: [8, 14, 26, 30], light: { dawn: .7, day: .95, dusk: .85, night: .05 }, cloud: 0, press: .15, calm: .9, rain: .5,
      months: [.1, .1, .2, .4, .75, 1, 1, 1, .85, .55, .25, .1],
      habitat: { harbour: .85, shipcanal: .75, river: .75, diep: .6, shallowlake: .55, pit: .55, polder: .3 },
      how: {
        cold: { where: 'Sheltered harbours. Few are active now.', rig: 'Very small float.', bait: 'Single maggot.', tip: 'Wait for warmer water.' },
        mid: { where: 'Just under the surface in open water.', rig: 'Small float, set very shallow.', bait: 'Maggot, tiny bread flake.', tip: 'Feed a light cloud to bring them up.' },
        warm: { where: 'Surface layer near harbours and quays.', rig: 'Whip with a tiny float.', bait: 'Maggot.', tip: 'Quick fishing and a good way to catch your own count on a slow day.' }
      },
      rules: {} },
    { id: 'eel', name: 'Eel', nl: 'Paling', group: 'Protected', shape: 'eel', recommend: false, kleine: true,
      temp: [10, 15, 25, 30], light: { dawn: .4, day: .1, dusk: .7, night: 1 }, cloud: .1, press: .5, calm: .8, rain: 1,
      months: [.05, .05, .1, .4, .8, 1, 1, 1, .8, .4, .1, .05],
      habitat: { shipcanal: .7, harbour: .7, diep: .7, river: .8, shallowlake: .7, pit: .5, polder: .7 },
      how: {
        cold: { where: 'Not active in cold water.', rig: 'Not recommended.', bait: 'None.', tip: 'If you catch one, release it straight away.' },
        mid: { where: 'Not recommended as a target. Eel is a protected, threatened species.', rig: 'None.', bait: 'None.', tip: 'If you catch one, release it straight away.' },
        warm: { where: 'Not recommended as a target. Eel is a protected, threatened species.', rig: 'None.', bait: 'None.', tip: 'A photo first is allowed. Release it straight away, unharmed, in the same water.' }
      },
      rules: { release: true, protect: 'Eel must go straight back, alive and unharmed, into the same water.' } },
    { id: 'catfish', name: 'Wels catfish', nl: 'Meerval', group: 'Protected', shape: 'eel', recommend: false, kleine: false,
      temp: [10, 16, 26, 30], light: { dawn: .6, day: .2, dusk: .8, night: 1 }, cloud: .1, press: .7, calm: .8, rain: .9,
      months: [.05, .05, .1, .3, .6, .8, 1, 1, .8, .5, .1, .05],
      habitat: { shipcanal: .8, harbour: .4, diep: .3, river: .6, shallowlake: .4, pit: .5, polder: .1 },
      how: {
        cold: { where: 'Closed all year.', rig: 'Not recommended.', bait: 'None.', tip: 'If you catch one, release it straight away.' },
        mid: { where: 'Closed all year.', rig: 'Not recommended.', bait: 'None.', tip: 'If you catch one, release it straight away.' },
        warm: { where: 'Closed all year.', rig: 'Not recommended.', bait: 'None.', tip: 'If you catch one, release it straight away.' }
      },
      rules: { release: true, closed: 'allyear', protect: 'Closed all year. Release immediately.' } }
  ];

  const LEVELS = [
    [0, 'Worm Drowner'], [100, 'Float Watcher'], [300, 'Bank Sitter'], [600, 'Canal Regular'],
    [1000, 'Diep Explorer'], [1500, 'Shadow Reader'], [2200, 'Zander Whisperer'], [3000, 'Pike Tamer'],
    [4000, 'Stek Keeper'], [5500, 'Reitdiep Legend'], [7500, 'Master of the Stad'], [10000, 'Grand Master of the Stad']
  ];

  const LEGAL = {
    source: 'Sportvisunie Veldgids and Kleine Lijst van VISwateren 2026',
    takeTotal: 'At most 15 fish in total, with at most 5 over 25 cm.',
    night: 'The night period runs from 2 hours after sunset to 1 hour before sunrise.',
    water: 'No fishing from bridges, in lock chambers, or within 50 m of a fish passage.',
    keepnet: 'Keepnets may only be used from sunrise to sunset.',
    live: 'Live vertebrates as bait are not allowed. Worms, maggots and midge larvae are fine.'
  };

  return { CENTER, WATER_TYPES, SPOTS, SPECIES, LEVELS, LEGAL };
});
