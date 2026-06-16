$filepath = "c:\Users\y4lul\Desktop\MyLittleBot\miralune\model\MyLittlePonies.js"
$content = [System.IO.File]::ReadAllText($filepath, [System.Text.Encoding]::UTF8)

# All mismatches found by audit - one entry per unique name
# [regex]::Replace updates ALL occurrences (both EG + Pony sections)
$changes = @(
    # ─── RARE ─────────────────────────────────────────────────
    "Aloe|RARE", "Apple Bloom|RARE", "Apple Fritter|RARE", "Appointed Rounds|RARE",
    "Berry Bliss|RARE", "Berry Icicle|RARE", "Big McIntosh|RARE", "Blaze|RARE",
    "Bon Bon|RARE", "Bottlecap|RARE", "Boysenberry|RARE", "Candy Apples|RARE",
    "Carrot Crunch|RARE", "Cattail|RARE", "Cerulean Skies|RARE", "Charity Kindheart|RARE",
    "Cheese Sandwich|RARE", "Cinnamon Swirl|RARE", "Coconut Cream|RARE", "Cotton|RARE",
    "Derpy Hooves|RARE", "Double Diamond|RARE", "Dumb-Bell|RARE", "Dusty Pages|RARE",
    "Filly Guides|RARE", "Fire Streak|RARE", "Fleetfoot|RARE", "Fuchsia Fizz|RARE",
    "Gala Appleby|RARE", "Ghostberry|RARE", "Granny Smith|RARE", "Grassy Granite|RARE",
    "Green Jewel|RARE", "High Winds|RARE", "Hoops|RARE", "Huckleberry|RARE",
    "Jonagold|RARE", "Juniper Montage|RARE", "Key Lime|RARE", "Lavender Cascade|RARE",
    "Lily Longsocks|RARE", "Lotus Blossom|RARE", "Love Sketch|RARE", "Melody|RARE",
    "Merry Melody|RARE", "Misty Fly|RARE", "Moon Dancer|RARE", "Ms. Harshwhinny|RARE",
    "Ms. Peachbottom|RARE", "Night Glider|RARE", "Oakey Doke|RARE", "Obscurity|RARE",
    "Octavia Melody|RARE", "Parasol|RARE", "Party Favor|RARE", "Peachy Pie|RARE",
    "Peachy Sweet|RARE", "Peggy Holstein|RARE", "Peppermint Goldylinks|RARE", "Perfect Pie|RARE",
    "Pokey Pierce|RARE", "Raven Inkwell|RARE", "Riverstone|RARE", "Roseluck|RARE",
    "Ruby Slippers|RARE", "Saffron Masala|RARE", "Scootaloo|RARE", "Seabreeze|RARE",
    "Silver Spanner|RARE", "Soyokaze|RARE", "Sugar Twist|RARE", "Summer Breeze|RARE",
    "Sunny Daze|RARE", "Sunny Delivery|RARE", "Surprise|RARE", "Sweetie Belle|RARE",
    "Tatzlwurm|RARE", "Toola Roola|RARE", "Tornado Bolt|RARE", "Trixie Lulamoon|RARE",
    "Twitch|RARE", "Vinyl Scratch|RARE", "Wallflower Blush|RARE", "Welch|RARE",
    "Welly|RARE", "Zipporwhill|RARE",

    # ─── EPIC ─────────────────────────────────────────────────
    "Adagio Dazzle|EPIC", "Alphabittle Blossomforth|EPIC", "Apple Strudel|EPIC",
    "Argyle Starshine|EPIC", "Aria Blaze|EPIC", "Autumn Afternoon|EPIC",
    "Barley Barrel|EPIC", "Bow Hothoof|EPIC", "Bugbear|EPIC",
    "Cerberus|EPIC", "Chimera|EPIC", "Cinnamon Chai|EPIC", "Cockatrice|EPIC",
    "Coloratura|EPIC", "Cookie Crumbles|EPIC", "Diamond Tiara|EPIC", "Dinky Doo|EPIC",
    "Dr. Caballeron|EPIC", "Dr. Fauna|EPIC", "Fall Flower|EPIC", "Fancy Pants|EPIC",
    "Fido|EPIC", "Firelight|EPIC", "Flam|EPIC", "Flash Sentry|EPIC",
    "Fleur Dis Lee|EPIC", "Flim|EPIC", "Frazzle Rock|EPIC", "Fume|EPIC",
    "Garble|EPIC", "Gilded Lily|EPIC", "Goldie Delicious|EPIC", "Guard|EPIC",
    "Hoity Toity|EPIC", "Hondo Flanks|EPIC", "Hydra|EPIC", "Iron Will|EPIC",
    "Jack Pot|EPIC", "Jet Set|EPIC", "Mane Allgood|EPIC", "Nirik|EPIC",
    "Ocean Flow|EPIC", "Pickle Barrel|EPIC", "Pom|EPIC", "Prince Blueblood|EPIC",
    "Rain Shine|EPIC", "Rover|EPIC", "Ruby Jubilee|EPIC",
    "Sea Apple Bloom|EPIC", "Sea Scootaloo|EPIC", "Sea Sweetie Belle|EPIC",
    "Sea Terramar|EPIC", "Sea Windy Whistles|EPIC", "Silver Spoon|EPIC",
    "Sky Beak|EPIC", "Snap Shutter|EPIC", "Songbird Serenade|EPIC",
    "Spectacle|EPIC", "Spitfire|EPIC", "Spot|EPIC", "Spring Glow|EPIC",
    "Steven Magnet|EPIC", "Strawberry Sunrise|EPIC", "Thorax|EPIC",
    "Timber Spruce|EPIC", "Timberwolves|EPIC", "Upper Crust|EPIC",
    "Wind Rider|EPIC", "Windy Whistles|EPIC", "Winter Flame|EPIC",

    # ─── MAJESTIC (Mythic) ────────────────────────────────────
    "Alice|MAJESTIC", "Aurora|MAJESTIC", "Babs Seed|MAJESTIC", "Bori|MAJESTIC",
    "Bramble|MAJESTIC", "Clear Sky|MAJESTIC", "Cloudpuff|MAJESTIC", "Copper Top|MAJESTIC",
    "Discord|MAJESTIC", "Flash Magnus|MAJESTIC", "Fluttershy|MAJESTIC", "Gallus|MAJESTIC",
    "Hitch Trailblazer|MAJESTIC", "Izzy Moonbow|MAJESTIC", "Limestone Pie|MAJESTIC",
    "Marble Pie|MAJESTIC", "Maud Pie|MAJESTIC", "Meadowbrook|MAJESTIC", "Mudbriar|MAJESTIC",
    "Ocellus|MAJESTIC", "Parasprites|MAJESTIC", "Pinkie Pie|MAJESTIC", "Pipp Petals|MAJESTIC",
    "Radiant Hope|MAJESTIC", "Rainbow Dash|MAJESTIC", "Rarity|MAJESTIC", "Rockhoof|MAJESTIC",
    "Sandbar|MAJESTIC", "Sea Silverstream|MAJESTIC", "Sea Starlight Glimmer|MAJESTIC",
    "Sea Sunset Shimmer|MAJESTIC", "Shadow Lock|MAJESTIC", "Silverstream|MAJESTIC",
    "Smolder|MAJESTIC", "Smooze|MAJESTIC", "Somnambula|MAJESTIC", "Spike|MAJESTIC",
    "Starlight Glimmer|MAJESTIC", "Stygian|MAJESTIC", "Sugar Coat Crystalized|MAJESTIC",
    "Sunny Flare Crystalized|MAJESTIC", "Sunny Starscout|MAJESTIC", "Terramar|MAJESTIC",
    "Twilight Sparkle|MAJESTIC", "Windigo|MAJESTIC", "Yona|MAJESTIC", "Zipp Storm|MAJESTIC",

    # ─── LEGEND ───────────────────────────────────────────────
    "Ahuizotl|LEGEND", "Chaos Chrysalis|LEGEND", "Chaos Cozy Glow|LEGEND",
    "Chrysalis|LEGEND", "Cozy Glow|LEGEND", "Daybreaker|LEGEND", "Ember|LEGEND",
    "Grogar|LEGEND", "Grubber|LEGEND", "Gusty the Great|LEGEND", "King Sombra|LEGEND",
    "Lord Tirek|LEGEND", "Mean Applejack|LEGEND", "Mean Fluttershy|LEGEND",
    "Mean Pinkie Pie|LEGEND", "Mean Rainbow Dash|LEGEND", "Mean Rarity|LEGEND",
    "Mean Twilight Sparkle|LEGEND", "Nightmare Moon|LEGEND", "Oleander|LEGEND",
    "Philomena|LEGEND", "Pinkamena Diane Pie|LEGEND", "Prince Rutherford|LEGEND",
    "Princess Amore|LEGEND", "Princess Cadance|LEGEND", "Princess Celestia|LEGEND",
    "Princess Luna|LEGEND", "Princess Skystar|LEGEND", "Queen Chrysalis|LEGEND",
    "Queen Novo|LEGEND", "Star Swirl the Bearded|LEGEND", "Tantabus|LEGEND",
    "The Storm King|LEGEND", "Violet Shiver|LEGEND",

    # ─── SECRET ───────────────────────────────────────────────
    "Angel Wings|SECRET", "Blossomforth|SECRET", "Cewestia|SECRET",
    "Element Of Generosity|SECRET", "Element Of Honesty|SECRET", "Element Of Kindness|SECRET",
    "Element Of Laughter|SECRET", "Element Of Loyalty|SECRET", "Element Of Magic|SECRET",
    "Harmonized Applejack|SECRET", "Harmonized Fluttershy|SECRET", "Harmonized Pinkie Pie|SECRET",
    "Harmonized Rainbow Dash|SECRET", "Harmonized Rarity|SECRET", "Harmonized Twilight Sparkle|SECRET",
    "Helia|SECRET", "Jade Singer|SECRET", "Luster Dawn|SECRET", "Older Rainbow Dash|SECRET",
    "Screwball|SECRET", "Sea Applejack|SECRET", "Sea Fluttershy|SECRET",
    "Sea Pinkie Pie|SECRET", "Sea Rainbow Dash|SECRET", "Sea Rarity|SECRET",
    "Sea Twilight Sparkle|SECRET", "Woona|SECRET",

    # ─── UNIQUE ───────────────────────────────────────────────
    "Applejack Bat|UNIQUE", "Christmas Fluttershy|UNIQUE", "Christmas Rarity|UNIQUE",
    "Echo|UNIQUE", "Night Watch|UNIQUE", "Nightmare Star|UNIQUE", "Petunia Petals|UNIQUE",
    "Pinkie Pie Bat|UNIQUE", "Princess Trixie|UNIQUE", "Princess Twilight Sparkle|UNIQUE",
    "Rainbow Dash Bat|UNIQUE", "Rarity Bat|UNIQUE", "Sadako|UNIQUE", "SciTwilight|UNIQUE",
    "Speck|UNIQUE", "Sunset Satan|UNIQUE", "Twilight Sparkle Bat|UNIQUE", "Umbrum|UNIQUE",

    # ─── EVENT ────────────────────────────────────────────────
    "Cozy Demon|EVENT", "Flutterholly|EVENT", "Fluttershy Bat|EVENT",
    "Merry|EVENT", "Minty|EVENT", "Nightmare Rarity|EVENT", "Nocturn|EVENT",
    "Skellinore|EVENT", "Snowdash|EVENT", "Snowfall Frost|EVENT", "Sweetie Angel|EVENT"
)

$changed = 0
$skipped = @()

foreach ($entry in $changes) {
    $parts   = $entry -split '\|'
    $name    = $parts[0]
    $rarity  = $parts[1]
    $escaped = [regex]::Escape($name)

    # Pattern: match the name (comma-terminated to avoid substring collisions),
    # then everything on that line up to "rarity: rarities.", capture the rarity key
    $pattern = "(?i)(name: '$escaped',[^\n]*rarity: rarities\.)(\w+)"

    $newContent = [regex]::Replace($content, $pattern, "`${1}$rarity")
    if ($newContent -ne $content) {
        $changed++
        $content = $newContent
        Write-Host "  Changed: $name -> $rarity"
    } else {
        $skipped += $name
    }
}

[System.IO.File]::WriteAllText($filepath, $content, [System.Text.Encoding]::UTF8)

Write-Host ""
Write-Host "Done. Changed $changed entries."
if ($skipped.Count -gt 0) {
    Write-Host "Skipped (not found or already correct): $($skipped.Count)"
    $skipped | ForEach-Object { Write-Host "  - $_" }
}
