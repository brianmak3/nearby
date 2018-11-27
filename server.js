'use strict';

// for our server we use both express and socket.io
// express is used for serving our static content
// socket.io is used for all messages, in and out
// config
// set this here or as an environment variable
var JWT_SECRET = process.env.JWT_SECRET || 'change-me-please!';

// this this to your s3 bucket name
//var S3_BUCKET = process.env.S3_BUCKET || 'ionic-video-chat-v2-images';

// these are digested by aws and should be set in your environment vars, or here
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'your-key-here';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'your-access-key-here';
// meat
const
  express = require('express'),
  app = express(),
  http = require('http').Server(app),
  io = require('socket.io')(http),
  mongo = require('mongodb').MongoClient,
  jwt = require('jwt-simple'),
  helmet = require('helmet'),
  cors = require('cors'),
   fs = require('fs'),
  ObjectId = require('mongodb').ObjectId,
  multer = require('multer'),
  path = require('path'),
  aws = require('aws-sdk'),
  mongoose = require('mongoose'),
 storage =   multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, './public/uploads');
    },
    filename: function (req, file, callback) {
        var extArray = file.mimetype.split("/");
        var extension = extArray[1];
        callback(null, file.fieldname + '_'+Date.now()+'.'+extension);
    }

});
 var upload = multer({ storage : storage, limits: { fieldSize: 10 * 1024 * 1024 }}).single('neaybye');

var  Users = require('./models/users'),
   DraftMessages = require('./models/messages'),
   draftMessages = [];
   //deliveredMessages = [],
   //readMessages = [{from:'+254704251068', to:'+254719662122'}];
// connect to the database
 mongoose.connect('mongodb://nearby:nearby@127.0.0.1/nearBy');
// mongoose.connect('mongodb://127.0.0.1/nearBy');

// basic setup
app.use(helmet());
app.use(cors());
app.use(express.static('www'));
app.use(require('stylus').middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
// home
app.get('/', (req, res) => {
  res.send('Unknown origin.');
});
app.post('/imgupload',(req, res)=>{
   upload(req, res, function (err) {
            if (err)
                console.log(err);
            if(req.file){

              var url = req.body.url+'//uploads/';
                var pic = url + req.file.filename;
                var userId = req.body.id;
             if(req.body.messageId == "null"){
                res.status(201).json(pic);
                Users.findOne({'_id': userId}, {pic:1, _id:0}, function (err, user) {
                    if (err)
                        throw err;
                    else {
                     var rem = 'public/'+user.pic.split('//')[2];
                        if (user.pic !== 'avatar.jpg') {
                               fs.unlink(rem, function (e) {
                            });
                        }
                    }
                });
                Users.updateOne({'_id': userId}, {$set: {'pic': pic}}, function (err) {
                    if (err)
                        throw err;
                });
              }
              else{
                var message = JSON.parse(req.body.messageId);
                message.image.url = pic;
                message.image.sent = true;
                res.status(201).json(JSON.stringify(message));
              }
          }

        })
})


// setup socket.io
io.on('connection', function(socket){
  socket.on('appData', function(data){
       if(data.stage !=='userLoggedOut'){
        Users.updateOne({_id: data.socketId},{$set: {state: 'online', socketId: socket.id}}, 
        function(err, res){
          if(err)
            throw err;
        });
      }
    
      switch(data.stage){
        case 'updateFriendsInfo':
         Users.find({_id: {$in: data.users}},{_id:1, pic:1, status: 1, state:1, location:1}, function(err, res){
          if(err)
            throw err;
          else{
             socketEmit(socket,{stage: 'updatedProfile',users: res}, null);
          }
         })
        break;
        case 'updating_profile':
          Users.updateOne({_id: data.phonCode}, {$set: data}, function(err, res){
            if(err)
              throw err;
            else 
              socketEmit(socket,{stage: 'updatedProfile',users: [{_id: data.phonCode, pic: data.img, status: data.status}]}, true);
          });
        break;
        case 'checkFriends':
        Users.find({_id: {$in: data.friends}},{_v:0 }, function(err, users){
          if(err)
            throw err;
          else{
            socketEmit(socket, {stage: 'foundUsers', friends: users}, null);
          }
        });
        break;
        case 'signup':
          //update profile
          var phone =  data.phonCode.replace(/\s/g,'');
          Users.findOne({_id: phone}, function(err, user){
                  if(err)
                    throw err;
                  else if(!user){
                      var newUser = new Users;
                      newUser._id =phone
                      newUser.status = data.status;
                      newUser.pic = data.img;
                      newUser.userSettings = data.userSettings;
                      newUser.save(function(err){
                        if(err)
                          throw err;
                      })
                  }else{
                    socketEmit(socket, {stage: 'updatedMyProfile', user: user}, null);
                  }
          })
          
        break;
        case 'sentDrafts':
         (data.drafts.length > 0)
             socketEmit(socket, {stage: 'updateRead', users: 'allUsergetUpdate', changeFrom: 'time', to: 'checkmark'}, null);
             DraftMessages.find({friend: data.user}, {_id:0,__v:0}, function(err, res){
               if(err)
                 throw err;
                 else if(res.length > 0)
                   socketEmit(socket, {stage: 'sentMessages', messages: res}, null);
                 DraftMessages.deleteMany({friend: data.user}, function(err){
                   if(err)
                     throw err;
                 })
              });
          /* var userDeliveredMessages = deliveredMessages.filter(function( obj ) {
                  return obj.from === data.user;
              }).map(a=>a.to);
            var readMess = readMessages.filter(function( obj ) {
                  return obj.from === data.user;
              }).map(a=>a.to);
             socketEmit(socket, {stage: 'messagesInserver', read: readMess, delivered: userDeliveredMessages}, null);
             //remove the read and delivered from server*/
         break;
         case 'updateUserLocation':
           console.log(data);
             Users.updateOne({_id: data.socketId}, {$set: {location: data.location}}, function(err, res){
                if(err)
                  throw err
            })
          break;
         case 'updateProf':
         if(data.index == 0);
                data.location = {};
                var usr = {
                  userSettings: data.userSettings,
                  location: data.location
                }
            Users.updateOne({_id: data.socketId}, {$set: usr}, function(err, res){
                if(err)
                  throw err
                else 
                  socketEmit(socket, data, null);
            })
         break;
         case 'messageSent':
           socket.broadcast.emit('serverData', data);
            Users.findOne({_id: data.message.friend, state: 'online'}, {_id:1},function(err, res){
              if(err)
                throw err
              var checkmark;
              if(res)
                checkmark = 'done-all';
              else{
                  checkmark = 'checkmark';
                  var newDraf = new DraftMessages();
                  var messagex = data.message
                    newDraf.textFrom = messagex.textFrom; 
                    newDraf.textTo = messagex.textTo; 
                    newDraf.message = messagex.message; 
                    newDraf.time = messagex.time, 
                    newDraf.read = 'null'; 
                    newDraf.image = messagex.image; 
                    newDraf.location = messagex.location; 
                    newDraf.coords = messagex.coords; 
                    newDraf.friend = messagex.friend;       
                    newDraf.save(function(err){
                      if(err)
                         throw err;
                    })
                 }
               socketEmit(socket, {stage: 'updateRead', users: data.message.friend, userFrom:data.message.textFrom, changeFrom: 'time', to: checkmark}, null);

            })
         break;
         case 'updateRead1':
               socket.broadcast.emit('serverData', data);
         break;
         case 'userLoggedOut':
            removeuser(data.user);
         break;
      }
  });
   socket.on('disconnect', function(){
            removeuser(socket.id);
    })
    
});
function removeuser(id){
   Users.updateOne({$or:[{socketId: id},{_id: id}]},{$set: {state: Date.now(), socketId: '', location: {lat: '', lng: ''}} }, 
           function(err, res){
            if(err)
              throw err;
            console.log(res);
          })
}
const port = process.env.PORT || 3001;
http.listen(port, () => {
  console.log('listening on port', port);
});

function socketEmit(socket, data, thirdParty){
   if(thirdParty){
    socket.emit('serverData', data);
    socket.broadcast.emit('serverData', data);
   }else{
    socket.emit('serverData', data);
   }
}