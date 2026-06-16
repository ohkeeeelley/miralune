const locations = {
	"1": {
		id: 1,
		name: "Ponyville",
		price: 0,
		shop: false,
		emoji: "🏘️",
		description: "A charming little town, the perfect place to start your adventure!"
	},
	"2": {
		id: 2,
		name: "Canterlot",
		price: 2500000,
		shop: true,
		emoji: "🏰",
		description: "The capital of Equestria, where the royal castle stands tall!"
	},
	"3": {
		id: 3,
		name: "Crystal Empire",
		price: 5000000,
		shop: true,
		emoji: "💎",
		description: "A magical empire sparkling with crystal, home to Princess Cadance!"
	}
};

function getLocationName(locationId) {
	const location = locations[locationId];
	return location ? location.name : null;
}

module.exports = locations;
module.exports.getLocationName = getLocationName;
