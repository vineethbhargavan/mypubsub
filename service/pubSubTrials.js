var winston = require('winston');
var logLevels = {
      silly: 0,
      debug: 1,
      verbose: 2,
      info: 3,
      warn: 4,
      error: 5
};


var loglevel =  "info";

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({ 'timestamp': true, levels: logLevels, level: loglevel })
  ]
});

var os = require('os');
var config = require('../conf/myConf.json');
//var redis = require('redis');
var redis = require("redis")
  , sub = redis.createClient()
  , rclient = redis.createClient()
  , pub  = redis.createClient();


var http = require('http');
var express = require('express');
var sockio = require('socket.io');
var httpapp = express();  // this is for http

rclient.on('connect', function() {
    console.log(' redis client connected');
});

httpapp.set('views','/opt/node/service/views');
httpapp.set('view engine', 'ejs');

var httpserver = http.createServer(httpapp);
var httpport = config.httpport;
httpapp.use(express.static(__dirname+'/public'));
var io = sockio.listen(httpserver);

httpserver.on('error',function(err){
        logger.error('httpserver error :', err.message , ' exiting..');
        process.exit(1);
});


try{
httpserver.listen(httpport, getListenInterface());
}catch(err){
	logger.info('exception occured:', e.message);
	logger.error('Exception occured when listen on port:', httpport,  e.message);
	exit(1);
}
function getListenInterface(){
	if (typeof config.listeninterface == "undefined"){
		logger.info('no listen interface specified..');
		var hostname = os.hostname();
		var first = hostname.split('.');
		return first[0]+'m';	 // using 'm' for testing--> change it to 'i' when big-ip pool is defined.
	}
	logger.info('specified listen interface:', config.listeninterface);
	return config.listeninterface;
}

io.sockets.on('connection',function(socket){
    socket.on('handshake', function (data) {
	name = data;
	logger.info('socket'+socket.id);
        logger.info('handshake'+ name);
	var setClientInfo = {'name':name,'socketid':socket.id};
	sub.subscribe(name);
	//pub.publish(name,JSON.stringify(setClientInfo));
	rclient.set(name,JSON.stringify(setClientInfo),function(err,data){
		logger.info('Socket Info set'+data);
	});
    });

});


httpapp.get('/*',function(req,res,next){
        logger.info("httpapp.get: request received: ", req.originalUrl);
        res.header("Access-Control-Allow-Origin","*");
        res.header("Access-Control-Allow-Headers","X-Requested-With");
        next();
});

httpapp.get('/set',function(req,resp){
	userName = req.param('name');
	resp.render('pages/myEjs', {
                userName:userName
        });
	logger.info('Input for TestPage'+ userName);
	resp.end();
});
sub.on('message',function(channel,message){
                logger.info('Channel Name'+ channel);
                if ( channel == userName){
                        clientInfo = JSON.parse(message);
                        io.sockets.socket(clientInfo.socketid).emit('replyToHandshake','Thanks '+userName);
                }
        });

httpapp.get('/get',function(req,resp){
        userName = req.param('name');
        logger.info('Input for Get'+ userName);
        //resp.end();
        rclient.get(userName,function (err,data){
		logger.info('Data retrieved'+ data);
		pub.publish(userName,data);
	});
	resp.end();
});
