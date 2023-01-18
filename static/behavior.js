const md = new Remarkable();

document.querySelector('#askbutton').addEventListener("click", async () => {
	submitQuery();
});

//If user presses control + enter in the #querystring textarea, submit query
document.querySelector('#querystring').addEventListener("keydown", async (event) => {
	if(event.ctrlKey && event.key === "Enter") {
		submitQuery();
	}
});

async function submitQuery() {
	document.querySelector('#result').innerHTML = '<div class="spinner-border text-dark" role="status"><span class="visually-hidden">Loading...</span></div>';

	const query = document.querySelector('#querystring').value;
	const prompt = document.querySelector('#promptselect').value;
	
	const url = `newquery/${prompt}/${query}`;
	
	document.querySelector('#querystring').value = "";
	let response = await fetch(url);
	let json = await response.json();
	console.log(json);
	document.querySelector('#result').innerHTML = md.render(json.response);
}


document.querySelector('#clearpromptbutton').addEventListener("click", async () => {
	document.querySelector('#prompt_form').reset();
});

document.querySelector('#deletepromptbutton').addEventListener("click", async () => {
	if(document.querySelector('#prompt_name_input').value === "") return;

	url = `/delprompt/${encodeURIComponent(document.querySelector('#prompt_name_input').value)}`;
	console.log(url);

	let response = await fetch(url);
	let text = await response.text();
	console.log(text);

	document.querySelector('#prompt_form').reset();
});

document.querySelector('#closepromptbutton').addEventListener("click", async () => {
	document.querySelector('#prompt_form').reset();
});

document.querySelector('#result-copy').addEventListener("click", async (event) => {
	let text = document.querySelector('#result').innerHTML;
	if(text.includes("<strong>")) {
		//Match the contents of the first <strong> tag and return it's contents to the text variable
		console.log(text.match(/<strong>(.*?)<\/strong>/));
		text = text.match(/<strong>(.*?)<\/strong>/)[1];
	}

	copyToClipboard(text)
	.then(() => {
		document.querySelector('#result-copy').textContent = "Copied!";
		setInterval(() => {
			document.querySelector('#result-copy').textContent = "📋 copy";
		}, 2000);
	})
	.catch(err => {
		document.querySelector('#result-copy').textContent = "Error";
		setInterval(() => {
			document.querySelector('#result-copy').textContent = "📋 copy";
		}, 2000);
	});
});

//app.get('/newprompt/:name/:prompt/:model/:temp/:stop/:validate/:cascade', async function(req, res) {
document.querySelector('#savepromptbutton').addEventListener("click", async () => {

	let form_data = new FormData(document.getElementById("prompt_form"));
	console.log(form_data);
	let data = {};
	for (let [key, value] of form_data.entries()) {
		if(value != "" && value != "null" && value != null) {
			//Turn temp value to number
			if(key === "temp") value = Number(value);

			//Turn 'on' into true
			if(value === "on") value = true;
			data[key] = value;
		}
	}

	fetch('/newprompt', {
		method: 'POST',
		body: JSON.stringify(data),
		headers: { 'Content-Type': 'application/json' }
	});
	/*
	url = `/newprompt
			/${encodeURIComponent(document.querySelector('#prompt_name_input').value)}
			/${encodeURIComponent(document.querySelector('#prompt_prompt_input').value)}
			/${document.querySelector('#prompt_model_input').value}
			/${document.querySelector('#prompt_temp_input').value}
			/null
			/${(encodeURIComponent(document.querySelector('#prompt_validate_input').value) != "") ? encodeURIComponent(document.querySelector('#prompt_validate_input').value) : "null"}
			/${(document.querySelector('#prompt_cascade_input').checked)}
			/${(document.querySelector('#prompt_execute_input').checked)}`;

	url = url.replace(/\s/g, "");
	console.log(url);

	let response = await fetch(url);
	let text = await response.text();
	console.log(text);
	*/

	document.querySelector('#prompt_form').reset();
});

document.querySelectorAll('.prompt_row').forEach(element => {
	element.addEventListener("click", async (row) => {
		console.log("prompt row:");
		console.log(row.currentTarget);
		document.querySelector('#prompt_name_input').value = row.currentTarget.getAttribute('data1');
		document.querySelector('#prompt_model_input').value = row.currentTarget.getAttribute('data2');
		document.querySelector('#prompt_prompt_input').value = row.currentTarget.getAttribute('data3');
		document.querySelector('#prompt_temp_input').value = row.currentTarget.getAttribute('data4');
		document.querySelector('#prompt_validate_input').value = (row.currentTarget.getAttribute('data5') === "null") ? "" : row.currentTarget.getAttribute('data5');
		document.querySelector('#prompt_cascade_input').checked = (row.currentTarget.getAttribute('data6') === "true");
		document.querySelector('#prompt_execute_input').checked = (row.currentTarget.getAttribute('data7') === "true");
		document.querySelector('#prompt_addin_input').value = row.currentTarget.getAttribute('data8');
	});
});

document.querySelectorAll('.queryfavstar').forEach(element => {
	element.addEventListener("click", async (row) => {
	console.log("prompt row:");
	console.log(row.currentTarget);

	url = `/setfavorite/${row.currentTarget.getAttribute('row_id')}/${!(row.currentTarget.getAttribute('is_fav') === "true")}`;

	let response = await fetch(url);
	let text = await response.text();
	});
});

function copyToClipboard(textToCopy) {
	// navigator clipboard api needs a secure context (https)
	if (navigator.clipboard && window.isSecureContext) {
		// navigator clipboard api method'
		return navigator.clipboard.writeText(textToCopy);
	} else {
		// text area method
		let textArea = document.createElement("textarea");
		textArea.value = textToCopy;
		// make the textarea out of viewport
		textArea.style.position = "fixed";
		textArea.style.left = "-999999px";
		textArea.style.top = "-999999px";
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();
		return new Promise((res, rej) => {
			// here the magic happens
			document.execCommand('copy') ? res() : rej();
			textArea.remove();
		});
	}
}