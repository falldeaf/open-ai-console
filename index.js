'use strict'

require('dotenv').config();
var path = require('path');

//Retrieve the addins
const https = require('https');
const { exec } = require('child_process');

//DB
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;
var dburl = "mongodb://localhost:27017/";
var dbname = "openai";

//EXPRESS
var express = require('express');
var app = module.exports = express();
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(express.json());

const hbs = require('hbs');
hbs.registerHelper('abrv', function(content, string_length) {
	if(content === undefined) return new hbs.SafeString("");

	if(content.length > string_length) {
		return new hbs.SafeString( content.slice(0,string_length) + "..." );
	} else {
		return new hbs.SafeString( content );
	}
});

hbs.registerHelper('date', function(date) {
	return (date instanceof Date && !isNaN(date)) ? date.toLocaleDateString('en-US') : "-";
});

hbs.registerHelper('favorite', function(fav) {
	return (fav) ? "★" : "✰";
});

hbs.registerHelper('favcolor', function(fav) {
	return (fav) ? "cbd124" : "111111";
});

//OPENAI CONFIG
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.set("view engine", "html");
app.engine('html', hbs.__express);
//app.set("view engine", "hbs");
app.set("views", path.join(__dirname,"static"));

app.get("/", async (req, res) => {
	const prompts = await getPrompts();
	const responses = await getResults();

	res.render("index.html", {
		prompts: prompts,
		responses: responses
	});
});

app.use(express.static(path.join(__dirname, 'static')));

app.get('/newquery/:promptname/:query', async function(req, res) {
	const prompt = await dbget("prompts", {name: req.params.promptname}, {}, false);
	const stops = ["\n"]; //(prompt.stop === "null") ? ["\n"] : prompt.stop.split(',');
	var should_execute = prompt.execute;
	var should_validate = prompt.validate;
	var final_prompt = "";

	//Check if the prompt contains an expression
	const regex = /{{.*}}/gm;
	if(regex.exec(prompt.prompt) !== null) {
		final_prompt = prompt.prompt.replace("{{query}}", req.params.query);
	} else {
		final_prompt = prompt.prompt + "\n\n" + req.params.query;
	}

	if(prompt.addin) {
		final_prompt = "Live data: " + await getAddin(prompt.addin) + "\n\n" + final_prompt;
	}

//	console.log(final_prompt);
//	return;

	var r = await gpt3call(prompt.model, final_prompt, prompt.temp, stops);

	var return_error = null;
	var return_valid = null;

	if(prompt.cascade) {
		var new_prompt = await dbget("prompts", {name: r}, {}, false);

		if(new_prompt != null && (prompt.validate === null || new RegExp(prompt.validate).test(r))) {

			//Check if the prompt contains an expression
			const regex = /{{.*}}/gm;
			if(regex.exec(new_prompt.prompt) !== null) {
				new_prompt.prompt = new_prompt.prompt.replace("{{query}}", req.params.query);
			} else {
				new_prompt.prompt = new_prompt.prompt + "\n\n" + req.params.query;
			}

			if(new_prompt.addin) {
				new_prompt.prompt = "Live data: " + await getAddin(new_prompt.addin) + "\n\n" + new_prompt.prompt;
			}

			if(new_prompt.execute) {
				should_execute = new_prompt.execute;
			}

			if(new_prompt.validate) {
				should_validate = new_prompt.validate;
			}

			//r = await gpt3call(new_prompt.model, new_prompt.prompt + req.params.query, new_prompt.temp, "");
			r = await gpt3call(new_prompt.model, new_prompt.prompt, new_prompt.temp, "");
		} else {
			return_error = "AI asked for prompt that does not exist."
		}
	}

	//Execute the response (if it's a valid command)
	if(should_execute && (should_validate === null || new RegExp(should_validate).test(r))) {

		console.log("Executing: " + prompt.execute);
		exec(r, (error, stdout, stderr) => {
			if (error) {
				return_error = error.message;
			}
			if (stderr) {
				return_error = stderr;
			}
			r = stdout;
		});
	} else {
		console.log("AI response is not a valid command.");
		console.log(new RegExp(prompt.validate).test(r));

	}

	//Save the response
	dbinsert("queries", {date: new Date(), model: prompt.model, prompt: prompt.name, query: req.params.query, response: r, temp: prompt.temp, favorite: false});

	var return_json = {response: r};
	if(return_valid != null) return_json.valid = new RegExp(req.params.validate).test(r);
	if(return_error != null) return_json.error = return_error;

	res.json(return_json);
});

app.post('/newprompt', (req, res) => {
	try {
		addJSONPrompt(req.body);
		res.send("✔️");
	} catch {
		res.send("💀");
	}
});

app.get('/newprompt/:name/:prompt/:model/:temp/:stop/:validate/:cascade/:execute', async function(req, res) {
	try {
		addPrompt(req.params.name, req.params.prompt, req.params.model, parseFloat(req.params.temp), req.params.stop, req.params.validate, req.params.cascade, req.params.execute);
		res.send("✔️");
	} catch {
		res.send("💀");
	}

	
});

app.get('/delprompt/:name', async function(req, res) {
	try {
		delPrompt(req.params.name);
		res.send("✔️");
	} catch {
		res.send("💀");
	}
});

app.get('/getprompts', async function(req, res){
	res.send(JSON.stringify(await getPrompts()));
});

app.get('/setfavorite/:id/:is_favorite', async function(req, res) {
	try {
		console.log("set fav for id: " + req.params.id);
		//TODO creating new field instead of updating.
		dbupdate("queries", {favorite: (req.params.is_favorite === "true")}, {_id: new ObjectId(req.params.id)});
		res.send("✔️");
	} catch {
		res.send("💀");
	}
});

app.get('/getresults', async function(req, res) {
	const r = await getResults();
	res.send("results:" + JSON.stringify(r));
});

//Start the express server
if (!module.parent) {
	app.listen(3019);
	console.log('Express started on port 3019');
}

function getPrompts() {
	return dbget("prompts", {}, {}, true);
}

function addJSONPrompt(new_prompt) {
	dbupdate("prompts", new_prompt, {name: new_prompt.name});
}

function addPrompt(name, prompt, model, temp, stop, validate, cascade, execute) {
	//dbinsert("prompts", {name: name, prompt: prompt, model: model, temp: temp, stop: stop}, "prompts");
	var doc = {name: name, prompt: prompt, model: model, temp: temp, stop: stop, cascade: cascade};
	if(validate != "") doc.validate = validate;
	if(execute != "") doc.execute = execute;
	dbupdate("prompts", doc, {name: doc.name});
}

function delPrompt(name) {
	dbdelete("prompts", name);
}

function getResults() {
	return dbget("queries", {}, {}, true);
}

function addResult(prompt, query, model, temp) {
	dbinsert("queries", {prompt: prompt, query: query, model: model, temp: temp}, "queries");
}

async function gpt3call(model, prompt, temp, stop) {
	const response = await openai.createCompletion({
		model: model,
		prompt: prompt,
		temperature: temp,
		max_tokens: 150,
		top_p: 1,
		frequency_penalty: 0,
		presence_penalty: 0.6
	});

	return response.data.choices[0].text;
}

async function dbinsert(col, doc) {
	const client = new MongoClient(dburl);

	try {
		const database = client.db("openai");
		const collection = database.collection(col);

		const result = await collection.insertOne(doc);
		console.log(`A document was inserted with the _id: ${result.insertedId}`);
	} finally {
		await client.close();
	}
}

async function dbdelete(col, name) {
	const client = new MongoClient(dburl);

	try {
		const database = client.db("openai");
		const collection = database.collection(col);

		const result = await collection.deleteOne({name: name});
		console.log(`A document was deleted with the _id: ${result.insertedId}`);
	} finally {
		await client.close();
	}
}

async function dbupdate(col, doc, index_object) {
	const client = new MongoClient(dburl);

	try {
		const database = client.db("openai");
		const collection = database.collection(col);

		const result = await collection.updateOne(index_object, { $set: doc}, {upsert:true}); 
		console.log(`A document was inserted with the _id: ${result.upsertedId}`);
		
	} finally {
		await client.close();
	}
}

async function dbget(col, query, options, multiple) {
	const client = new MongoClient(dburl);
	let results = {};

	try {
		const database = client.db("openai");
		const collection = database.collection(col);

		if(multiple) {
			results = await collection.find(query, options).sort({_id: -1}).toArray();
		} else {
			results = await collection.findOne(query, options);
		}
		
	} finally {
		await client.close();
	}

	return results;
}

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