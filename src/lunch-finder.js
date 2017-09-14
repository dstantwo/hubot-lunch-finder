// Description:
//   Culture the reader on some AkitaBox Mission, Vision, and Core Values
//
// Configuration:
//   none
//
// Notes:
//   none
//
// Commands:
//   culture me - responds with the AkitaBox Mission, Vision, and Core Values
//
// Authors:
//   dstanley

let request = require('request');
let geolib = require('geolib');

/* configurable constants */
const LATITUDE = '43.072864';
const LONGITUDE = '-89.388124';
const MIN_APPARENT_TEMPERATURE = 20;
const MAX_PRECIP_CHANCE = 0.7; // from 0.0 to 1.0
const MAX_PRECIP_INTENSITY = 0.2; // from 0.0 to 1.0
const WALKING_DISTANCE_METERS = 1610; // note 1 mi ~ 1610 m

/* constants */
const COORDINATES = `${LATITUDE},${LONGITUDE}`;
const API_KEY_DARKSKY = '15e4907bd8d12eace411121ef6dd1b93';
const API_KEY_ZOMATO = 'c564dc12ac3c6d86c13c5ddea679181f';
const API_KEY_EATSTREET = 'a6a1e6f478bf47f4';
const ERROR_MESSAGE = `\nThe internet is broken. Lunch is canceled`;

module.exports = function (robot) {
    robot.hear(/(.*where.*lunch)|(.*lunch.*where)|(.*what.*lunch)|(.*lunch.*what)/i, function (msg) {
        checkWeather()
            .then((weatherIsGood) => {
                if (weatherIsGood) {
                    // suggest go out
                    getRandomRestaurant()
                        .then( (restaurant) => msg.send(messageForZomatoRestaurant(restaurant)))
                        .catch( (error) => msg.send(ERROR_MESSAGE));
                } else {
                    // suggest get deliver
                    getRandomDelivery()
                        .then((restaurant) => msg.send(messageForEatStreetRestaurant(restaurant)))
                        .catch( (error) => msg.send(ERROR_MESSAGE));
                }
            });
    });
};


/**
 * Gets weather from darksky api
 *
 * @async
 * @return {Promise} with boolean parameter describing if weather is good
 */
function checkWeather() {
    return new Promise(function (fulfill, reject) {
        request(`https://api.darksky.net/forecast/${API_KEY_DARKSKY}/${COORDINATES}`, function (error, response, body) {
            let weatherJson = JSON.parse(body);
            fulfill((isWeatherGood(weatherJson) || error || response.statusCode !== 200));
        });
    });
}

/**
 * Gets random restaurant from EatStreet API that delivers to COORDINATES
 *
 * @async
 * @return {Promise} with object parameter of restaurant from EatStreet
 */
function getRandomDelivery() {
    return new Promise(function (fulfill, reject) {
        let options = {
            url     : `https://api.eatstreet.com/publicapi/v1/restaurant/search?latitude=${LATITUDE}&longitude=${LONGITUDE}&method=delivery`,
            headers : {
                'X-Access-Token' : API_KEY_EATSTREET,
            },
        };
        request(options, function (error, response, body) {
            if (error || response.statusCode !== 200) {
                reject(error);
            } else {
                let responseBody = JSON.parse(body);
                let randomIndex = Math.floor(Math.random() * (responseBody.restaurants.length - 1));
                let restaurant = responseBody.restaurants[randomIndex];
                fulfill(restaurant);
            }
        });
    });
}

/**
 * Gets random restaurant from Zomato API that is within WALKING_DISTANCE_METERS of COORDINATES
 *
 * @async
 * @return {Promise} with object parameter of restaurant from Zomato
 */
function getRandomRestaurant() {
    return new Promise(function (fulfill, reject) {
        fetchAllRestaurantsRecursive(null, null, (restaurantList) => {
            let filteredRestaurantList = filterRestaurantsForDistance(restaurantList);
            let randomIndex = Math.floor(Math.random() * (filteredRestaurantList.length - 1));
            let restaurant = filteredRestaurantList[randomIndex];
            fulfill(restaurant);
        });
    });
}

/**
 * The Zomato search API seems to only loosly respect the distance parameter.
 * This function filters a list of restaurants for distance to ensure they are close.
 *
 * @param {Array} restaurants list of restaurants from Zomato api
 * @return {Array} of zomato restauant objects that has been filtered for distance
 */
function filterRestaurantsForDistance(restaurants) {
    let results = [];
    for (let i = 0; i< restaurants.length; i += 1) {
        if (geolib.isPointInCircle(
            { latitude  : restaurants[i].restaurant.location.latitude,
                longitude : restaurants[i].restaurant.location.longitude },
            { latitude : LATITUDE, longitude : LONGITUDE },
            WALKING_DISTANCE_METERS)) {
            results.push(restaurants[i]);
        }
    }
    return results;
}

/**
 * Recursive function that gets all restaurants from Zomato's paginated api
 *
 * @async
 * @param {Number} offset the start index to use for paginated api (should be null on first call)
 * @param {Array} list list of restaurants already fetched (should be null on first call)
 * @param {Function} callback retrieves Array of restaurants when recursion is done
 */
function fetchAllRestaurantsRecursive(offset, list, callback) {
    let options = {
        url     : `https://developers.zomato.com/api/v2.1/search?start=${offset}&lat=${LATITUDE}&lon=${LONGITUDE}&radius=${WALKING_DISTANCE_METERS}&open=now&cft=1`,
        headers : {
            'user-key' : API_KEY_ZOMATO,
        },
    };
    console.log('REQUEST: ', offset);
    request(options, function (error, response, body) {
        if (error || response.statusCode !== 200) {
            msg.send('The internet is broken');
        } else {
            // suggest eat street
            let responseBody = JSON.parse(body);
            let newOffset = responseBody.results_start + responseBody.results_shown;
            let newList = list ? list.concat(responseBody.restaurants) : responseBody.restaurants;
            // checking if newOffset is 0 accounts for strange Zomato api behavior that caused infinite loop
            if (responseBody.results_start + responseBody.results_shown < responseBody.results_found && newOffset !== 0) {
                fetchAllRestaurantsRecursive(newOffset, newList, callback);
            } else {
                callback(newList);
            }
        }
    });
}

/**
 * Determines whether current weather is "good"
 *
 * @param {Object} weatherJson JSON response from darksky api
 * @return {Boolean} describing if current weather is "good" based on configurable constants
 */
function isWeatherGood(weatherJson) {
    return !(weatherJson.currently.apparentTemperature < MIN_APPARENT_TEMPERATURE // if too cold
          || (weatherJson.currently.precipProbability > MAX_PRECIP_CHANCE
              && weatherJson.currently.precipIntensity > MAX_PRECIP_INTENSITY)); // if raining/snowing
}

/**
 * Constructs suggestion message from restaurant object
 *
 * @param {Object} restaurant restaurant object from Zillow's api response
 * @return {String} message to be displayed to user suggesting restaurant
 */
function messageForZomatoRestaurant(restaurant) {
    return `\n` +
          `The weather looks fine, you should go out:\n` +
          `\n` +
          `${restaurant.restaurant.name}\n` +
          `Cuisines: ${restaurant.restaurant.cuisines}\n` +
          `${restaurant.restaurant.location.address}\n` +
          `${restaurant.restaurant.url}\n`;
}

/**
 * Constructs suggestion message from restaurant object
 *
 * @param {Object} restaurant restaurant object from EatStreet's api response
 * @return {String} message to be displayed to user suggesting restaurant
 */
function messageForEatStreetRestaurant(restaurant) {
    return `\n` +
          `Weather doesn't look great. Don't be a hero. Get delivery:\n` +
          `\n` +
          `${restaurant.name}\n` +
          `Cuisines: ${restaurant.foodTypes.join(', ')}\n` +
          `${restaurant.streetAddress}\n` +
          `${restaurant.url}\n`;
}
