#!/usr/bin/env node

var express = require('express');
var url = require('url');
var favicon = require('serve-favicon');
var querystring = require('querystring');
var config = require('./config/config.json');
var accesslog = require('access-log');
var server = express();
var seriesInfos = Array();
var searchingResults = Array();
var playlists = Array();
var jspf = require('jspf');
var extensions = {
	"audio": {
		".mp3": true,
		".mp4": true,
		".wav": true,
		".aif": true,
		".aifc": true,
		".aiff": true
	},
	"video": {
		".flv": true,
		".f4v": true,
		".f4p": true,
		".mp4": true,
		".asf": true,
		".asr": true,
		".asx": true,
		".avi": true,
		".mpa": true,
		".mpe": true,
		".mpeg": true,
		".mpg": true,
		".mpv2": true,
		".mov": true,
		".movie": true,
		".mp2": true,
		".qt": true,
		".webm": true,
		".ts": true,
		".mkv": true,
		".ogg": true
	}
};


var loadServer = function () {
	console.log(new Date() + " - Server: loading server configuration");
	if (!config["tmdb_key"] || config["tmdb_key"] == "") {
		console.log("This server require a TMDB Key to work. If you need one, go to https://www.themoviedb.org/");
		return;
	}
	var tmdb=require('sharelib-tmdbv3').init(config["tmdb_key"], (config["tmdb_lang"]?config["tmdb_lang"]:"en"));
	tmdb.on('error', function(msg) {
		console.log(new Date() + " - Server => Error initializing TMDB: " + msg);
		process.exit();
	});
	var tmdb_config;
	tmdb.configuration(function(err, config) {
		tmdb_config = config;
	});

	server.use(favicon(__dirname + "/img/favicon.ico"));

	server.get('*', function(req, res, next) {
		accesslog(req, res, accesslogToFile);
		if (config["security_activated"]) {
			if (security[config["security_function"]](req, res)) {
				next();
			} else {
				security[config["security_reject_function"]](req, res, config);
			}
		}
		else next();
	});

	server.get('/', function(req, res) {
		res.setHeader('Content-Type', 'text/html');
		res.render('home.ejs', {server_config: config});
		res.end();
	});

	server.get('/open_viacertif/', function (req, res) {
		console.log(new Date() + " - Server => open_viacertif");
		res.writeHead(200);
		res.end("Access granted");
	});

	server.get('/browse/*', function(req, res) {
		if (url.parse(req.url).pathname == '/browse') {
			res.writeHead(302, {'Location': "/browse/"});
			res.end();
			return true;
		}
		// req.url slice to the next char after /browse/
		var path = req.url.slice(8);
		var media_type = path.split("/")[0];
	        readPathAndRespond(config.server_root_dir[media_type] + path.slice(media_type.length+1), media_type, req, res);
	});

	server.get('/tmdb_search/', function(req, res) {
		var params = querystring.parse(url.parse(req.url).query);
		console.log (new Date() + " - Server => tmdb_search: params "+JSON.stringify(params));

		if (!params['video_type'] || !params['id']) {
			return sendNotFound(res);
		} else {
			var tmdb=require('tmdbv3').init('619a8b7a61bd2fd17932964255c2c400', params['language']);
			switch (params['video_type']) {
			case 'tv':
				if (params['season']) {
					if (params['episode']) {
						tmdb.tv.episodes_info(params['id'], params['season'], params['episode'], function(err, movie) {
							res.setHeader('Content-Type', 'application/json');
							res.write(JSON.stringify(movie));
							res.end();
						});
					} else {
						tmdb.tv.seasons_info(params['id'], params['season'], function(err, movie) {
							res.setHeader('Content-Type', 'application/json');
							res.write(JSON.stringify(movie));
							res.end();
						});
					}
				} else {
					tmdb.tv.info(params['id'], function(err, movie) {
						res.setHeader('Content-Type', 'application/json');
						res.write(JSON.stringify(movie));
					        res.end();
					 });
				}
				break;
			case 'movie':
				tmdb.movie.info(params['id'], function(err, movie) {
					res.setHeader('Content-Type', 'application/json');
					res.write(JSON.stringify(movie));
		        		res.end();
				});
				break;
			}
		}
	});

	server.get('/search_query/', function (req, res) {
		var params = querystring.parse(url.parse(req.url).query);
		var exec = require('child_process').exec;
		var child = exec("find " + config.server_root_dir['video'] + " -name \"" + params['query']+"*\"", function (error, stdout, stderr) {
			if (error == null) {
				res.writeHead(200, {'Content-type': 'application/json'});
				res.end('["' + stdout.replace(/\n/g, '","').substring(0,stdout.length-1).replace(new RegExp(config.server_root_dir['video'],"g"), "") + '"]');
			} else {
				console.log(new Date() + " - Server => Search: Error" + error);
			}
		});
	});

	server.get('/search/', function (req, res) {
		res.render('search.ejs',  {server_config: config});
	});

	server.get('/tmdb_sample/', function(req, res) {
		console.log (new Date() + " - Server => /tmdb_sample");
		tmdb.search.multi("The Walking Dead", function(err, movie) {
			res.setHeader('Content-Type', 'text/plain');
			for (var i in movie) {
				res.write(i+" = "+JSON.stringify(movie[i])+"\n\n");
			}
			res.end();
		});
	});

	server.get('/video_player/*', function(req, res) {
		console.log(new Date() + " - Server => deliverFile: " + req.url);
		return res.render('video_player.ejs', {path: req.url.replace('/video_player/','/streaming/video/'),  server_config: config});
	});

	server.get('/audio_player/*', function(req, res) {
		console.log(new Date() + " - Server => audio_player ");
		if (playlists[req.connection.remoteAddress].getTitle() == "") playlists[req.connection.remoteAddress].setTitle("Anonymous Playlist");
                return res.render('audio.ejs', {playlist: playlists[req.connection.remoteAddress], server_config: config});
	});

	server.get('/streaming/*', function (req, res) {
		var media_type = req.url.split("/")[2];
		req.url = req.url.replace(media_type+"/", "");
		var vidStreamer = require('vid-streamer');
		vidStreamer(req, res, __dirname + "/" + (config.vid_streamer_path.substr(0,2) == "./"?config.vid_streamer_path.slice(2):config.vid_streamer_path), media_type);
	});
	
	server.get('/getCurrentPlaylist/', function(req, res) {
		console.log(new Date() + " - Server => getCurrentPlaylist ");
		res.status(200);
		res.setHeader('Content-type', 'application/json');
		if (playlists[req.connection.remoteAddress] != null) res.write(playlists[req.connection.remoteAddress].toString());
		res.end();
	});
	
	server.get('/addToPlaylist/', function(req, res) {
		var params = querystring.parse(url.parse(req.url).query);
		console.log(new Date() + " - Server => addToPlaylist: " + params['location']);
		if (!playlists[req.connection.remoteAddress]) playlists[req.connection.remoteAddress] = new jspf.Jspf();
		var t = new jspf.Track();
		t.setLocation(params['location']);
		t.setTitle(params['location'].slice(params['location'].lastIndexOf("/")+1, params['location'].lastIndexOf(".")));
		playlists[req.connection.remoteAddress].pushTrack(t);
		res.status(200);
		res.setHeader('Content-type', 'application/json');
		res.write(playlists[req.connection.remoteAddress].toString());
		res.end();
	});
	
	server.get('/removeFromPlaylist/', function(req, res) {
		var params = querystring.parse(url.parse(req.url).query);
                console.log(new Date() + " - Server => removeFromPlaylist: " + params['location']);
		var t = new jspf.Track();
		t.setLocation(params['location']);
		t.setTitle(params['location'].slice(params['location'].lastIndexOf("/")+1, params['location'].lastIndexOf(".")));
		if (!playlists[req.connection.remoteAddress].removeTrack(t)) console.log(new Date() + " - Server => removeFromPlaylist: Unable to remove "+JSON.stringify(t));
		res.status(200);
		res.setHeader('Content-type', 'application/json');
		res.write(playlists[req.connection.remoteAddress].toString());
		res.end();
	});
                                                                                                                
	var readPathAndRespond = function (path, media_type, req, res) {
		 path = decodeURIComponent(path);
		 console.log (new Date() + " - Server => Entering readPathAndRespond: path= "+path+" media_type= "+media_type);
		 if (media_type != "video" && media_type != "audio") return sendNotFound(res);
		 var fs = require('fs');
		 if (fs.existsSync(path)) {
        	 	res.setHeader('Content-Type', 'text/html');
         		fs.stat(path, function(err, stats) {
         			if (stats.isDirectory()) {
			        	fs.readdir(path, function(err, files) {
			        		if (err) {
	        		       			console.log(new Date() + " - Server => readdir: Error reading dir "+ path);
		                		        res.end("Error Reading FS Content");
			                	} else {
			        	               	for (var i in files) {
		        		               		files[i] = {"path": (path.slice(config.server_root_dir[media_type].length)?path.slice(config.server_root_dir[media_type].length)+files[i]:files[i]), "stats": fs.statSync(path+"/"+files[i])};
		        		               	}
		        	        	        res.render('browse.ejs', {dir: sortAndFilterFiles(files, media_type), onRoot: (path!=config.server_root_dir[media_type]), server_config: config, media_type: media_type, playlist: playlists[req.connection.remoteAddress]});
			                	}
		 			});
	 			} else if (stats.isFile()) {
					if (media_type == "video") return renderMovie(res, path);
					if (media_type == "audio") return renderAudio(res, path);
		 		}
		 	});
		 } else sendNotFound(res);
	}

	var sortAndFilterFiles = function (files, media_type) {
		var directories = Array();
		var otherFiles = Array();
		for (var i in files) {
			if (files[i]["stats"].isDirectory()) directories.push(files[i]);
			else if (extensions[media_type][files[i].path.slice(files[i].path.lastIndexOf(".")).toLowerCase()]) otherFiles.push(files[i]);
		}
		directories.sort();
		otherFiles.sort();
		return directories.concat(otherFiles);
	}

	var renderMovie = function(res, path) {
		var filename = (path.lastIndexOf("/")>0?path.slice(path.lastIndexOf("/")+1):path);
		console.log(new Date() + " - Server => renderMovie: trying to find " + filename + " on TMDB");
		searchingResults[filename]=Array();
		searchingResults[filename]['found']=false;
		searchingResults[filename]['nbtries']=0;
		var words = filename.split(/\s|\./);
		words.pop();
		for (var i=words.length;i>0;i--) {	
			TMDB_SEARCH(filename, words, i, res);
		}
	}
	
	var renderAudio = function(res, path) {
		var filename = (path.lastIndexOf("/")>0?path.slice(path.lastIndexOf("/")+1):path);
                console.log(new Date() + " - Server => renderAudio: rendering " + filename);
                var p = new jspf.Jspf();
                p.setTitle(filename);
		var t = new jspf.Track();
		t.setLocation(path.slice(config.server_root_dir['audio'].length));
		p.pushTrack(t);
		console.log(JSON.stringify(p));
                res.render('audio.ejs', {playlist: p, server_config: config});
	}

	var TMDB_SEARCH = function(filename, word_list, nbWord, res) {
		console.log(new Date() + " - Server => TMDB_SEARCH: nbWord = "+nbWord+" resultFound: "+searchingResults[filename]['found']);
		var title = "";
		for (var i=0;i<nbWord;i++) {
			title += " " + word_list[i];
		}
		console.log(new Date() + " - Server => TMDB_SEARCH: searching for : "+title);
		tmdb.search.multi(title, function(err, movie) {
			if (movie.total_results>0) {
				console.log(new Date() + " - Server => TMDB_SEARCH: Found a result for :"+ title);
				nextSearchResult(filename, word_list, res, true);
				return renderMovieCallback(res, movie.results[0], filename);
			} else {
				return nextSearchResult(filename, word_list, res, false);
			}
		});
	}

	var nextSearchResult = function(filename, word_list, res, resultFound) {
		console.log(new Date() + " - Server => nextSearchResult: searching for : "+filename+" resultFound = "+resultFound+" nbWord = "+word_list.length+" nbTries = "+searchingResults[filename]['nbtries']);
		searchingResults[filename]['nbtries']++;
		if (searchingResults[filename]['nbtries'] >= word_list.length) {
			if (! searchingResults[filename]['found']) {
				searchingResults[filename] = null;
				return unableToRenderMovie(res, word_list, filename);
			} else {
				searchingResults[filename] = null;
			}
		}
	}

	var unableToRenderMovie = function(res, word_list, filename) {
		console.log(new Date() + " - Server => unableToRenderMovie: "+filename);
		var full_name="";
		for (var i=0;i<word_list.length;i++) {
			full_name += " " + word_list[i];
		}
		return res.render('movie.ejs', {search_result: {'original_name': "Unable to found " + full_name +" on TMDB"}, filename: filename, server_config: config});
	}

	var renderMovieCallback = function (res, search_result, filename) {
		console.log(new Date() + " - Server => renderMovieCallback: "+ filename + " render Already done: "+(searchingResults[filename] && searchingResults[filename]['found']));
		if (searchingResults[filename] && searchingResults[filename]['found'] || !(searchingResults[filename])) return false;
		if (search_result) {
	 		if (searchingResults[filename]) searchingResults[filename]['found'] = true;
	 		if (search_result['media_type'] == 'tv') {
			 	var match_res = filename.match(/S[0-9]+E[0-9]+/g);
			 	var urls;
	 			if (match_res) {
	 				var saison_episode =  match_res[0].match(/[0-9]+/g);
		 			seriesInfos[filename] = new Array();
		 			tmdb.tv.info(search_result['id'], function (err, serie_info) {
	 					return renderSerie(serie_info, null, null, res, search_result, filename, saison_episode);
		 			});
			 		tmdb.tv.seasons_info(search_result['id'], saison_episode[0], function (err, season) {
			 			return renderSerie(null, season, null, res, search_result, filename, saison_episode);
	 				});
	 				return true;
	 			} else {
	 				// render a serie with no episode/season info
	 			}
		 	} else {
		 		tmdb.movie.info(search_result['id'], function (err, movie) {
					return res.render('movie.ejs', {config: tmdb_config, search_result: search_result, movie: movie, filename: filename, server_config: config});
				});
				return true;
			}
		}
		res.end();
		return true;
	}

	var renderSerie = function(serie_infos, season_infos, episode_images, res, search_result, filename, saison_episode) {
		console.log(new Date() + " - Server => renderSerie: "+ filename + " " + (serie_infos?" serie infos available":"") + (season_infos?" season infos available":""));
		if (serie_infos) { seriesInfos[filename][0] = serie_infos; }
		if (season_infos) { seriesInfos[filename][1] = season_infos; }
		if (episode_images) {seriesInfos[filename][2].images = episode_images; }
		if (seriesInfos[filename][0] && seriesInfos[filename][1]) {
			if (! seriesInfos[filename][2]) {
				for (var i in seriesInfos[filename][1]['episodes']) {
					if (seriesInfos[filename][1]['episodes'][i].episode_number == saison_episode[1]) {
						 seriesInfos[filename][2] = seriesInfos[filename][1]['episodes'][i];
					 	 return tmdb.tv.seasons_images(search_result['id'], saison_episode[0], function(err, images) {
					 	 	return renderSerie(null, null, images, res, search_result, filename, saison_episode);
					 	 });
					}
				}
			}
			res.render('serie.ejs', 
				{config: tmdb_config, 
				search_result: search_result, 
				filename: filename, 
				serie_infos: seriesInfos[filename][0], 
				season_infos: seriesInfos[filename][1], 
				episode_infos: seriesInfos[filename][2], 
				saison_episode: saison_episode,
				server_config: config
				}
			);
			res.end();
			seriesInfos[filename] = null;
		}
		return true;
	}

	var sendNotFound = function(res) {
		res.status(404);
		res.setHeader('Content-Type', 'text/html');
		res.render('404error.ejs');
		res.end();
	}

	var accesslogToFile = function(log) {
		var fs = require('fs');
		if (config["access_log"] && config["access_log"] != "") {
			fs.open(config["access_log"], 'a', function(err, fd) {
			        if (err) console.log(new Date() + " - Server => accesslog_open : Error while opening access_log file. Err = " + JSON.stringify(err));
		        	else {
		        		var buf = new Buffer(log+"\n");
			        	fs.write(fd, buf, 0, buf.length, -1, function(err, written, string) {
			        		if(err)  console.log(new Date() + " - Server => access_log.write : Error while writing log to file. Err = " + JSON.stringify(err));
			        		fs.close(fd, function(err){
		        				if(err)  console.log(new Date() + " - Server => access_log.close file : Error while closing log to file. Err = " + JSON.stringify(err));
		        			});
				        });
				}
			});
		} else {
			console.log(log);
		}
	}

	server.use('/views/img', express.static(__dirname + "/views/img"));
	
	server.use(function(req, res, next) {
		sendNotFound(res);
	});

	server.listen(config.server_port);
	console.log(new Date() + " - Server => configuration loaded.");
}

console.log(new Date() + " - Starting Server.");
var security;
if (config["security_activated"]) {
	console.log(new Date() + " - Starting Server. Security activated");
	var init = require(config["security_class"]).init(function(secu) {
		console.log(new Date() + " - Server: Security initialisation done");
		security = secu;
		loadServer();
	});
} else loadServer();
