var clc = require('cli-color');

function log(module_name, function_name, msg) {
	console.log(new Date() + " - "+clc.green(module_name+(function_name?".":"")+function_name)+" => "+msg);
}

module.exports.log=log;
