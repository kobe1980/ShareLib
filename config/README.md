# Sharelib Config
Here is how you should configure your server.

## config.json

### server_external address
domain name of the server

### server_port
port on which the server is bind.
It also defined the exteral port open on your gateway if you use IGD.

### server_root_dir
root directories of audio and video files on the Synology FS.
It must be an Array indexed by "audio" and "video"

### access_log
File where your want to store the access logs (Similar to apache access.log).
WArning, there no log rotate. If you want to have some, you must do it by yourself.

### security_activated
Boolean defining whether to activate security or not.

### security_class
Name of the Object to instanciate to check security

### security_function
Name of the function that while be called by the server to check the security

### security_reject_function
Name of the function called when the security is not validated

### authentication_page
Page to deliver to propose a way of authenticate customers

### tmdb_key
Key to use TMDB features

### sharelib_streamer_config_path
Path of the config file of sharelib_streamer

### tmdb_lang
Language to use with tmdb. Should be an ISO 639-1 code

### use_IGD
Wheter to activate IGD or not
