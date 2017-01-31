"use strict";

var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var fs = require('fs');

var app = express();

var token = "Facebook App Access Token"
var googleStaticMapKey = "AIzaSyCvWqLKoJRVbeWmlZuPyrdgZGpTCafJJIk";
var googlePlacesApiKey = "AIzaSyD1dug9wej2_wRPr-iLw-ZmdSNTUKVdrkA";
var googleMapsApiKey = 'AIzaSyB3QSg7VACbvvY7C69SpbejDOGEEQGyOtw';
var locations;
var jsonData = '';

app.set('port', (process.env.PORT || 5000));

// Allows to process the data 
app.use(bodyParser.urlencoded({extended: false}));
// Process application/json
app.use(bodyParser.json());

app.listen((process.env.PORT || 3000));




// Server frontpage
app.get('/', function (req, res) {  
    res.send('This is TestBot Server');
});

// For Facebook verification (I have deployed this on Heroku server)
app.get('/webhook', function (req, res) {
    if (req.query['hub.verify_token'] === 'testbot_verify_token') {
        res.send(req.query['hub.challenge']);
    }
    res.send('Error, wrong token');
})


var userLat ;
var userLong;
var userName;

//Types of Places 
var placesArray = ['cafe', 'gym', 'parking', 'restaurant', 'bus_station', 'atm', 'park', 'gas_station', 'shopping_mall', 'police', 'night_clubs', 'hospital', 'bar', 'lodging', 'library'];
var placesName = ['Cafes', 'Gyms', 'Parking', 'Restaurants', 'Bus Station', 'ATMs', 'Parks', 'Gas Stations', 'Shopping Malls', 'Police Stations', 'Night Clubs', 'Hospitals', 'Bars', 'Lodges', 'Library'];                   

//Reading the json file
jsonData += fs.readFileSync('./json/places.json');
var content = JSON.parse(jsonData); // buttons of places 


// POST to receive/send the messages from/to messenger
app.post('/webhook', function (req, res) {
    var messaging_events,
        event,
        sender,
        text,
        attachment;

        if(req.body && req.body.entry){
            messaging_events = req.body.entry[0].messaging;

            for (var i = 0; i < messaging_events.length; i++) {
                event = messaging_events[i];
                
                //To see the event in the logs
                console.log('>>>>>>>><<<<<<<<');
                console.log(JSON.stringify(event));
                
                sender = event.sender.id;

                if(event.message && event.message.attachments && event.message.attachments.length > 0){
                    attachment = event.message.attachments[0];
                    if(attachment.type === 'location'){
                        userLat = attachment.payload.coordinates.lat;
                        userLong = attachment.payload.coordinates.long;
                        processPlaces(sender, text);
                    }
                }
                else if (event.postback && event.postback.payload){
                    //..........Do something with the postback here
                    var typeOfPlace = event.postback.payload;
                    if(placesArray.indexOf(typeOfPlace) > -1){ //postback is a type of a place
                        processTextMessage(sender,  typeOfPlace);
                    }
                }
                else{
                    if(event.message && event.message.text) {
                        text = event.message.text; // sender's message 
                        processTextMessage(sender, text.substring(0, 200));
                    }        
                }
            }
        }	
    res.sendStatus(200)
})


function processTextMessage(sender, text){
    text = text.toLowerCase(); 
    var len = text.length;
    if((placesArray.indexOf(text) > -1) && userLat != undefined){ 
        processLocation(sender, text);
    }

    else if(text.indexOf('help') > -1){ //give option to select place
        sendTextMessage(sender, 'It\'s pretty easy to use me: \n\n STEP 1) Type "Start" to begin. \n\n STEP 2) Send your Location \n\n STEP 3) Tell me where would you like to go (i.e. cafe, gym, shopping, club etc etc.) \n\n STEP 4) I\'ll provide you with all the available nearby options with their details. \n\n That is it! You Go out there and have a wonderful day!');
        setTimeout(function(){
            sendTextMessage(sender, 'say "help" for this help reminder');    
        }, 900)
    }
    
    else if(text == 'hi' || text == 'hey' || text.indexOf('hi ') > -1 || text.indexOf('hey ') > -1){
        var user = 'https://graph.facebook.com/v2.6/'+sender+'?fields=first_name&access_token='+process.env.PAGE_ACCESS_TOKEN;

        request(user, function(error, response, body){
            if(response.statusCode === 200){
                var data = JSON.parse(body);
                userName = data.first_name;
                sendTextMessage(sender, 'Hi '+userName);
            }
        })
    }

    else if(text.indexOf('start') > -1){
         var messageData = {
            "text":"Please share your location to begin: ",
            "quick_replies":[
             {
                "content_type":"location",
             }
            ]
        }
        sendRequest(sender, messageData);
    }
    

}


//FOR LOCATION
function processLocation(sender, place){
    var index = placesArray.indexOf(place);
    var placeName = placesName[index];
    console.log("name of place ------------"+placeName);
    var  messageData = {
        "attachment":{
            "type": "template",
            "payload":{
                "template_type":"generic",
                "elements": [
                 {
                    "title": placeName+" near you: ",
                    "image_url": "https://maps.googleapis.com/maps/api/staticmap?size=764x400&markers="+userLat+","+userLong+"&zoom=16&key="+googleStaticMapKey,
                    "item_url": "https://www.google.com/maps/search/"+placeName+"/@"+userLat+","+userLong+",16z",
                    "subtitle": "Tap to view on map"
                 }
                ] 
            }
        }
    }
    sendTextMessage(sender, 'Finding '+placeName+ ' near you...');
    setTimeout(function(){  
    	options(sender, place);
	},400);

    setTimeout(function(){  
        sendRequest(sender, messageData);
    }, 2500);
}

var mainMessageData;

//For Sending Places options to the user in a template
function options(sender, place){
    var placesUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json?location='+userLat+','+userLong+'&radius=5000&type='+place+'&key='+googlePlacesApiKey;
 
    mainMessageData = '{"attachment":{ "type":"template", "payload":{ "template_type":"generic","elements": [' ;
    request(placesUrl, function(error, response, body){
        if(error) { console.log("errrot in reqquest ---"+err);throw error;}
        console.log("places -----" +body);
        var data = JSON.parse(body);
        locations = data.results;
        var length;
        var resultsLen = locations.length;
               
        if(resultsLen > 10){
            //maximum 10 items to display
            length = 10; 
        }
        else if(resultsLen <= 10){
            length = resultsLen;
        }
            
        makeTemplate(length, sender, locations, 0);
                   
    });
}

function makeTemplate(len, sender, results, k){

    if(k < len){
        var name = results[k].name,
            address = results[k].vicinity,
            reference = results[k].reference,
            photoReference,
            locName = name.replace(' ', '+'),
            destLat,
            destLong,
            noImageUrl = 'https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcTMEkUULON4O5WwmVius4C6DTJvH2NC2spQFhtWVL5jx8rFdvPH3p655pc',
            placeDetailUrl = 'https://maps.googleapis.com/maps/api/place/details/json?reference='+reference+'&key='+googlePlacesApiKey;
        
        if(results[k].geometry && results[k].geometry.location){ 
            //storing Latitude and Longitude of the User
            destLat = results[k].geometry.location.lat; 
            destLong = results[k].geometry.location.lng; 
        }   
        
        var distanceUrl = 'https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins='+userLat+','+userLong+'&destinations='+destLat+','+destLong+'&key='+googleMapsApiKey;
        var directionUrl = 'https://www.google.ca/maps/place/'+locName+'/@'+destLat+','+destLong+',17z';
        
        request(placeDetailUrl, function(error, response, body){
                 
               if(error){
               	console.log("error 000 in mapp000-----"+error);
               	throw error;

               }  
            if(!error && response.statusCode == 200){
                //console.log(directionUrl);
                var data = JSON.parse(body),
                    openHours,
                    openNow,
                    element;

                if(data.result && data.result.opening_hours && data.result.opening_hours.open_now){
                    openHours = data.result.opening_hours.open_now;
                }

                if(openHours){
                    openNow = 'Yes!';
                }

                else if(!(openHours)){
                    openNow = 'No.';
                }

                var rating = getRating(data);        
                var phoneNumber = 'Not Found';
                
                if(data.result && data.result.formatted_phone_number){
                    phoneNumber = data.result.formatted_phone_number;
                }

                if(results[k].photos && results[k].photos[0] && results[k].photos[0].photo_reference){
                    photoReference = results[k].photos[0].photo_reference;
                    var photoUrl = 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference='+photoReference+'&key='+googlePlacesApiKey;
                    element = {
                            "title": name,
                            "image_url": photoUrl,
                            "subtitle": "Open Now: "+openNow+"\nOverall Rating: "+rating+"\nAddress: "+address,
                            "buttons":[
                                {
                                "type": "web_url",
                                "url": directionUrl,
                                "title": "Go Here!"
                                }
                            ]
                        }
                }

                else{
                    element = {
                        "title": name,
                        "image_url": noImageUrl,
                        "subtitle": "Open Now: "+openNow+"\nOverall Rating: "+rating+"\nAddress: "+address,
                        "buttons":[
                            {
                            "type": "web_url",
                            "url": directionUrl,
                            "title": "Go Here!"
                            }
                        ]
                    }
                }
                //console.log(rating);
                //console.log('rating^^^***');
           
                if(k != len - 1){
                    //console.log(JSON.stringify(element));
                    //console.log(k);
                    //console.log(len);
                    mainMessageData += JSON.stringify(element)+',';
                    k += 1;
                    makeTemplate(len, sender, results, k);
                }

                else if(k == len-1){
                    mainMessageData += JSON.stringify(element)+'] } } }';
                    console.log(mainMessageData);
                    sendRequest(sender, mainMessageData);
                }
            
            }
        })
    }
}

//For sending the Overall Ratings
function getRating(body){
    var result = body.result;
    
    if(result && result.rating){
        return result.rating;
    }

    else if(result && result.reviews){
        var reviews = result.reviews;
        var length = reviews.length;
        console.log('length of reviews: '+length);
        var count = 0;
        for(var j = 0; j < length; j++){
            if(reviews[j].aspects && reviews[j].aspects[0] && reviews[j].aspects[0].rating){
                count += reviews[j].aspects[0].rating;
            }
        }
        var overall = count/length;
        return overall;   
    }
    else{
        return 'No user ratings.';
    }
}

// Sending the options of places types
function processPlaces(sender, text ){ //gives user options to select from
    
    sendTextMessage(sender, 'Where would you like to go today? ');
    var messageData = content; //content from places.json file
    
    setTimeout(function(){
        sendRequest(sender, messageData); 
    }, 1000);
}


// To send the TEXT MESSAGE
function sendTextMessage(sender, text) {
    var messageData = {
        text:text
    }
    setTimeout(function(){
        sendRequest(sender, messageData)
    }, 400);
}



//request format every function will use to send a message to a user in a proper format 
function sendRequest(sender, messageData) {
    
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData,
        }           
    }, function(error, response, body) {
            if (error) {
                console.log('Error sending messages: ', error)
            } else if (response.body.error) {
                console.log('Error: ', response.body.error)
            }
    })
}