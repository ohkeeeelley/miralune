$names = @(
  'Aloha','Amethyst Maresbury','Amethyst Star','Angel','Apple Bumpkin','Apple Cider',
  'Apple Dumpling','Apple Honey','Arpeggio','Aunt Orange','Beauty Brass','Birch Bucket',
  'Blue Bobbin','Blueberry Curls','Braeburn','Bulk Biceps','Butternut','Candy Mane',
  'Caramel','Caramel Apple','Chancellor Neighsay','Cheerilee','Cherry Berry','Citrus Blush',
  'Cloud Kicker','Cloudchaser','Coco Crusoe','Cotton Cloudy','Daisy','Doctor Stable',
  'Dr. Hooves','Dr. Horse','Flitter','Florina Tart','Gabby','Golden Delicious',
  'Grand Pear','Gummy','Harry','Hayseed Turnip Truck','Hoofer Steps','Ivy Vine',
  'Junebug','Lavender Fritter','Lemon Zest','Lighthoof','Lightning Dust','Lily Blossom',
  'Lily Valley','Little Po','Lyrica Lilac','Mango Dash','Mr. Cake','Mr. Shy',
  'Mrs. Cake','Mrs. Shy','Noi','Noteworthy','Nurse Redheart','Nurse Snowheart',
  'Nurse Sweetheart','Nurse Tenderheart','Opalescence','Owlowiscious','Parish Nandermane',
  'Perfect Pace','Photo Finish','Pina Colada','Pipsqueak','Pound Cake','Pumpkin Cake',
  'Rainbow Stars','Rainy Feather','Raspberry Sorbet','Red Delicious','Red Gala','Roma',
  'Royal Ribbon','Sapphire Shores','Sea Swirl','Shimmy Shake','Shoeshine','Sky Stinger',
  'Snails','Snips','Sour Sweet','Star Tracker','Starstreak','Sugar Belle','Sugarcoat',
  'Sunny Flare','Suri Polomare','Sweet Pop','Tank','Thunderlane','Tootsie Flute',
  'Trapeze Star','Trouble Shoes','Uncle Orange','Vapor Trail','Winona','Zephyr Breeze'
)

$file = "c:\Users\y4lul\Desktop\MyLittleBot\miralune\model\MyLittlePonies.js"
$content = Get-Content $file

foreach ($line in $content) {
  foreach ($name in $names) {
    $escaped = [regex]::Escape("name: '$name'")
    if ($line -match $escaped) {
      if ($line -match "rarity: rarities\.(\w+)") {
        $r = $Matches[1]
        if ($r -ne 'COMMON') {
          Write-Output "$name => $r"
        }
      }
    }
  }
}
Write-Output "Done"
