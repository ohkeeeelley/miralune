class AssetManager {
    static EMOJI = {
        BAKERY: {
            muffin: '<:muffin:1429826723335372914>',
            chocolate_pie: '<:chocolate_pie:1429826760119160926>',
            strawberry_cupcake: '<:strawberry_cupcake:1429826429545091102>',
            nachos: '<:nacho:1430314021793431562>',
            zap_cinnamon_cake: '<:zap_apple_cinnamon_cake:1430314093604114554>',
            cinnamon_bars: '<:cinnamon_bars:1430319379425394799>',
            caramel_apple: '<:caramel_apple:1430319519280402623>',
            diamond_cupcake: '<:diamond_cupcake:1431376546062638080>',
            chocolate_rainbow_lolipop: '<:chocolate_rainbow_lollipops:1430320158324293703>',
            rainbow_juice: '<:rainbow_juice:1430320565264318636>',
            pancake_stack: '<:pancake:1430323825110941737>',
            rainbow_caramel_apple: '<:rainbow_apple_caramel:1430323884145770677>',
            chocolate_rainbow_icecream: '<:chocolate_rainbow_icecream:1430323965297037492>',
            sandwich: '<:sandwich:1430324388015902772>',
            chocolate_bar: '<:chocolate_bar:1430324570585436231>',
            fruit_snack_fusion: '<:fruit_salad_fusion:1430325091983429632>',
            rainbow_pie: '<:rainbow_pie:1430328135953678457>',
            mini_pie: '<:mini_pie:1430329077818065020>',
            sweet_apple_cinnamon_cake: '<:sweet_apple_cinnamon_cake:1430329237717385297>',
            chocolate_rainbow_lolipop_dup: '<:chocolate_rainbow_lollipops:1430320158324293703>'
        }
    };

    static getBakeryEmoji(keyOrName) {
        if (!keyOrName) return '🧁';
        if (AssetManager.EMOJI.BAKERY[keyOrName]) return AssetManager.EMOJI.BAKERY[keyOrName];
        const key = String(keyOrName).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        return AssetManager.EMOJI.BAKERY[key] || '🧁';
    }
}

module.exports = AssetManager;
