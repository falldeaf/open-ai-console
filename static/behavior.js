document.querySelector('#askbutton').addEventListener("click", async () => {
	document.querySelector('#result').innerHTML = '<div class="spinner-border text-dark" role="status"><span class="visually-hidden">Loading...</span></div>';

	const query = document.querySelector('#querystring').value;
	const prompt = document.querySelector('#promptselect').value;

	const url = `newquery/${prompt}/${query}`;

	let response = await fetch(url);
	let json = await response.json();
	console.log(json);
	document.querySelector('#result').textContent = json.response;
});

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

//app.get('/newprompt/:name/:prompt/:model/:temp/:stop/:validate/:cascade', async function(req, res) {
document.querySelector('#savepromptbutton').addEventListener("click", async () => {
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