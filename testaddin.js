//Retrieve the addins
const https = require('https');
const { exec } = require('child_process');

//anonymous function to retrieve the addins
(async () => {
	// Retrieve the addins

	//console.log( await getAddin('python3 smartthingscl.py --devices') );
	//console.log("run");
})();

//pass a string that contains either a valid url or a command line command and return the output
function getAddin(input) {
	return new Promise((resolve, reject) => {
		if (isValidURL(input)) {
			// Make a request to the URL and return the response data
			https.get(input, (res) => {
			res.setEncoding('utf8');
			let data = '';
			res.on('data', (chunk) => { data += chunk; });
			res.on('end', () => { resolve(data); });
			});
		} else {
			// Execute the command line command and return the output
			exec(input, (err, stdout, stderr) => {
			if (err) {
				reject(stderr);
			} else {
				resolve(stdout);
			}
			});
		}
	});
}

function isValidURL(str) {
	return /^https?:\/\/[^\s]+$/.test(str);
}