var mongoose = require('mongoose');
var messageSchema = new mongoose.Schema({
   textFrom: String, 
   textTo: String, 
   message: String, 
   time: Number, 
   read: String, 
   image: {
      sent: Boolean,
      url: String
   }, 
   friend: String,
   location: String,
   coords: {
      lat: Number,
      lng: Number
   }
});
module.exports = mongoose.model('draft', messageSchema);