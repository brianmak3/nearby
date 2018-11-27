var mongoose = require('mongoose');
var userSchema = new mongoose.Schema({
  _id: String,
  status: String,
  pic: String,
  username: String,
  name: String,
  state: String,
  socketId: String,
  userSettings: [{
  	text: String,
  	value: String
  }],
  days: [],
  location:{
    lat: Number,
    lng: Number
  }
});
module.exports = mongoose.model('users', userSchema);