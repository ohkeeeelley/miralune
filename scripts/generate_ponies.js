/**
 * Script to generate MyLittlePonies.js from pony assets
 * Run: node scripts/generate_ponies.js > model/MyLittlePonies.js
 */
const fs = require('fs');
const path = require('path');

// Read existing EquestriaGirls data
const egData = require('../model/EquestriaGirls');

// Read pony files
const ponyDir = path.join(__dirname, '..', 'assets', 'ponies_assets', 'pony');
const ponyFiles = fs.readdirSync(ponyDir).filter(f => f.endsWith('.png')).sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase()));

// Clean name: remove .png, replace underscores with spaces, handle special cases
function cleanName(filename) {
  let name = filename.replace('.png', '');
  // Remove trailing numbers like _1761848439269
  name = name.replace(/_\d{10,}$/, '');
  // Replace underscores with spaces
  name = name.replace(/_/g, ' ');
  // Handle Dr. prefix
  name = name.replace(/^Dr\. /, 'Dr. ');
  // Handle special minus/dash in names
  name = name.replace(/ +/g, ' ').trim();
  // Title case if fully lowercase
  if (name === name.toLowerCase()) {
    name = name.replace(/\b\w/g, c => c.toUpperCase());
  }
  return name;
}

// MLP Locations for adventure tags
const locationMap = {
  // Apple Family
  'AppleJack': 'Sweet Apple Acres', 'Applejack Bat': 'Sweet Apple Acres', 'AppleJack Filly': 'Sweet Apple Acres',
  'Apple Bloom': 'Sweet Apple Acres', 'Apple Bumpkin': 'Sweet Apple Acres', 'Apple Cider': 'Sweet Apple Acres',
  'Apple Dumpling': 'Sweet Apple Acres', 'Apple Fritter': 'Sweet Apple Acres', 'Apple Honey': 'Sweet Apple Acres',
  'Big McIntosh': 'Sweet Apple Acres', 'Bright Mac': 'Sweet Apple Acres', 'Granny Smith': 'Sweet Apple Acres',
  'Grand Pear': 'Sweet Apple Acres', 'Candy Apples': 'Sweet Apple Acres', 'Caramel Apple': 'Sweet Apple Acres',
  'Red Delicious': 'Sweet Apple Acres', 'Red Gala': 'Sweet Apple Acres', 'Gala Appleby': 'Sweet Apple Acres',
  'Golden Delicious': 'Sweet Apple Acres', 'Jonagold': 'Sweet Apple Acres', 'Florina Tart': 'Sweet Apple Acres',
  'Lavender Fritter': 'Sweet Apple Acres', 'Babs Seed': 'Manehattan', 'Braeburn': 'Appleloosa',
  'Apple Rose': 'Sweet Apple Acres', 'Apple Strudel': 'Sweet Apple Acres',
  'Aunt Orange': 'Manehattan', 'Auntie Applesauce': 'Sweet Apple Acres',
  'Butternut': 'Sweet Apple Acres', 'Goldie Delicious': 'Sweet Apple Acres',
  'Hayseed Turnip Truck': 'Sweet Apple Acres',
  'Sea Apple Bloom': 'Seaquestria', 'Sea Applejack': 'Seaquestria',
  'Mean Applejack': 'Everfree Forest', 'Harmonized Applejack': 'Ponyville',

  // Mane 6 + Variants
  'Fluttershy': 'Ponyville', 'Fluttershy Bat': 'Everfree Forest', 'Fluttershy Saddle Rager': 'Maretropolis',
  'Flutterholly': 'Ponyville', 'Christmas Fluttershy': 'Ponyville', 'Ivy Fluttershy': 'Ponyville',
  'Sea Fluttershy': 'Seaquestria', 'Mean Fluttershy': 'Everfree Forest', 'Harmonized Fluttershy': 'Ponyville',
  'Pinkie Pie': 'Sugarcube Corner', 'Pinkie Pie Bat': 'Everfree Forest', 'Pinkamena Diane Pie': 'Sugarcube Corner',
  'Sea Pinkie Pie': 'Seaquestria', 'Mean Pinkie Pie': 'Everfree Forest', 'Harmonized Pinkie Pie': 'Sugarcube Corner',
  'Rainbow Dash': 'Cloudsdale', 'Rainbow Dash Bat': 'Everfree Forest', 'Older Rainbow Dash': 'Cloudsdale',
  'Sea Rainbow Dash': 'Seaquestria', 'Mean Rainbow Dash': 'Everfree Forest', 'Harmonized Rainbow Dash': 'Cloudsdale',
  'Snowdash': 'Cloudsdale',
  'Rarity': 'Carousel Boutique', 'Rarity Angel': 'Carousel Boutique', 'Rarity Bat': 'Everfree Forest',
  'Rarity Demon': 'Carousel Boutique', 'Christmas Rarity': 'Carousel Boutique', 'Nightmare Rarity': 'Everfree Forest',
  'Sea Rarity': 'Seaquestria', 'Mean Rarity': 'Everfree Forest', 'Harmonized Rarity': 'Carousel Boutique',
  'Twilight Sparkle': 'Canterlot', 'Princess Twilight Sparkle': 'Canterlot', 'Twilight Sparkle Bat': 'Everfree Forest',
  'Twilight Sparkle Filly': 'Canterlot', 'SciTwilight': 'Crystal Prep',
  'Sea Twilight Sparkle': 'Seaquestria', 'Mean Twilight Sparkle': 'Everfree Forest', 'Harmonized Twilight Sparkle': 'Canterlot',
  'Spike': 'Canterlot',

  // Royalty
  'Princess Cadance': 'Crystal Empire', 'Princess Celestia': 'Canterlot', 'Princess Luna': 'Canterlot',
  'Princess Skystar': 'Seaquestria', 'Princess Amore': 'Crystal Empire', 'Princess Trixie': 'Ponyville',
  'Queen Chrysalis': 'Changeling Hive', 'Queen Haven': 'Zephyr Heights', 'Queen Novo': 'Seaquestria',
  'Prince Blueblood': 'Canterlot', 'Prince Rutherford': 'Yakyakistan',
  'Shining Armor': 'Crystal Empire', 'Flurry Heart': 'Crystal Empire',
  'Cewestia': 'Canterlot', 'Daybreaker': 'Canterlot', 'Nightmare Moon': 'Everfree Forest', 'Nightmare Star': 'Everfree Forest',
  'King Sombra': 'Crystal Empire',

  // Villains
  'Discord': 'Chaosville', 'Chrysalis': 'Changeling Hive', 'Chaos Chrysalis': 'Changeling Hive',
  'Cozy Glow': 'Tartarus', 'Cozy Demon': 'Tartarus', 'Chaos Cozy Glow': 'Tartarus', 'Grown Cozy Glow': 'Tartarus',
  'Lord Tirek': 'Tartarus', 'Grogar': 'Grogar\'s Lair',
  'Tempest Shadow': 'Ponyville', 'The Storm King': 'Canterlot',
  'Pony of Shadows': 'Everfree Forest', 'Stygian': 'Everfree Forest',

  // G5 Characters
  'Sunny Starscout': 'Maretime Bay', 'Izzy Moonbow': 'Bridlewood', 'Hitch Trailblazer': 'Maretime Bay',
  'Pipp Petals': 'Zephyr Heights', 'Zipp Storm': 'Zephyr Heights',
  'Argyle Starshine': 'Maretime Bay', 'Alphabittle Blossomforth': 'Bridlewood',
  'Misty Brightdawn': 'Bridlewood', 'Cloudpuff': 'Zephyr Heights',
  'Petunia Petals': 'Zephyr Heights',

  // Wonderbolts
  'Spitfire': 'Wonderbolt Academy', 'Soarin': 'Wonderbolt Academy', 'Fleetfoot': 'Wonderbolt Academy',
  'Fire Streak': 'Wonderbolt Academy', 'High Winds': 'Wonderbolt Academy', 'Misty Fly': 'Wonderbolt Academy',
  'Lightning Dust': 'Wonderbolt Academy', 'Silver Zoom': 'Wonderbolt Academy', 'Surprise': 'Wonderbolt Academy',
  'Wind Rider': 'Wonderbolt Academy', 'Blaze': 'Wonderbolt Academy',

  // CMC
  'Scootaloo': 'Ponyville', 'Sweetie Belle': 'Ponyville',
  'Sea Scootaloo': 'Seaquestria', 'Sea Sweetie Belle': 'Seaquestria',
  'Diamond Tiara': 'Ponyville', 'Silver Spoon': 'Ponyville',

  // Pillars of Equestria
  'Star Swirl the Bearded': 'Canterlot', 'Flash Magnus': 'Cloudsdale', 'Rockhoof': 'Mighty Helm',
  'Mistmane': 'Canterlot', 'Somnambula': 'Somnambula', 'Meadowbrook': 'Hayseed Swamp',

  // Young Six
  'Gallus': 'School of Friendship', 'Ocellus': 'School of Friendship', 'Sandbar': 'School of Friendship',
  'Silverstream': 'School of Friendship', 'Smolder': 'School of Friendship', 'Yona': 'School of Friendship',
  'Sea Silverstream': 'Seaquestria',

  // Crystal Prep / EG crossover ponies
  'Sugarcoat': 'Crystal Prep', 'Sugar Coat Crystalized': 'Crystal Prep',
  'Sunny Flare': 'Crystal Prep', 'Sunny Flare Crystalized': 'Crystal Prep',
  'Lemon Zest': 'Crystal Prep',

  // Pie Family
  'Maud Pie': 'Rock Farm', 'Limestone Pie': 'Rock Farm', 'Marble Pie': 'Rock Farm',
  'Cloudy Quartz': 'Rock Farm', 'Igneous Rock Pie': 'Rock Farm',

  // Shy Family
  'Mr Shy': 'Ponyville', 'Mrs Shy': 'Ponyville',

  // Starlight's village / associates
  'Starlight Glimmer': 'Our Town', 'Starlight Glimmer Power': 'Our Town',
  'Sunburst': 'Crystal Empire', 'Trixie Lulamoon': 'Ponyville',
  'Double Diamond': 'Our Town', 'Night Glider': 'Our Town', 'Party Favor': 'Our Town', 'Sugar Belle': 'Our Town',
  'Firelight': 'Sire\'s Hollow',

  // Canterlot
  'Fancy Pants': 'Canterlot', 'Fleur De Lis': 'Canterlot', 'Fleur Dis Lee': 'Canterlot',
  'Hoity Toity': 'Canterlot', 'Jet Set': 'Canterlot', 'Upper Crust': 'Canterlot',
  'Raven Inkwell': 'Canterlot', 'Chancellor Neighsay': 'Canterlot',
  'Perfect Pace': 'Canterlot', 'Royal Ribbon': 'Canterlot',

  // Ponyville residents
  'Derpy Hooves': 'Ponyville', 'Dr. Hooves': 'Ponyville', 'Lyra Heartstring': 'Ponyville',
  'Bon Bon': 'Ponyville', 'Bonbon': 'Ponyville', 'Cheerilee': 'Ponyville', 'Cheerliee': 'Ponyville',
  'Mayor Mare': 'Ponyville', 'Roseluck': 'Ponyville', 'Daisy': 'Ponyville', 'Lily Valley': 'Ponyville',
  'Carrot Top': 'Ponyville', 'Berry Punch': 'Ponyville', 'Minuette': 'Ponyville',
  'Vinyl Scratch': 'Ponyville', 'Octavia Melody': 'Canterlot',
  'Nurse Redheart': 'Ponyville', 'Nurse Sweetheart': 'Ponyville', 'Nurse Snowheart': 'Ponyville', 'Nurse Tenderheart': 'Ponyville',
  'Mr. Cake': 'Sugarcube Corner', 'Mr Carrot Cake': 'Sugarcube Corner', 'Mrs Cup Cake': 'Sugarcube Corner',
  'Pound Cake': 'Sugarcube Corner', 'Pumpkin Cake': 'Sugarcube Corner',
  'Filthy Rich': 'Ponyville', 'Spoiled Rich': 'Ponyville',
  'Cookie Crumbles': 'Ponyville', 'Hondo Flanks': 'Ponyville',
  'Coco Pommel': 'Manehattan', 'Saffron Masala': 'Canterlot',
  'Coloratura': 'Manehattan', 'Cheese Sandwich': 'Ponyville',
  'Featherweight': 'Ponyville', 'Pipsqueak': 'Ponyville', 'Twist': 'Ponyville',
  'Snails': 'Ponyville', 'Snips': 'Ponyville',
  'Cranky Doodle Donkey': 'Ponyville', 'Matilda': 'Ponyville',
  'Bulk Biceps': 'Ponyville', 'Thunderlane': 'Ponyville',
  'Dr. Fauna': 'Ponyville', 'Dr. Horse': 'Ponyville', 'Doctor Stable': 'Ponyville',
  'Zecora': 'Everfree Forest', 'Iron Will': 'Ponyville',
  'Photo Finish': 'Ponyville', 'Sapphire Shores': 'Canterlot',
  'Sea Swirl': 'Ponyville', 'Shoeshine': 'Ponyville',
  'Amethyst Star': 'Ponyville', 'Lemon Hearts': 'Canterlot', 'Twinkleshine': 'Canterlot',
  'Dinky Doo': 'Ponyville', 'Crescent Doo': 'Ponyville',
  'Bow Hothoof': 'Cloudsdale', 'Windy Whistles': 'Cloudsdale', 'Sea Windy Whistles': 'Seaquestria',
  'Twilight Velvet': 'Canterlot', 'Night Light': 'Canterlot',
  'Pear Butter': 'Sweet Apple Acres', 'Bright Macintosh': 'Sweet Apple Acres',
  'Stellar Flare': 'Sire\'s Hollow',

  // Creatures & non-ponies
  'Angel': 'Ponyville', 'Gummy': 'Sugarcube Corner', 'Opalescence': 'Carousel Boutique',
  'Owlowiscious': 'Ponyville', 'Tank': 'Ponyville', 'Winona': 'Sweet Apple Acres',
  'Philomena': 'Canterlot', 'Harry': 'Everfree Forest',
  'Cerberus': 'Tartarus', 'Cockatrice': 'Everfree Forest', 'Tatzlwurm': 'Everfree Forest',
  'Hydra': 'Froggy Bottom Bogg', 'Bugbear': 'Ponyville', 'Timberwolves': 'Everfree Forest',
  'Parasprites': 'Everfree Forest', 'Windigo': 'Everfree Forest',
  'Ember': 'Dragon Lands', 'Garble': 'Dragon Lands', 'Smooze': 'Ponyville',
  'Chimera': 'Everfree Forest', 'Tantabus': 'Dream Realm',

  // Griffons / Other species
  'Gilda': 'Griffonstone', 'Gabby': 'Griffonstone',
  'Capper': 'Klugetown', 'Captain Celaeno': 'Sky Pirates',
  'Grubber': 'Canterlot', 'Thorax': 'Changeling Hive', 'Pharynx': 'Changeling Hive',

  // Power Ponies
  'Fili-Second': 'Maretropolis', 'Fili Second Rainbowfied': 'Maretropolis',
  'Mane-iac': 'Maretropolis', 'Masked Matter-Horn': 'Maretropolis',
  'Masked Matter-Horn 2': 'Maretropolis', 'Masked Matter-Horn Rainbowfied': 'Maretropolis',
  'Radiance': 'Maretropolis', 'Radiance Rainbowfied': 'Maretropolis',
  'Saddle Rager': 'Maretropolis', 'Mistress Marevelous': 'Maretropolis',
  'Mistress Marevelous Rainbowfied': 'Maretropolis', 'Humdrum': 'Maretropolis',
  'Zapp': 'Maretropolis', 'Zapp Rainbowfied': 'Maretropolis',

  // Spirits
  'Spirit of Hearths Warming Past': 'Canterlot',
  'Spirit of Hearths Warming Presents': 'Canterlot',
  'Spirit of Hearths Warming Yet to Come': 'Canterlot',

  // Sunset & EG crossovers in pony form
  'Sunset Shimmer': 'Canterlot', 'Sunset Satan': 'Canterlot',
  'Adagio Dazzle': 'Canterlot', 'Aria Blaze': 'Canterlot', 'Sonata Dusk': 'Canterlot',
  'Midnight Sparkle': 'Crystal Prep', 'Juniper Montage': 'Canterlot', 'Gloriosa Daisy': 'Camp Everfree',
  'Timber Spruce': 'Camp Everfree', 'Vignette Valencia': 'Canterlot', 'Wallflower Blush': 'Canterlot',

  // Elements
  'Element Of Magic': 'Tree of Harmony', 'Element Of Loyalty': 'Tree of Harmony',
  'Element Of Laughter': 'Tree of Harmony', 'Element Of Kindness': 'Tree of Harmony',
  'Element Of Honesty': 'Tree of Harmony', 'Element Of Generosity': 'Tree of Harmony',

  // Kirin
  'Autumn Blaze': 'Kirin Village', 'Rain Shine': 'Kirin Village', 'Nirik': 'Kirin Village',

  // Flim & Flam
  'Flim': 'Ponyville', 'Flam': 'Ponyville',

  // Others with known locations
  'Daring Do': 'Tenochtitlan Basin', 'Dr. Caballeron': 'Tenochtitlan Basin',
  'Ahuizotl': 'Tenochtitlan Basin',
  'Sassy Saddles': 'Canterlot', 'Svengallop': 'Manehattan',
  'Cherry Jubilee': 'Dodge Junction', 'Chief Thunderhooves': 'Appleloosa',
  'Little Strongheart': 'Appleloosa', 'Sheriff Silverstar': 'Appleloosa',
  'Trenderhoof': 'Canterlot', 'Tree Hugger': 'Ponyville',
  'Moon Dancer': 'Canterlot', 'Luster Dawn': 'Canterlot',
  'Torque Wrench': 'Ponyville', 'Vapor Trail': 'Cloudsdale', 'Sky Stinger': 'Cloudsdale',
  'Songbird Serenade': 'Canterlot', 'Steven Magnet': 'Everfree Forest',
  'Seabreeze': 'Breezies Village', 'Kerfuffle': 'Rainbow Falls',
  'Trouble Shoes': 'Appleloosa', 'Tender Taps': 'Ponyville',
  'Cloud Kicker': 'Cloudsdale', 'Cloudchaser': 'Cloudsdale',
  'Sunshower Raindrops': 'Ponyville', 'Cerulean Skies': 'Cloudsdale',
  'Fluffle Puff': 'Ponyville', 'Screwball': 'Ponyville', 'Snowfall Frost': 'Canterlot',
  'Jack Pot': 'Las Pegasus', 'Snap Shutter': 'Ponyville', 'Mane Allgood': 'Ponyville',
  'Clear Sky': 'Ponyville', 'Suri Polomare': 'Manehattan',
  'Zephyr Breeze': 'Ponyville', 'Mudbriar': 'Ponyville', 'Mudbrair': 'Ponyville',
  'Gusty the Great': 'Canterlot', 'Fido': 'Everfree Forest', 'Rover': 'Everfree Forest', 'Spot': 'Everfree Forest',
  'Caterpillar': 'Everfree Forest', 'Woona': 'Canterlot',
  'Skellinore': 'Ponyville', 'Umbrum': 'Crystal Empire',
  'Snow Drop': 'Cloudsdale', 'Button Mash': 'Ponyville',
  'Nocturn': 'Canterlot', 'Night Watch': 'Canterlot', 'Guard': 'Canterlot',
  'Shadow Lock': 'Canterlot', 'Stygian': 'Hollow Shades',
  'Rumble': 'Ponyville', 'Zipporwhill': 'Ponyville',
  'Lighthoof': 'Ponyville', 'Shimmy Shake': 'Ponyville',

  // Sea ponies
  'Sean Terramar': 'Seaquestria', 'Terramar': 'Seaquestria', 'Sea Terramar': 'Seaquestria',
  'Ocean Flow': 'Seaquestria', 'Sky Beak': 'Mount Aris',
  'Sea Starlight Glimmer': 'Seaquestria', 'Sea Sunset Shimmer': 'Seaquestria',
};

// Family groupings
const familyMap = {
  // Apple Family
  'AppleJack': 'Apple Family', 'Applejack Bat': 'Apple Family', 'AppleJack Filly': 'Apple Family',
  'Apple Bloom': 'Apple Family', 'Apple Bumpkin': 'Apple Family', 'Apple Cider': 'Apple Family',
  'Apple Dumpling': 'Apple Family', 'Apple Fritter': 'Apple Family', 'Apple Honey': 'Apple Family',
  'Big McIntosh': 'Apple Family', 'Bright Mac': 'Apple Family', 'Granny Smith': 'Apple Family',
  'Grand Pear': 'Pear Family', 'Babs Seed': 'Apple Family', 'Braeburn': 'Apple Family',
  'Apple Rose': 'Apple Family', 'Apple Strudel': 'Apple Family', 'Aunt Orange': 'Apple Family',
  'Auntie Applesauce': 'Apple Family', 'Butternut': 'Apple Family',
  'Goldie Delicious': 'Apple Family', 'Pear Butter': 'Apple Family',
  'Bright Macintosh': 'Apple Family', 'Candy Apples': 'Apple Family', 'Caramel Apple': 'Apple Family',
  'Red Delicious': 'Apple Family', 'Red Gala': 'Apple Family', 'Gala Appleby': 'Apple Family',
  'Golden Delicious': 'Apple Family', 'Jonagold': 'Apple Family', 'Florina Tart': 'Apple Family',
  'Lavender Fritter': 'Apple Family', 'Hayseed Turnip Truck': 'Apple Family',
  'Sea Apple Bloom': 'Apple Family', 'Sea Applejack': 'Apple Family',
  'Mean Applejack': 'Mean Six', 'Harmonized Applejack': 'Mane Six',

  // Mane 6
  'Fluttershy': 'Mane Six', 'Pinkie Pie': 'Mane Six', 'Rainbow Dash': 'Mane Six',
  'Rarity': 'Mane Six', 'Twilight Sparkle': 'Mane Six', 'Spike': 'Mane Six',
  'Princess Twilight Sparkle': 'Mane Six',

  // Variants
  'Fluttershy Bat': 'Mane Six', 'Fluttershy Saddle Rager': 'Power Ponies',
  'Flutterholly': 'Mane Six', 'Christmas Fluttershy': 'Mane Six', 'Ivy Fluttershy': 'Mane Six',
  'Sea Fluttershy': 'Mane Six', 'Mean Fluttershy': 'Mean Six', 'Harmonized Fluttershy': 'Mane Six',
  'Pinkie Pie Bat': 'Mane Six', 'Pinkamena Diane Pie': 'Mane Six',
  'Sea Pinkie Pie': 'Mane Six', 'Mean Pinkie Pie': 'Mean Six', 'Harmonized Pinkie Pie': 'Mane Six',
  'Rainbow Dash Bat': 'Mane Six', 'Older Rainbow Dash': 'Mane Six', 'Snowdash': 'Mane Six',
  'Sea Rainbow Dash': 'Mane Six', 'Mean Rainbow Dash': 'Mean Six', 'Harmonized Rainbow Dash': 'Mane Six',
  'Rarity Angel': 'Mane Six', 'Rarity Bat': 'Mane Six', 'Rarity Demon': 'Mane Six',
  'Christmas Rarity': 'Mane Six', 'Nightmare Rarity': 'Mane Six',
  'Sea Rarity': 'Mane Six', 'Mean Rarity': 'Mean Six', 'Harmonized Rarity': 'Mane Six',
  'Twilight Sparkle Bat': 'Mane Six', 'Twilight Sparkle Filly': 'Mane Six',
  'Sea Twilight Sparkle': 'Mane Six', 'Mean Twilight Sparkle': 'Mean Six', 'Harmonized Twilight Sparkle': 'Mane Six',
  'SciTwilight': 'Mane Six',

  // Royalty
  'Princess Cadance': 'Royalty', 'Princess Celestia': 'Royalty', 'Princess Luna': 'Royalty',
  'Princess Skystar': 'Royalty', 'Princess Amore': 'Royalty', 'Princess Trixie': 'Royalty',
  'Queen Chrysalis': 'Changeling', 'Queen Haven': 'Royalty', 'Queen Novo': 'Royalty',
  'Prince Blueblood': 'Royalty', 'Prince Rutherford': 'Royalty',
  'Shining Armor': 'Royalty', 'Flurry Heart': 'Royalty',
  'Cewestia': 'Royalty', 'Daybreaker': 'Royalty', 'Nightmare Moon': 'Royalty', 'Nightmare Star': 'Royalty',
  'King Sombra': 'Royalty',

  // Villains
  'Discord': 'Villain', 'Chrysalis': 'Changeling', 'Chaos Chrysalis': 'Changeling',
  'Cozy Glow': 'Villain', 'Cozy Demon': 'Villain', 'Chaos Cozy Glow': 'Villain', 'Grown Cozy Glow': 'Villain',
  'Lord Tirek': 'Villain', 'Grogar': 'Villain',
  'Tempest Shadow': 'Villain', 'The Storm King': 'Villain',
  'Pony of Shadows': 'Villain', 'Stygian': 'Pillars of Equestria',

  // G5
  'Sunny Starscout': 'Mane Five (G5)', 'Izzy Moonbow': 'Mane Five (G5)', 'Hitch Trailblazer': 'Mane Five (G5)',
  'Pipp Petals': 'Mane Five (G5)', 'Zipp Storm': 'Mane Five (G5)',
  'Argyle Starshine': 'Mane Five (G5)', 'Alphabittle Blossomforth': 'Mane Five (G5)',
  'Misty Brightdawn': 'Mane Five (G5)', 'Cloudpuff': 'Mane Five (G5)',
  'Petunia Petals': 'Mane Five (G5)',

  // Wonderbolts
  'Spitfire': 'Wonderbolts', 'Soarin': 'Wonderbolts', 'Fleetfoot': 'Wonderbolts',
  'Fire Streak': 'Wonderbolts', 'High Winds': 'Wonderbolts', 'Misty Fly': 'Wonderbolts',
  'Lightning Dust': 'Wonderbolts', 'Silver Zoom': 'Wonderbolts', 'Surprise': 'Wonderbolts',
  'Wind Rider': 'Wonderbolts', 'Blaze': 'Wonderbolts',

  // CMC
  'Scootaloo': 'Cutie Mark Crusaders', 'Sweetie Belle': 'Cutie Mark Crusaders',
  'Diamond Tiara': 'Ponyville', 'Silver Spoon': 'Ponyville',
  'Sea Scootaloo': 'Cutie Mark Crusaders', 'Sea Sweetie Belle': 'Cutie Mark Crusaders',

  // Pillars
  'Star Swirl the Bearded': 'Pillars of Equestria', 'Flash Magnus': 'Pillars of Equestria',
  'Rockhoof': 'Pillars of Equestria', 'Mistmane': 'Pillars of Equestria',
  'Somnambula': 'Pillars of Equestria', 'Meadowbrook': 'Pillars of Equestria',

  // Young Six
  'Gallus': 'Young Six', 'Ocellus': 'Young Six', 'Sandbar': 'Young Six',
  'Silverstream': 'Young Six', 'Smolder': 'Young Six', 'Yona': 'Young Six',
  'Sea Silverstream': 'Young Six',

  // Pie Family
  'Maud Pie': 'Pie Family', 'Limestone Pie': 'Pie Family', 'Marble Pie': 'Pie Family',
  'Cloudy Quartz': 'Pie Family', 'Igneous Rock Pie': 'Pie Family',

  // Shy Family
  'Mr Shy': 'Shy Family', 'Mrs Shy': 'Shy Family',

  // Power Ponies
  'Fili-Second': 'Power Ponies', 'Fili Second Rainbowfied': 'Power Ponies',
  'Mane-iac': 'Power Ponies', 'Masked Matter-Horn': 'Power Ponies',
  'Masked Matter-Horn 2': 'Power Ponies', 'Masked Matter-Horn Rainbowfied': 'Power Ponies',
  'Radiance': 'Power Ponies', 'Radiance Rainbowfied': 'Power Ponies',
  'Saddle Rager': 'Power Ponies', 'Mistress Marevelous': 'Power Ponies',
  'Mistress Marevelous Rainbowfied': 'Power Ponies', 'Humdrum': 'Power Ponies',
  'Zapp': 'Power Ponies', 'Zapp Rainbowfied': 'Power Ponies',

  // Elements
  'Element Of Magic': 'Elements of Harmony', 'Element Of Loyalty': 'Elements of Harmony',
  'Element Of Laughter': 'Elements of Harmony', 'Element Of Kindness': 'Elements of Harmony',
  'Element Of Honesty': 'Elements of Harmony', 'Element Of Generosity': 'Elements of Harmony',

  // Dazzlings
  'Adagio Dazzle': 'The Dazzlings', 'Aria Blaze': 'The Dazzlings', 'Sonata Dusk': 'The Dazzlings',

  // Changelings
  'Thorax': 'Changeling', 'Pharynx': 'Changeling',

  // Cake Family
  'Mr. Cake': 'Cake Family', 'Mr Carrot Cake': 'Cake Family', 'Mrs Cup Cake': 'Cake Family',
  'Pound Cake': 'Cake Family', 'Pumpkin Cake': 'Cake Family',

  // Pets
  'Angel': 'Pet', 'Gummy': 'Pet', 'Opalescence': 'Pet', 'Owlowiscious': 'Pet',
  'Tank': 'Pet', 'Winona': 'Pet', 'Philomena': 'Pet',

  // Mean Six
  'Mean Applejack': 'Mean Six', 'Mean Fluttershy': 'Mean Six', 'Mean Pinkie Pie': 'Mean Six',
  'Mean Rainbow Dash': 'Mean Six', 'Mean Rarity': 'Mean Six', 'Mean Twilight Sparkle': 'Mean Six',

  // Kirin
  'Autumn Blaze': 'Kirin', 'Rain Shine': 'Kirin', 'Nirik': 'Kirin',

  // EG families for the Equestria Girls entries
  'Sunset Shimmer': 'Equestria Girls', 'Sunset Satan': 'Equestria Girls',
  'Midnight Sparkle': 'Equestria Girls', 'Daydream Shimmer': 'Equestria Girls',
  'Gaia Everfree': 'Equestria Girls', 'Gloriosa Daisy': 'Equestria Girls',
  'Juniper Montage': 'Equestria Girls', 'Vignette Valencia': 'Equestria Girls',
  'Wallflower Blush': 'Equestria Girls', 'Timber Spruce': 'Equestria Girls',
  'Flash Centry': 'Equestria Girls',
};

// Rarity assignment for ponies based on character importance
const rarityOverrides = {
  // Goddess tier - Celestia, Luna, etc.
  'Princess Celestia': 'Goddess', 'Princess Luna': 'Goddess', 'Daybreaker': 'Goddess',
  'Nightmare Moon': 'Goddess', 'Discord': 'Goddess', 'Queen Novo': 'Goddess',
  'Queen Chrysalis': 'Goddess',

  // Secret tier
  'Midnight Sparkle': 'Secret', 'Nightmare Rarity': 'Secret', 'Nightmare Star': 'Secret',
  'Pony of Shadows': 'Secret', 'Shadow Lock': 'Secret', 'Sunset Satan': 'Secret',
  'Cozy Demon': 'Secret', 'Chaos Chrysalis': 'Secret', 'Chaos Cozy Glow': 'Secret',
  'Tantabus': 'Secret',

  // Radiance tier
  'Element Of Magic': 'Radiance', 'Element Of Loyalty': 'Radiance', 'Element Of Laughter': 'Radiance',
  'Element Of Kindness': 'Radiance', 'Element Of Honesty': 'Radiance', 'Element Of Generosity': 'Radiance',
  'Harmonized Twilight Sparkle': 'Radiance', 'Harmonized Applejack': 'Radiance',
  'Harmonized Fluttershy': 'Radiance', 'Harmonized Pinkie Pie': 'Radiance',
  'Harmonized Rainbow Dash': 'Radiance', 'Harmonized Rarity': 'Radiance',
  'Fili Second Rainbowfied': 'Radiance', 'Masked Matter-Horn Rainbowfied': 'Radiance',
  'Radiance Rainbowfied': 'Radiance', 'Mistress Marevelous Rainbowfied': 'Radiance',
  'Zapp Rainbowfied': 'Radiance',

  // Legend tier - Mane 6, G5 Mane 5, Pillars
  'Twilight Sparkle': 'Legend', 'Princess Twilight Sparkle': 'Legend',
  'Fluttershy': 'Legend', 'Rainbow Dash': 'Legend', 'Rarity': 'Legend', 'Pinkie Pie': 'Legend',
  'Spike': 'Legend',
  'Sunny Starscout': 'Legend', 'Izzy Moonbow': 'Legend', 'Hitch Trailblazer': 'Legend',
  'Pipp Petals': 'Legend', 'Zipp Storm': 'Legend',
  'Star Swirl the Bearded': 'Legend', 'Flash Magnus': 'Legend', 'Rockhoof': 'Legend',
  'Mistmane': 'Legend', 'Somnambula': 'Legend', 'Meadowbrook': 'Legend',
  'Starlight Glimmer': 'Legend', 'Tempest Shadow': 'Legend',

  // Majestic tier - Important secondary characters
  'AppleJack': 'Majestic', 'Shining Armor': 'Majestic', 'Princess Cadance': 'Majestic',
  'Princess Skystar': 'Majestic', 'Flurry Heart': 'Majestic',
  'Trixie Lulamoon': 'Majestic', 'Sunset Shimmer': 'Majestic', 'Sunburst': 'Majestic',
  'Spitfire': 'Majestic', 'King Sombra': 'Majestic', 'Lord Tirek': 'Majestic',
  'Cozy Glow': 'Majestic', 'Chrysalis': 'Majestic', 'The Storm King': 'Majestic',
  'Grogar': 'Majestic', 'Ember': 'Majestic', 'Thorax': 'Majestic',
  'Songbird Serenade': 'Majestic', 'Captain Celaeno': 'Majestic', 'Capper': 'Majestic',
  'Maud Pie': 'Majestic', 'Princess Amore': 'Majestic',
  'Cewestia': 'Majestic', 'Woona': 'Majestic',
  'Queen Haven': 'Majestic', 'Misty Brightdawn': 'Majestic',
  'Prince Blueblood': 'Majestic', 'Fancy Pants': 'Majestic',
  'Adagio Dazzle': 'Majestic',
  'Grown Cozy Glow': 'Majestic',
  'Coloratura': 'Majestic', 'Cheese Sandwich': 'Majestic',
  'SciTwilight': 'Majestic', 'Iron Will': 'Majestic',

  // Epic tier
  'Apple Bloom': 'Epic', 'Scootaloo': 'Epic', 'Sweetie Belle': 'Epic',
  'Big McIntosh': 'Epic', 'Granny Smith': 'Epic',
  'Derpy Hooves': 'Epic', 'Dr. Hooves': 'Epic', 'Vinyl Scratch': 'Epic',
  'Octavia Melody': 'Epic', 'Lyra Heartstring': 'Epic',
  'Cheerilee': 'Epic', 'Mayor Mare': 'Epic',
  'Daring Do': 'Epic', 'Soarin': 'Epic', 'Fleetfoot': 'Epic',
  'Gallus': 'Epic', 'Ocellus': 'Epic', 'Sandbar': 'Epic',
  'Silverstream': 'Epic', 'Smolder': 'Epic', 'Yona': 'Epic',
  'Bon Bon': 'Epic', 'Bonbon': 'Epic',
  'Diamond Tiara': 'Epic', 'Silver Spoon': 'Epic',
  'Babs Seed': 'Epic', 'Pear Butter': 'Epic',
  'Bright Mac': 'Epic', 'Grand Pear': 'Epic',
  'Lightning Dust': 'Epic', 'Gilda': 'Epic', 'Autumn Blaze': 'Epic',
  'Pinkamena Diane Pie': 'Epic', 'Coco Pommel': 'Epic',
  'Fleur De Lis': 'Epic', 'Photo Finish': 'Epic',
  'Luster Dawn': 'Epic', 'Moon Dancer': 'Epic',
  'Aria Blaze': 'Epic', 'Sonata Dusk': 'Epic',
  'Saffron Masala': 'Epic', 'Sugar Belle': 'Epic',
  'Filthy Rich': 'Epic', 'Spoiled Rich': 'Epic',
  'Double Diamond': 'Epic', 'Night Glider': 'Epic', 'Party Favor': 'Epic',
  'Pharynx': 'Epic', 'Gabby': 'Epic',
  'Gloriosa Daisy': 'Epic', 'Juniper Montage': 'Epic',
  'Mane-iac': 'Epic',

  // Rare tier
  'Minuette': 'Rare', 'Roseluck': 'Rare', 'Daisy': 'Rare', 'Lily Valley': 'Rare',
  'Berry Punch': 'Rare', 'Carrot Top': 'Rare', 'Nurse Redheart': 'Rare',
  'Snails': 'Rare', 'Snips': 'Rare', 'Featherweight': 'Rare', 'Twist': 'Rare',
  'Pipsqueak': 'Rare', 'Amethyst Star': 'Rare', 'Lemon Hearts': 'Rare',
  'Twinkleshine': 'Rare', 'Sea Swirl': 'Rare',
  'Bow Hothoof': 'Rare', 'Windy Whistles': 'Rare',
  'Twilight Velvet': 'Rare', 'Night Light': 'Rare',
  'Mr Shy': 'Rare', 'Mrs Shy': 'Rare',
  'Cloudy Quartz': 'Rare', 'Igneous Rock Pie': 'Rare',
  'Limestone Pie': 'Rare', 'Marble Pie': 'Rare',
  'Cookie Crumbles': 'Rare', 'Hondo Flanks': 'Rare',
  'Braeburn': 'Rare', 'Thunderlane': 'Rare', 'Bulk Biceps': 'Rare',
  'Zecora': 'Rare', 'Cherry Jubilee': 'Rare',
  'Sapphire Shores': 'Rare', 'Hoity Toity': 'Rare',
  'Sassy Saddles': 'Rare', 'Trenderhoof': 'Rare',
  'Rumble': 'Rare', 'Tender Taps': 'Rare', 'Button Mash': 'Rare',
  'Cranky Doodle Donkey': 'Rare', 'Matilda': 'Rare',
  'Tree Hugger': 'Rare', 'Mudbriar': 'Rare', 'Mudbrair': 'Rare',
  'Zephyr Breeze': 'Rare', 'Flash Sentry': 'Rare',
  'Timber Spruce': 'Rare', 'Vignette Valencia': 'Rare',
  'Wallflower Blush': 'Rare', 'Lemon Zest': 'Rare',
  'Sugarcoat': 'Rare', 'Sunny Flare': 'Rare',
  'Silver Spoon': 'Epic',
  'Dinky Doo': 'Rare', 'Crescent Doo': 'Rare',
  'Shoeshine': 'Rare', 'Sunshower Raindrops': 'Rare',
  'Cherry Berry': 'Rare',
  'Stellar Flare': 'Rare', 'Firelight': 'Rare',
  'Snap Shutter': 'Rare', 'Mane Allgood': 'Rare', 'Clear Sky': 'Rare',
  'Terramar': 'Rare', 'Sky Beak': 'Rare', 'Ocean Flow': 'Rare',
  'Kerfuffle': 'Rare', 'Argyle Starshine': 'Rare', 'Alphabittle Blossomforth': 'Rare',
  'Petunia Petals': 'Rare', 'Cloudpuff': 'Rare',
  'Rain Shine': 'Rare', 'Starlight Glimmer Power': 'Rare',
  'Fleur Dis Lee': 'Rare', 'Gilded Lily': 'Rare',
  'Mr. Cake': 'Rare', 'Mr Carrot Cake': 'Rare', 'Mrs Cup Cake': 'Rare',
  'Pound Cake': 'Rare', 'Pumpkin Cake': 'Rare',
  'Snow Drop': 'Rare', 'Snowfall Frost': 'Rare',
  'Silver Shill': 'Rare', 'Bright Macintosh': 'Rare',
  'Fluffle Puff': 'Rare', 'Screwball': 'Rare',
  'Jack Pot': 'Rare',
  'Sheriff Silverstar': 'Rare', 'Chief Thunderhooves': 'Rare',
  'Little Strongheart': 'Rare', 'Trouble Shoes': 'Rare',
  'Gladmane': 'Rare', 'Chancellor Neighsay': 'Rare',
  'Dr. Fauna': 'Rare', 'Dr. Horse': 'Rare', 'Doctor Stable': 'Rare',
  'Dr. Caballeron': 'Rare', 'Ahuizotl': 'Rare',

  // Sea ponies — Epic
  'Sea Apple Bloom': 'Epic', 'Sea Applejack': 'Epic', 'Sea Fluttershy': 'Epic',
  'Sea Pinkie Pie': 'Epic', 'Sea Rainbow Dash': 'Epic', 'Sea Rarity': 'Epic',
  'Sea Scootaloo': 'Epic', 'Sea Sweetie Belle': 'Epic', 'Sea Twilight Sparkle': 'Epic',
  'Sea Silverstream': 'Epic', 'Sea Starlight Glimmer': 'Epic', 'Sea Sunset Shimmer': 'Epic',
  'Sea Windy Whistles': 'Epic', 'Sea Terramar': 'Epic',

  // Bat ponies — Epic
  'Applejack Bat': 'Epic', 'Fluttershy Bat': 'Epic', 'Pinkie Pie Bat': 'Epic',
  'Rainbow Dash Bat': 'Epic', 'Rarity Bat': 'Epic', 'Twilight Sparkle Bat': 'Epic',

  // Power Ponies — Epic
  'Fili-Second': 'Epic', 'Masked Matter-Horn': 'Epic', 'Masked Matter-Horn 2': 'Epic',
  'Radiance': 'Epic', 'Saddle Rager': 'Epic', 'Mistress Marevelous': 'Epic',
  'Humdrum': 'Epic', 'Zapp': 'Epic',

  // Holiday specials — Rare
  'Christmas Fluttershy': 'Rare', 'Christmas Rarity': 'Rare',
  'Flutterholly': 'Rare', 'Merry': 'Rare',
  'Spirit of Hearths Warming Past': 'Rare',
  'Spirit of Hearths Warming Presents': 'Rare',
  'Spirit of Hearths Warming Yet to Come': 'Rare',
};

// Description templates - we know all the MLP characters
const descriptions = {
  // Mane 6
  'AppleJack': 'Honest and hardworking earth pony who runs Sweet Apple Acres with her family.',
  'AppleJack Filly': 'A young Applejack before she earned her cutie mark.',
  'Applejack Bat': 'Applejack transformed into a fruit bat pony by Fluttershy\'s spell.',
  'Fluttershy': 'Kind and gentle pegasus with an extraordinary talent for communicating with animals.',
  'Fluttershy Bat': 'Fluttershy transformed into a vampire fruit bat by a spell gone wrong.',
  'Fluttershy Saddle Rager': 'Fluttershy\'s Power Pony alter ego with incredible strength.',
  'Flutterholly': 'Fluttershy dressed as Holly from the Hearth\'s Warming holiday.',
  'Christmas Fluttershy': 'Fluttershy in her festive holiday outfit.',
  'Ivy Fluttershy': 'Fluttershy adorned with beautiful ivy decorations.',
  'Pinkie Pie': 'Energetic and fun-loving earth pony who brings joy wherever she goes.',
  'Pinkie Pie Bat': 'Pinkie Pie transformed into a mischievous bat pony.',
  'Pinkamena Diane Pie': 'Pinkie Pie\'s alternate personality when her mane goes flat.',
  'Rainbow Dash': 'Loyal and competitive pegasus who dreams of joining the Wonderbolts.',
  'Rainbow Dash Bat': 'Rainbow Dash transformed into a bat pony.',
  'Older Rainbow Dash': 'Rainbow Dash from the future, now a Wonderbolt captain.',
  'Snowdash': 'Rainbow Dash in her winter wonderland outfit.',
  'Rarity': 'Generous and fashion-forward unicorn who runs the Carousel Boutique.',
  'Rarity Angel': 'Rarity in her angelic form, radiating pure generosity.',
  'Rarity Bat': 'Rarity transformed into an elegant bat pony.',
  'Rarity Demon': 'Rarity consumed by dark magic and greed.',
  'Christmas Rarity': 'Rarity in her glamorous holiday ensemble.',
  'Nightmare Rarity': 'Rarity possessed by the Nightmare Forces.',
  'Twilight Sparkle': 'Brilliant unicorn turned alicorn, the Princess of Friendship.',
  'Princess Twilight Sparkle': 'Twilight Sparkle after her coronation as the Princess of Friendship.',
  'Twilight Sparkle Bat': 'Twilight Sparkle transformed into a bat pony.',
  'Twilight Sparkle Filly': 'A young Twilight Sparkle, already showing magical talent.',
  'SciTwilight': 'The human world\'s version of Twilight Sparkle from Crystal Prep.',
  'Spike': 'Twilight\'s loyal baby dragon assistant and friend.',

  // Royalty
  'Princess Celestia': 'The regal co-ruler of Equestria who raises the sun each day.',
  'Princess Luna': 'Princess of the Night who watches over ponies\' dreams.',
  'Princess Cadance': 'The Princess of Love who rules the Crystal Empire.',
  'Princess Skystar': 'Cheerful seapony princess, daughter of Queen Novo.',
  'Princess Amore': 'Ancient ruler of the Crystal Empire before King Sombra.',
  'Princess Trixie': 'Trixie in her self-proclaimed princess attire.',
  'Shining Armor': 'Captain of the Royal Guard and Twilight\'s older brother.',
  'Flurry Heart': 'The first natural-born alicorn, daughter of Cadance and Shining Armor.',
  'Queen Chrysalis': 'Shape-shifting queen of the Changelings who feeds on love.',
  'Queen Haven': 'Regal queen of Zephyr Heights and mother of Pipp and Zipp.',
  'Queen Novo': 'Queen of the Hippogriffs who transformed her kind into seaponies.',
  'Prince Blueblood': 'Vain nephew of Princess Celestia.',
  'Prince Rutherford': 'Proud leader of the Yaks from Yakyakistan.',
  'Cewestia': 'An adorable filly version of Princess Celestia.',
  'Woona': 'An adorable filly version of Princess Luna.',
  'Daybreaker': 'Nightmare version of Princess Celestia consumed by power.',
  'Nightmare Moon': 'Princess Luna consumed by bitterness and transformed by dark magic.',
  'Nightmare Star': 'A nightmare version born from dark celestial magic.',
  'King Sombra': 'Tyrannical unicorn king who once enslaved the Crystal Empire.',

  // Villains
  'Discord': 'Chaotic draconequus who was reformed through Fluttershy\'s kindness.',
  'Chrysalis': 'The dethroned Changeling Queen seeking revenge.',
  'Chaos Chrysalis': 'Chrysalis powered up by Discord\'s chaotic magic.',
  'Cozy Glow': 'Deceptively sweet filly with plans to steal all magic.',
  'Cozy Demon': 'Cozy Glow empowered by dark magic from Grogar\'s bell.',
  'Chaos Cozy Glow': 'Cozy Glow infused with chaotic power.',
  'Grown Cozy Glow': 'Cozy Glow as she might appear as an adult.',
  'Lord Tirek': 'Power-hungry centaur who absorbs the magic of others.',
  'Grogar': 'Ancient ram sorcerer and father of monsters.',
  'Tempest Shadow': 'A scarred unicorn commander who sought to restore her broken horn.',
  'The Storm King': 'Ruthless yeti conqueror who sought the magic of the alicorn princesses.',
  'Pony of Shadows': 'Ancient dark entity that tried to consume Equestria in shadow.',

  // G5
  'Sunny Starscout': 'Optimistic earth pony who dreams of reuniting all pony kinds.',
  'Izzy Moonbow': 'Creative and quirky unicorn from Bridlewood.',
  'Hitch Trailblazer': 'Maretime Bay\'s dedicated sheriff who has a way with critters.',
  'Pipp Petals': 'Pop star princess of Zephyr Heights who loves social media.',
  'Zipp Storm': 'Adventurous and athletic princess who loves uncovering the truth.',
  'Argyle Starshine': 'Sunny\'s father who taught her about friendship between pony kinds.',
  'Alphabittle Blossomforth': 'Unicorn elder of Bridlewood who runs a tea shop.',
  'Misty Brightdawn': 'Former servant of Opaline who became a true friend.',
  'Cloudpuff': 'Queen Haven\'s adorable royal pomeranian.',
  'Petunia Petals': 'A sweet resident of Zephyr Heights.',

  // Wonderbolts
  'Spitfire': 'Fierce captain of the elite flying team, the Wonderbolts.',
  'Soarin': 'Easy-going Wonderbolt who loves apple pie.',
  'Fleetfoot': 'Speed-focused Wonderbolt with a competitive streak.',
  'Fire Streak': 'Veteran Wonderbolt member known for fiery aerobatics.',
  'High Winds': 'Swift Wonderbolt flyer at high altitudes.',
  'Misty Fly': 'Graceful Wonderbolt performer.',
  'Lightning Dust': 'Reckless former Wonderbolt cadet, now reformed.',
  'Silver Zoom': 'Fast-flying member of the Wonderbolt reserves.',
  'Surprise': 'Energetic Wonderbolt who always keeps things fun.',
  'Wind Rider': 'Retired Wonderbolt with a legendary past.',
  'Blaze': 'Fiery Wonderbolt known for blazing fast flights.',

  // CMC
  'Apple Bloom': 'Applejack\'s little sister and founding member of the Cutie Mark Crusaders.',
  'Scootaloo': 'Adventurous pegasus filly and President of the Rainbow Dash Fan Club.',
  'Sweetie Belle': 'Rarity\'s little sister with a hidden singing talent.',

  // Pillars
  'Star Swirl the Bearded': 'Greatest wizard in Equestrian history and creator of many spells.',
  'Flash Magnus': 'Legendary pegasus warrior of incredible bravery.',
  'Rockhoof': 'Pillar of Strength from the Mighty Helm village.',
  'Mistmane': 'Pillar of Beauty who sacrificed her own beauty to save her home.',
  'Somnambula': 'Pillar of Hope, a brave pegasus from ancient times.',
  'Meadowbrook': 'Pillar of Healing, a legendary healer from Hayseed Swamp.',

  // Young Six
  'Gallus': 'Sarcastic griffon student at the School of Friendship.',
  'Ocellus': 'Shy but brilliant changeling student.',
  'Sandbar': 'Laid-back earth pony student at the School of Friendship.',
  'Silverstream': 'Enthusiastic hippogriff amazed by everything on land.',
  'Smolder': 'Tough but secretly sweet dragon student.',
  'Yona': 'Proud yak student who loves smashing things.',

  // Key Ponyville
  'Derpy Hooves': 'Beloved cross-eyed pegasus mail carrier of Ponyville.',
  'Dr. Hooves': 'Time-conscious earth pony often seen with Derpy.',
  'Lyra Heartstring': 'Cheerful unicorn fascinated by humans.',
  'Bon Bon': 'Sweetie Drops\' cover identity, Lyra\'s best friend.',
  'Bonbon': 'Secret agent pony also known as Sweetie Drops.',
  'Cheerilee': 'Kind and patient schoolteacher of Ponyville.',
  'Cheerliee': 'Cheerilee looking extra cheerful today.',
  'Mayor Mare': 'The dedicated mayor of Ponyville.',
  'Roseluck': 'Flower pony who tends beautiful roses in Ponyville.',
  'Daisy': 'One of the three flower ponies of Ponyville.',
  'Lily Valley': 'Dramatic flower pony who tends lilies.',
  'Carrot Top': 'Earth pony known for her carrot farm in Ponyville.',
  'Berry Punch': 'Fun-loving earth pony of Ponyville.',
  'Minuette': 'Cheerful unicorn dentist also known as Colgate.',
  'Vinyl Scratch': 'Ponyville\'s top DJ, known for her signature shades.',
  'Octavia Melody': 'Sophisticated cellist who performs in Canterlot.',
  'Nurse Redheart': 'Caring nurse at the Ponyville Hospital.',
  'Big McIntosh': 'Applejack\'s strong and quiet older brother.',
  'Granny Smith': 'Beloved elderly matriarch of the Apple family.',
  'Zecora': 'Wise zebra herbalist who lives in the Everfree Forest.',
  'Cheese Sandwich': 'Super duper party pony and Pinkie\'s special somepony.',
  'Maud Pie': 'Pinkie\'s monotone sister with a deep love for rocks.',
  'Diamond Tiara': 'Reformed bully who learned the value of true friendship.',
  'Silver Spoon': 'Diamond Tiara\'s loyal best friend.',
  'Filthy Rich': 'Wealthy business pony and Diamond Tiara\'s father.',
  'Spoiled Rich': 'Diamond Tiara\'s demanding and status-conscious mother.',
  'Bulk Biceps': 'Incredibly muscular pegasus known for yelling "YEAH!"',
  'Cranky Doodle Donkey': 'Grumpy donkey who found love with Matilda.',
  'Matilda': 'Sweet donkey and Cranky\'s beloved partner.',
  'Iron Will': 'Assertive minotaur motivational speaker.',
  'Snails': 'Slow but good-natured unicorn colt.',
  'Snips': 'Energetic and impressionable unicorn colt.',
  'Featherweight': 'Foal journalist for the Ponyville school paper.',
  'Pipsqueak': 'Adventurous young Trottingham-born colt.',
  'Twist': 'Sweet filly who makes candy canes.',
  'Photo Finish': 'Eccentric fashion photographer with a thick accent.',

  // Other key characters
  'Sunset Shimmer': 'Reformed student of Celestia who found redemption in the human world.',
  'Sunset Satan': 'Sunset Shimmer corrupted by the Element of Magic\'s dark power.',
  'Trixie Lulamoon': 'Showmare magician, the Great and Powerful Trixie!',
  'Starlight Glimmer': 'Reformed villain turned guidance counselor at the School of Friendship.',
  'Starlight Glimmer Power': 'Starlight Glimmer channeling her immense magical power.',
  'Sunburst': 'Starlight\'s childhood friend and Crystal Empire\'s crystaller.',
  'Daring Do': 'Adventurous author and real-life treasure hunter.',
  'Coloratura': 'Pop star known as Rara, Applejack\'s childhood friend.',
  'Coco Pommel': 'Talented seamstress from Manehattan with a kind heart.',
  'Double Diamond': 'Former follower of Starlight\'s Our Town, now reformed.',
  'Night Glider': 'Athletic pegasus from Our Town.',
  'Party Favor': 'Balloon-talented unicorn from Our Town.',
  'Sugar Belle': 'Sweet baker from Our Town, Big Mac\'s wife.',
  'Fleur De Lis': 'Elegant model and socialite from Canterlot.',
  'Fancy Pants': 'Canterlot\'s most important and sophisticated pony.',
  'Sassy Saddles': 'Rarity\'s business-savvy manager in Canterlot.',
  'Moon Dancer': 'Studious unicorn who was hurt when Twilight didn\'t attend her party.',
  'Luster Dawn': 'Twilight\'s promising student in the future.',
  'Flurry Heart': 'The first natural-born alicorn, daughter of Cadance and Shining Armor.',
  'Adagio Dazzle': 'Leader of the Dazzlings, a siren who feeds on negativity.',
  'Aria Blaze': 'Grumpy member of the Dazzlings.',
  'Sonata Dusk': 'The ditzy and cheerful member of the Dazzlings.',
  'Midnight Sparkle': 'Sci-Twi consumed by dark Equestrian magic.',
  'Gloriosa Daisy': 'Camp Everfree director who was corrupted by Equestrian magic.',
  'Juniper Montage': 'Movie-obsessed girl who got trapped in a magic mirror.',
  'Vignette Valencia': 'Social media obsessed event planner.',
  'Wallflower Blush': 'Shy gardener who used the Memory Stone to be noticed.',
  'Timber Spruce': 'Gloriosa\'s brother and camp counselor at Camp Everfree.',
  'Gilda': 'Reformed griffon who became a better friend.',
  'Gabby': 'Enthusiastic griffon mail carrier who dreamed of having a cutie mark.',
  'Thorax': 'Reformed Changeling who became the new king.',
  'Pharynx': 'Thorax\'s tough brother who eventually accepted the reformed hive.',
  'Ember': 'Fierce young dragon lord of the Dragon Lands.',
  'Garble': 'Tough teenage dragon and bully, eventually reformed.',
  'Capper': 'Charming cat from Klugetown who helped the Mane Six.',
  'Captain Celaeno': 'Brave bird pirate captain and ally of the Mane Six.',
  'Songbird Serenade': 'Famous pop star who performed at the Friendship Festival.',
  'Lightning Dust': 'Reckless former Wonderbolt cadet with incredible speed.',
  'Autumn Blaze': 'Talkative and theatrical kirin from the Stream of Silence.',
  'Rain Shine': 'Leader of the Kirin who imposed a vow of silence.',
  'Nirik': 'Angry fire form of the Kirin.',
  'Braeburn': 'Applejack\'s enthusiastic cousin from Appleloosa.',
  'Babs Seed': 'Apple Bloom\'s Manehattan cousin and former bully.',
  'Pear Butter': 'Applejack\'s mother, also known as Buttercup.',
  'Bright Mac': 'Applejack\'s father, a devoted member of the Apple family.',
  'Grand Pear': 'Applejack\'s maternal grandfather who ran a pear farm.',
  'Limestone Pie': 'Maud\'s grumpy older sister who guards the rock farm.',
  'Marble Pie': 'Shy younger Pie sister with a crush on Big Mac.',
  'Cloudy Quartz': 'Stern matriarch of the Pie family.',
  'Igneous Rock Pie': 'Traditional patriarch of the Pie family.',

  // Pets & Creatures
  'Angel': 'Fluttershy\'s demanding but lovable pet bunny.',
  'Gummy': 'Pinkie Pie\'s toothless but philosophical pet alligator.',
  'Opalescence': 'Rarity\'s pampered and sassy pet cat.',
  'Owlowiscious': 'Twilight\'s wise pet owl and nighttime assistant.',
  'Tank': 'Rainbow Dash\'s pet tortoise who wears a magic helicopter.',
  'Winona': 'Applejack\'s loyal herding dog.',
  'Philomena': 'Princess Celestia\'s phoenix companion.',
  'Harry': 'A large bear who is one of Fluttershy\'s animal friends.',
  'Cerberus': 'Three-headed guard dog of Tartarus.',
  'Cockatrice': 'Creature that can turn ponies to stone with its gaze.',
  'Tatzlwurm': 'Giant worm creature from beneath Equestria.',
  'Hydra': 'Multi-headed swamp monster from Froggy Bottom Bogg.',
  'Bugbear': 'Half-bear, half-bug creature that escaped from Tartarus.',
  'Timberwolves': 'Wolves made of sticks and logs from the Everfree Forest.',
  'Parasprites': 'Adorable but destructive magical insects.',
  'Windigo': 'Spirit creatures that feed on hatred and create blizzards.',
  'Chimera': 'Three-headed creature from the Everfree Forest.',
  'Tantabus': 'Dream creature created by Luna to punish herself.',
  'Steven Magnet': 'Fabulous and drama-prone sea serpent.',
  'Smooze': 'Sentient blob creature, Discord\'s plus-one.',
  'Grubber': 'The Storm King\'s bumbling hedgehog henchman.',
  'Skellinore': 'Mysterious creature from a Ponyville legend.',
  'Umbrum': 'Shadow pony creatures from beneath the Crystal Empire.',
  'Seabreeze': 'Tiny but determined leader of the Breezies.',

  // Flim & Flam
  'Flim': 'One half of the Flim Flam Brothers, a smooth-talking con artist.',
  'Flam': 'The mustachioed half of the Flim Flam Brothers.',

  // Power Ponies
  'Fili-Second': 'Rainbow Dash\'s super-speed Power Pony alter ego.',
  'Fili Second Rainbowfied': 'Fili-Second powered up with Rainbow Power.',
  'Mane-iac': 'Hair-powered supervillain of the Power Ponies comic.',
  'Masked Matter-Horn': 'Twilight\'s magical Power Pony alter ego.',
  'Masked Matter-Horn 2': 'The Masked Matter-Horn in her updated costume.',
  'Masked Matter-Horn Rainbowfied': 'Masked Matter-Horn with Rainbow Power.',
  'Radiance': 'Rarity\'s gem-powered Power Pony alter ego.',
  'Radiance Rainbowfied': 'Radiance powered up with Rainbow Power.',
  'Saddle Rager': 'Fluttershy\'s Power Pony alter ego with incredible strength.',
  'Mistress Marevelous': 'Applejack\'s lasso-wielding Power Pony alter ego.',
  'Mistress Marevelous Rainbowfied': 'Mistress Marevelous with Rainbow Power.',
  'Humdrum': 'Spike\'s sidekick Power Pony alter ego.',
  'Zapp': 'Rainbow Dash\'s lightning Power Pony alter ego.',
  'Zapp Rainbowfied': 'Zapp powered up with Rainbow Power.',

  // Elements of Harmony
  'Element Of Magic': 'The Element of Magic, Twilight Sparkle\'s crown jewel.',
  'Element Of Loyalty': 'The Element of Loyalty, representing Rainbow Dash.',
  'Element Of Laughter': 'The Element of Laughter, representing Pinkie Pie.',
  'Element Of Kindness': 'The Element of Kindness, representing Fluttershy.',
  'Element Of Honesty': 'The Element of Honesty, representing Applejack.',
  'Element Of Generosity': 'The Element of Generosity, representing Rarity.',

  // Harmonized
  'Harmonized Twilight Sparkle': 'Twilight Sparkle radiating pure harmonic power.',
  'Harmonized Applejack': 'Applejack empowered by the magic of harmony.',
  'Harmonized Fluttershy': 'Fluttershy glowing with harmonious energy.',
  'Harmonized Pinkie Pie': 'Pinkie Pie bursting with harmonic joy.',
  'Harmonized Rainbow Dash': 'Rainbow Dash blazing with rainbow harmonic power.',
  'Harmonized Rarity': 'Rarity shimmering with harmonic elegance.',

  // Mean Six
  'Mean Applejack': 'A sinister clone of Applejack created by Chrysalis.',
  'Mean Fluttershy': 'A cruel clone of Fluttershy created by Chrysalis.',
  'Mean Pinkie Pie': 'A grumpy clone of Pinkie Pie created by Chrysalis.',
  'Mean Rainbow Dash': 'A selfish clone of Rainbow Dash created by Chrysalis.',
  'Mean Rarity': 'A greedy clone of Rarity created by Chrysalis.',
  'Mean Twilight Sparkle': 'A dark clone of Twilight created by Chrysalis.',

  // Sea Ponies
  'Sea Apple Bloom': 'Apple Bloom in her seapony form.',
  'Sea Applejack': 'Applejack in her seapony form.',
  'Sea Fluttershy': 'Fluttershy in her seapony form.',
  'Sea Pinkie Pie': 'Pinkie Pie in her seapony form.',
  'Sea Rainbow Dash': 'Rainbow Dash in her seapony form.',
  'Sea Rarity': 'Rarity in her seapony form.',
  'Sea Scootaloo': 'Scootaloo in her seapony form.',
  'Sea Silverstream': 'Silverstream in her seapony form.',
  'Sea Starlight Glimmer': 'Starlight Glimmer in her seapony form.',
  'Sea Sunset Shimmer': 'Sunset Shimmer in her seapony form.',
  'Sea Sweetie Belle': 'Sweetie Belle in her seapony form.',
  'Sea Swirl': 'Cheerful unicorn who loves swimming in Ponyville.',
  'Sea Terramar': 'Terramar in his seapony form.',
  'Sea Twilight Sparkle': 'Twilight Sparkle in her seapony form.',
  'Sea Windy Whistles': 'Windy Whistles in her seapony form.',

  // Families & misc
  'Bow Hothoof': 'Rainbow Dash\'s enthusiastic and supportive father.',
  'Windy Whistles': 'Rainbow Dash\'s loving and overly supportive mother.',
  'Twilight Velvet': 'Twilight and Shining Armor\'s mother, a romance novelist.',
  'Night Light': 'Twilight and Shining Armor\'s supportive father.',
  'Mr Shy': 'Fluttershy\'s quiet and gentle father.',
  'Mrs Shy': 'Fluttershy\'s soft-spoken and nervous mother.',
  'Cookie Crumbles': 'Rarity and Sweetie Belle\'s artistic mother.',
  'Hondo Flanks': 'Rarity and Sweetie Belle\'s sports-loving father.',
  'Bright Macintosh': 'Big Mac in his younger days.',
  'Apple Rose': 'Elderly Apple family member with many stories to tell.',
  'Apple Strudel': 'Eccentric Apple family member.',
  'Aunt Orange': 'Applejack\'s city-dwelling aunt from Manehattan.',
  'Auntie Applesauce': 'Elderly Apple family member who loves gossip.',
  'Stellar Flare': 'Sunburst\'s overachieving and overbearing mother.',
  'Firelight': 'Starlight Glimmer\'s well-meaning but clingy father.',
  'Snap Shutter': 'Scootaloo\'s adventurer father.',
  'Mane Allgood': 'Scootaloo\'s adventurer mother.',
  'Clear Sky': 'Kind pegasus mother in Ponyville.',
  'Dinky Doo': 'Derpy\'s adorable unicorn daughter.',
  'Crescent Doo': 'Family member of the Doo/Hooves household.',
  'Mr. Cake': 'Co-owner of Sugarcube Corner, father of the Cake twins.',
  'Mr Carrot Cake': 'The hardworking baker of Sugarcube Corner.',
  'Mrs Cup Cake': 'Sweet co-owner of Sugarcube Corner.',
  'Pound Cake': 'Energetic pegasus baby, son of the Cakes.',
  'Pumpkin Cake': 'Magical unicorn baby, daughter of the Cakes.',
  'Nurse Sweetheart': 'Dedicated nurse at the Ponyville Hospital.',
  'Nurse Snowheart': 'Winter-themed nurse at Ponyville Hospital.',
  'Nurse Tenderheart': 'Gentle nurse who cares for all patients.',
  'Dr. Fauna': 'Ponyville\'s dedicated veterinarian.',
  'Dr. Horse': 'Doctor at Ponyville Hospital.',
  'Doctor Stable': 'Senior doctor at the Ponyville Hospital.',
  'Dr. Caballeron': 'Daring Do\'s rival treasure hunter.',
  'Ahuizotl': 'Jungle creature and Daring Do\'s arch-nemesis.',
  'Hoity Toity': 'Canterlot\'s pickiest fashion critic.',
  'Sapphire Shores': 'The Pony of Pop, a fabulous singer.',
  'Cherry Jubilee': 'Owner of the cherry orchard in Dodge Junction.',
  'Chief Thunderhooves': 'Proud chief of the buffalo tribe near Appleloosa.',
  'Little Strongheart': 'Young buffalo from Appleloosa.',
  'Sheriff Silverstar': 'Law-keeping sheriff of Appleloosa.',
  'Trouble Shoes': 'Clumsy but lovable rodeo enthusiast.',
  'Thunderlane': 'Laid-back pegasus from Ponyville.',
  'Rumble': 'Thunderlane\'s younger brother.',
  'Zephyr Breeze': 'Fluttershy\'s lazy but talented younger brother.',
  'Jack Pot': 'Trixie\'s father, a famous Las Pegasus magician.',
  'Mudbriar': 'Maud Pie\'s boyfriend who is very literal about sticks.',
  'Mudbrair': 'Maud\'s partner who insists on precision about sticks.',
  'Tender Taps': 'Talented young tap dancer from Ponyville.',
  'Button Mash': 'Gaming-obsessed colt from Ponyville.',
  'Fluffle Puff': 'Incredibly fluffy and adorable pink pony.',
  'Screwball': 'Chaotic pony associated with Discord.',
  'Snowfall Frost': 'Scrooge-like unicorn from a Hearth\'s Warming tale.',
  'Chancellor Neighsay': 'Strict EEA chancellor, eventually reformed.',
  'Trenderhoof': 'Travel writer with a passion for trends.',
  'Tree Hugger': 'Laid-back nature-loving earth pony.',
  'Suri Polomare': 'Competitive and underhanded fashion designer.',
  'Zipporwhill': 'Enthusiastic young filly who loves her dog.',
  'Lighthoof': 'Talented cheerleader from Ponyville.',
  'Shimmy Shake': 'Lighthoof\'s cheerleading partner.',
  'Kerfuffle': 'Kind pegasus prosthetic leg designer from Rainbow Falls.',
  'Snow Drop': 'Blind pegasus filly who created snowflakes.',
  'Silver Shill': 'Former con artist who reformed after meeting the Mane Six.',
  'Fleur Dis Lee': 'Elegant socialite of Canterlot society.',
  'Gilded Lily': 'Glamorous Canterlot resident.',
  'Raven Inkwell': 'Princess Celestia\'s loyal secretary.',
  'Saffron Masala': 'Talented curry chef who runs a restaurant in Canterlot.',
  'Coloratura': 'Pop star Rara, Applejack\'s childhood friend.',
  'Terramar': 'Young hippogriff torn between land and sea.',
  'Ocean Flow': 'Silverstream and Terramar\'s seapony mother.',
  'Sky Beak': 'Silverstream and Terramar\'s hippogriff father.',
  'Seabreeze': 'Tiny but feisty leader of the Breezies.',
  'Vapor Trail': 'Shy pegasus who secretly helped her friend Sky Stinger.',
  'Sky Stinger': 'Confident pegasus flyer paired with Vapor Trail.',
  'Songbird Serenade': 'Famous pop star who performed at the Friendship Festival.',
  'Torque Wrench': 'Mechanically minded pony from Ponyville.',
  'Shoeshine': 'Hardworking earth pony of Ponyville.',
  'Amethyst Star': 'Organized unicorn of Ponyville.',
  'Lemon Hearts': 'Friendly unicorn from Canterlot.',
  'Twinkleshine': 'Cheerful unicorn from Canterlot.',
  'Sunshower Raindrops': 'Weather pony who manages rain in Ponyville.',
  'Cloud Kicker': 'Fun-loving weather pegasus from Cloudsdale.',
  'Cloudchaser': 'Athletic pegasus from Cloudsdale.',
  'Cerulean Skies': 'Sky-blue pegasus from Cloudsdale.',
  'Nocturn': 'Mysterious night guard of Canterlot.',
  'Night Watch': 'Dutiful night guard of Canterlot.',
  'Guard': 'Royal Guard of Canterlot, always vigilant.',
  'Fido': 'One of the Diamond Dogs who kidnapped Rarity.',
  'Rover': 'Leader of the Diamond Dogs.',
  'Spot': 'Smallest of the Diamond Dogs trio.',
  'Gusty the Great': 'Legendary unicorn who defeated Grogar long ago.',

  'Spirit of Hearths Warming Past': 'Spirit who shows visions of the past.',
  'Spirit of Hearths Warming Presents': 'Spirit who shows the joy of the present.',
  'Spirit of Hearths Warming Yet to Come': 'Spirit who shows what the future may hold.',

  'Pear Butter': 'Applejack\'s mother, also known as Buttercup.',
  'Flash Sentry': 'Kind pegasus royal guard and Twilight\'s admirer.',
  'Flashy Magnus': 'Legendary pegasus warrior of incredible bravery.',

};

const egDescriptions = {
  'Adagio Dazzle': 'Leader of the Dazzlings, a siren who manipulates through song.',
  'Applejack': 'Honest and dependable, this country girl always has her friends\' backs.',
  'Aria Blaze': 'The surly and competitive member of the Dazzlings.',
  'Big McIntosh': 'Applejack\'s quiet but strong older brother.',
  'Bulk Biceps': 'Incredibly strong student who never skips arm day. YEAH!',
  'Cherry Crash': 'Cool rocker student at Canterlot High.',
  'Cozy Glow': 'Deceptively sweet student with hidden motives.',
  'Daring Do': 'Adventurous author whose stories come to life.',
  'Daydream Shimmer': 'Sunset Shimmer infused with the magic of friendship.',
  'Derpy Hooves': 'Lovable and klutzy student at Canterlot High.',
  'Diamond Tiara': 'Reformed socialite at Canterlot High.',
  'Dozen Breed': 'Casual student at Canterlot High.',
  'Ember': 'Fierce exchange student from the Dragon Lands.',
  'Flash Centry': 'Cool guitarist and kind-hearted student at Canterlot High.',
  'Fluttershy': 'Gentle animal-loving student at Canterlot High.',
  'Flutter Blaze': 'Fluttershy in her powered-up radiant form.',
  'Gaia Everfree': 'Gloriosa Daisy consumed by Equestrian magic at Camp Everfree.',
  'Gloriosa Daisy': 'Enthusiastic director of Camp Everfree.',
  'Hitch Trailblazer': 'Dependable and responsible sheriff type.',
  'Indigo Zap': 'Competitive student from Crystal Prep Academy.',
  'Inky Rose': 'Gothic fashion designer with a dark aesthetic.',
  'Izzy Moonbow': 'Creative and quirky friend who loves crafts.',
  'Juniper Montage': 'Movie-obsessed girl who found true friendship.',
  'Kiwi Lollipop': 'Sweet musician from the K-Lo & Sup duo.',
  'Lemon Zest': 'Energetic music-loving student from Crystal Prep.',
  'Lyra Heartstrings': 'Cheerful student fascinated by magic and mystery.',
  'Maud Pie': 'Pinkie\'s stoic sister with a hidden dry wit.',
  'Megan Williams': 'Legendary human friend of the original ponies.',
  'Micro Chips': 'Tech-savvy student at Canterlot High.',
  'Midnight Sparkle': 'Sci-Twi consumed by dark Equestrian magic.',
  'Moondancer': 'Studious student with a love for knowledge.',
  'Mystery Mint': 'Cool punk-rock student at Canterlot High.',
  'Octavia Melody': 'Sophisticated cellist at Canterlot High.',
  'Photo Finish': 'Eccentric fashion photographer with dramatic flair.',
  'Pinkie Pie': 'The life of every party at Canterlot High.',
  'Pipp Petals': 'Social media star and pop princess.',
  'Princess Cadance': 'Beloved dean of Crystal Prep Academy.',
  'Princess Skystar': 'Cheerful and bubbly princess from the sea.',
  'Principal Celestia': 'Wise and caring principal of Canterlot High.',
  'Principal Luna': 'Strict but fair vice principal of Canterlot High.',
  'Rainbow Dash': 'Athletic and loyal captain of every sports team.',
  'Rarity': 'Fashion-forward trendsetter at Canterlot High.',
  'Roseluck': 'Sweet student with a love for flowers.',
  'Sandalwood': 'Laid-back environmentalist student.',
  'Silver Spoon': 'Diamond Tiara\'s fashionable best friend.',
  'Snails': 'Easygoing and somewhat slow student.',
  'Snips': 'Eager but gullible student.',
  'Snowdrop': 'Gentle student inspired the beauty of snowflakes.',
  'Sonata Dusk': 'The ditzy and cheerful member of the Dazzlings.',
  'Sour Sweet': 'Two-faced Crystal Prep student, sweet then sour.',
  'Spike The Dog': 'Twilight\'s loyal and adorable pet dog.',
  'Starlight Fitzgerald': 'Talented musician at Canterlot High.',
  'Starlight Glimmer': 'Former rival turned trusted counselor.',
  'Sugar Belle': 'Sweet baker with a heart of gold.',
  'Sunny Starscout': 'Optimistic dreamer who believes in friendship.',
  'Sunset Shimmer': 'Reformed student who became a true leader.',
  'Supernova Zap': 'Energetic rockstar with electrifying performances.',
  'Sweetie Drops': 'Secret agent student, also known as Bon Bon.',
  'Timber Spruce': 'Nature-loving camp counselor at Camp Everfree.',
  'Toola Roola': 'Artistic student who expresses herself through painting.',
  'Trixie Lulamoon': 'The Great and Powerful stage magician of Canterlot High.',
  'Twilight Sparkle': 'Brilliant student and natural-born leader.',
  'Vignette Valencia': 'Social media obsessed event planner at Canterlot High.',
  'Vinyl Scratch': 'The school\'s top DJ who lets the bass drop.',
  'Wallflower Blush': 'Shy gardener who just wants to be noticed.',
  'Watermelody': 'Musical student at Canterlot High.',
  'Zipp Storm': 'Athletic and truth-seeking adventurer.',
};

// EG location tags
const egLocationMap = {
  'Adagio Dazzle': 'Canterlot High', 'Applejack': 'Canterlot High', 'Aria Blaze': 'Canterlot High',
  'Big McIntosh': 'Canterlot High', 'Bulk Biceps': 'Canterlot High', 'Cherry Crash': 'Canterlot High',
  'Cozy Glow': 'Canterlot High', 'Daring Do': 'Canterlot High', 'Daydream Shimmer': 'Canterlot High',
  'Derpy Hooves': 'Canterlot High', 'Diamond Tiara': 'Canterlot High', 'Dozen Breed': 'Canterlot High',
  'Ember': 'Canterlot High', 'Flash Centry': 'Canterlot High', 'Fluttershy': 'Canterlot High',
  'Flutter Blaze': 'Canterlot High', 'Gaia Everfree': 'Camp Everfree', 'Gloriosa Daisy': 'Camp Everfree',
  'Hitch Trailblazer': 'Maretime Bay', 'Indigo Zap': 'Crystal Prep',
  'Inky Rose': 'Canterlot High', 'Izzy Moonbow': 'Bridlewood', 'Juniper Montage': 'Canterlot Mall',
  'Kiwi Lollipop': 'Canterlot High', 'Lemon Zest': 'Crystal Prep',
  'Lyra Heartstrings': 'Canterlot High', 'Maud Pie': 'Canterlot High',
  'Megan Williams': 'Dream Valley', 'Micro Chips': 'Canterlot High',
  'Midnight Sparkle': 'Crystal Prep', 'Moondancer': 'Canterlot High',
  'Mystery Mint': 'Canterlot High', 'Octavia Melody': 'Canterlot High',
  'Photo Finish': 'Canterlot High', 'Pinkie Pie': 'Canterlot High',
  'Pipp Petals': 'Zephyr Heights', 'Princess Cadance': 'Crystal Prep',
  'Princess Skystar': 'Seaquestria', 'Principal Celestia': 'Canterlot High',
  'Principal Luna': 'Canterlot High', 'Rainbow Dash': 'Canterlot High',
  'Rarity': 'Canterlot High', 'Roseluck': 'Canterlot High', 'Sandalwood': 'Canterlot High',
  'Silver Spoon': 'Canterlot High', 'Snails': 'Canterlot High', 'Snips': 'Canterlot High',
  'Snowdrop': 'Canterlot High', 'Sonata Dusk': 'Canterlot High',
  'Sour Sweet': 'Crystal Prep', 'Spike The Dog': 'Canterlot High',
  'Starlight Fitzgerald': 'Canterlot High', 'Starlight Glimmer': 'Canterlot High',
  'Sugar Belle': 'Canterlot High', 'Sunny Starscout': 'Maretime Bay',
  'Sunset Shimmer': 'Canterlot High', 'Supernova Zap': 'Canterlot High',
  'Sweetie Drops': 'Canterlot High', 'Timber Spruce': 'Camp Everfree',
  'Toola Roola': 'Canterlot High', 'Trixie Lulamoon': 'Canterlot High',
  'Twilight Sparkle': 'Canterlot High', 'Vignette Valencia': 'Canterlot High',
  'Vinyl Scratch': 'Canterlot High', 'Wallflower Blush': 'Canterlot High',
  'Watermelody': 'Canterlot High', 'Zipp Storm': 'Zephyr Heights',
};

// EG family map
const egFamilyMap = {
  'Adagio Dazzle': 'The Dazzlings', 'Aria Blaze': 'The Dazzlings', 'Sonata Dusk': 'The Dazzlings',
  'Applejack': 'Rainbooms', 'Fluttershy': 'Rainbooms', 'Pinkie Pie': 'Rainbooms',
  'Rainbow Dash': 'Rainbooms', 'Rarity': 'Rainbooms', 'Twilight Sparkle': 'Rainbooms',
  'Sunset Shimmer': 'Rainbooms',
  'Indigo Zap': 'Shadowbolts', 'Lemon Zest': 'Shadowbolts', 'Sour Sweet': 'Shadowbolts',
  'Sugarcoat': 'Shadowbolts', 'Sunny Flare': 'Shadowbolts',
  'Sunny Starscout': 'Mane Five (G5)', 'Hitch Trailblazer': 'Mane Five (G5)',
  'Izzy Moonbow': 'Mane Five (G5)', 'Pipp Petals': 'Mane Five (G5)', 'Zipp Storm': 'Mane Five (G5)',
  'Spike The Dog': 'Rainbooms', 'Flash Centry': 'Canterlot High',
  'Principal Celestia': 'Canterlot High Staff', 'Principal Luna': 'Canterlot High Staff',
  'Princess Cadance': 'Crystal Prep Staff',
  'Gloriosa Daisy': 'Camp Everfree', 'Timber Spruce': 'Camp Everfree',
};

// ─── Now generate the output ───

let output = `const rarities = {
  COMMON: 'Common',
  RARE: 'Rare',
  EPIC: 'Epic',
  MAJESTIC: 'Majestic',
  LEGEND: 'Legend',
  GODDESS: 'Goddess',
  SECRET: 'Secret',
  RADIANCE: 'Radiance'
};

let currentId = 1000;

// ═══════════════════════════════════════════
// Equestria Girls
// ═══════════════════════════════════════════
const equestriaGirls = [\n`;

for (const eg of egData) {
  const desc = egDescriptions[eg.name] || `A character from the Equestria Girls universe.`;
  const family = egFamilyMap[eg.name] || egLocationMap[eg.name] || 'Canterlot High';
  const location = egLocationMap[eg.name] || 'Canterlot High';
  output += `  { id: currentId++, name: '${eg.name.replace(/'/g, "\\'")}', png: '${eg.png}', rarity: rarities.${eg.rarity.toUpperCase()}, category: 'Equestria Girls', description: '${desc.replace(/'/g, "\\'")}', family: '${family.replace(/'/g, "\\'")}', adventureTag: '${location.replace(/'/g, "\\'")}' },\n`;
}

output += `];\n\n// ═══════════════════════════════════════════\n// Ponies\n// ═══════════════════════════════════════════\nconst ponies = [\n`;

// Skip duplicates of EG entries already present
const egPngs = new Set(egData.map(e => e.png.toLowerCase()));

for (const file of ponyFiles) {
  const name = cleanName(file);

  // Determine rarity
  let rarity = 'COMMON';
  if (rarityOverrides[name]) {
    rarity = rarityOverrides[name].toUpperCase();
  }

  // Determine location
  const location = locationMap[name] || 'Ponyville';
  const family = familyMap[name] || 'Ponyville';
  const desc = descriptions[name] || `A resident of ${location} in Equestria.`;

  output += `  { id: currentId++, name: '${name.replace(/'/g, "\\'")}', png: '${file.replace(/'/g, "\\'")}', rarity: rarities.${rarity}, category: 'Pony', description: '${desc.replace(/'/g, "\\'")}', family: '${family.replace(/'/g, "\\'")}', adventureTag: '${location.replace(/'/g, "\\'")}' },\n`;
}

output += `];\n\nconst allCharacters = [...equestriaGirls, ...ponies];\nmodule.exports = allCharacters;\nmodule.exports.equestriaGirls = equestriaGirls;\nmodule.exports.ponies = ponies;\n`;

fs.writeFileSync(path.join(__dirname, '..', 'model', 'MyLittlePonies.js'), output, 'utf8');
console.log('Generated MyLittlePonies.js with', egData.length, 'EG +', ponyFiles.length, 'ponies =', egData.length + ponyFiles.length, 'total');
