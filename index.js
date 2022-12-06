'use strict'

require('dotenv').config();
var path = require('path');

//DB
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;
var dburl = "mongodb://localhost:27017/";
var dbname = "openai";

//EXPRESS
var express = require('express');
var app = module.exports = express()
const hbs = require('hbs');
hbs.registerHelper('abrv', function(str, string_length) {
	if(str.length > string_length) {
		return new hbs.SafeString( str.slice(0,string_length) + "..." );
	} else {
		return new hbs.SafeString( str );
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
	var final_prompt = "";

	//Check if the prompt contains an expression
	const regex = /{{.*}}/gm;
	if(regex.exec(prompt.prompt) !== null) {
		final_prompt = prompt.prompt.replace("{{query}}", req.params.query);
	} else {
		final_prompt = prompt.prompt + "\n\n" + req.params.query;
	}

	var r = await gpt3call(prompt.model, final_prompt, prompt.temp, stops);

	var return_error = null;
	var return_valid = null;

	if((prompt.cascade == "true")) {
		var new_prompt = await dbget("prompts", {name: r}, {}, false);

		if(new_prompt != null && (prompt.validate == "null" || new RegExp(prompt.validate).test(r))) {
			r = await gpt3call(new_prompt.model, new_prompt.prompt + req.params.query, new_prompt.temp, "");
		} else {
			return_error = "AI asked for prompt that does not exist."
		}
	}

	//Save the response
	dbinsert("queries", {date: new Date(), model: prompt.model, prompt: prompt.name, query: req.params.query, response: r, temp: prompt.temp, favorite: false});

	var return_json = {response: r};
	if(return_valid != null) return_json.valid = new RegExp(req.params.validate).test(r);
	if(return_error != null) return_json.error = return_error;

	res.json(return_json);
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
	app.listen(3002);
	console.log('Express started on port 3000');
}

function getPrompts() {
	return dbget("prompts", {}, {}, true);
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