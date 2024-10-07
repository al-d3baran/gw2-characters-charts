const uiToken = document.getElementById('token');
const uiSubmit = document.getElementById('submit');
const uiRaces = document.getElementById('races');
const uiProfessions = document.getElementById('professions');
const uiGenders = document.getElementById('genders');
const uiLevels = document.getElementById('levels');
const uiAges = document.getElementById('ages');
const uiDeaths = document.getElementById('deaths');
const uiPlayed = document.getElementById('played');
const uiBirthday = document.getElementById('birthdays');
const uiMain = document.querySelector('main');
const uiFooter = document.querySelector('footer');
const uiNav = Array.from(document.querySelectorAll('nav a'));
const uiScreenshot = document.querySelector('#screenshot svg');
const labelsRace = ["Asura", "Charr", "Human", "Norn", "Sylvari"];
const labelsProfession = ["Elementalist", "Engineer", "Guardian", "Mesmer", "Necromancer", "Ranger", "Revenant", "Thief", "Warrior"];
const labelsGender = ["Male", "Female"];
const canvasColors = ["#95bf74", "#6f1d1b", "#219ebc", "#fbba72", "#d62828", "#eae2b7", "#c77dff", "#432534", "#fb8500", "#606c38", "#023047", "#3c096c", "#af9981", "#8ecae6"];
const canvasWidth = 256;
const canvasHeight = 256;
const canvasHole = 40;
const chunkSize = 10;

var apiProcessing = false;
var apiData = {};
var uiData = [];

function formatHeader(value) {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatValue(value) {
	return String(value).padStart(2, '0');
}

function formatTime(data) {
	let date = [];
	let time = [];

	if (data.years != null && data.years > 0)
		date.push(`${data.years}y`);

	if (data.months != null && (data.months > 0 || date.length > 0))
		date.push(`${data.months}m`);

	if (data.days != null && (data.days > 0 || date.length > 0))
		date.push(`${data.days}d`);

	time.push(formatValue(data.hours));
	time.push(formatValue(data.minutes));
	time.push(formatValue(data.seconds));

	return date.length > 0 ? `${date.join(' ')}, ${time.join(':')}`.trim() : time.join(':');
}

function sortData(data, desc = false) {
	const entries = Object.entries(data);
	entries.sort((a, b) => desc == false ? b[1].order - a[1].order : a[1].order - b[1].order);

	return Object.fromEntries(entries);
}

async function requestApi(endpoint, token = null, ids = null) {
	try {
		const url = new URL(`https://api.guildwars2.com/v2/${endpoint}`);
		const params = new URLSearchParams();

		if (token !== null)
			params.append('access_token', token);

		if (ids !== null)
			params.append('ids', ids);

		url.search = params.toString();
		const response = await fetch(url.toString());

		if (response.ok)
			return await response.json();

		throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
	} catch (error) {
		throw new Error(`Request failed: ${error.message}`);
	}
}

function getIndex(element) {
	return Array.prototype.indexOf.call(element.parentNode.children, element);
}

function getCharactersChunks(characters, size) {
	const chunks = [];

	for (let i = 0; i < characters.length; i += size)
		chunks.push(characters.slice(i, i + size).join(','));

	return chunks;
}

function getDays(value) {
	const days = Math.floor(value / (24 * 3600));
	value %= (24 * 3600);
	const hours = Math.floor(value / 3600);
	value %= 3600;
	const minutes = Math.floor(value / 60);
	const seconds = value % 60;

	return { days: days, hours: hours, minutes: minutes, seconds: seconds };
}

function getAge(value) {
	const then = new Date(value);
	const now = new Date();
	const years = now.getFullYear() - then.getFullYear();
	const months = now.getMonth() - then.getMonth();
	const days = now.getDate() - then.getDate();
	const hours = now.getHours() - then.getHours();
	const minutes = now.getMinutes() - then.getMinutes();
	const seconds = now.getSeconds() - then.getSeconds();
	const total = Math.floor((now - then) / 1000);

	return getDateTime({ years, months, days, hours, minutes, seconds, total });
}

function getDateTime(data) {
	if (data.seconds < 0) {
		data.seconds += 60;
		data.minutes--;
	}

	if (data.minutes < 0) {
		data.minutes += 60;
		data.hours--;
	}

	if (data.hours < 0) {
		data.hours += 24;
		data.days--;
	}

	if (data.days < 0) {
		var lastMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
		data.days += lastMonth.getDate();
		data.months--;
	}

	if (data.months < 0) {
		data.months += 12;
		data.years--;
	}

	return data;
}

function getBirthday(value) {
	const birthday = new Date(value);
	const today = new Date();
	const passed = today.getTime() - birthday.getTime();
	const days = Math.floor(passed / (1000 * 60 * 60 * 24));

	return 365 - (days % 365);
}

function getCharacterDetails(data) {
	return `${data[0]} (Lv.${data[1]} ${data[2].toLowerCase()} ${data[3].toLowerCase()})`;
}

function drawLabels(data) {
	const ul = document.createElement('ul');

	Object.keys(data).forEach((key, index) => {
		const li = document.createElement('li');
		const color = canvasColors[index % canvasColors.length];
		li.innerHTML = `<span style="border-color: ${color}">${key}: ${data[key]}</span>`;
		ul.appendChild(li);
	});

	return ul;
}

function getDetails(label, data) {
	switch (label) {
		case labelsRace:
			return `${data[0]} (Lv.${data[1]} ${data[2].toLowerCase()} ${data[3].toLowerCase()})`;
		case labelsProfession:
			return `${data[0]} (Lv.${data[1]} ${data[2].toLowerCase()} ${data[4].toLowerCase()})`;
		case labelsGender:
			return `${data[0]} (Lv.${data[1]} ${data[4].toLowerCase()} ${data[3].toLowerCase()})`;
	}
}

function getMain(criteria, labels) {
	const output = {};

	labels.forEach(label => {
		output[label] = apiData
			.filter(data => data[criteria] === label)
			.map(data => getDetails(labels, [data.name, data.level, data.gender, data.profession, data.race]))
			.sort();
	});

	return output;
}

function drawPie(data) {
	const canvas = document.createElement('canvas');
	canvas.width = canvasWidth;
	canvas.height = canvasHeight;
	const ctx = canvas.getContext('2d');
	const values = Object.values(data);
	const total = values.reduce((sum, value) => sum + value, 0);
	const radius = Math.min(canvas.width, canvas.height) / 2;
	const left = canvas.width / 2;
	const top = canvas.height / 2;
	const space = (canvasHole / 100) * radius;

	var angle = 0;

	values.forEach((value, index) => {
		const slice = (value / total) * 2 * Math.PI;
		ctx.beginPath();
		ctx.moveTo(left, top);
		ctx.arc(left, top, radius, angle, angle + slice);

		if (canvasHole > 0 && canvasHole < 100)
			ctx.arc(left, top, space, angle + slice, angle, true);

		ctx.closePath();
		ctx.fillStyle = canvasColors[index % canvasColors.length];
		ctx.fill();

		angle += slice;
	});

	return canvas;
}

function drawBars(data, article) {
	const ul = document.createElement('ul');
	const items = sortData(data, ['ages', 'birthdays'].includes(article.id) ? true : false);

	var max = 0;

	if (article.id == 'ages')
		max = Math.max(...Object.values(data).map(s => s.value.total));
	else if (article.id == 'played')
		max = Math.max(...Object.values(data).map(s => s.order));
	else
		max = Math.max(...Object.values(data).map(s => s.value));

	Object.keys(items).forEach(item => {
		let value = 0;
		let bar = 0;

		if (article.id == 'ages') {
			let v = Object.entries(items[item])[1][1];
			value = formatTime(v);
			bar = (v.total / max) * 100;
		} else if (article.id == 'played') {
			let v = Object.entries(items[item])[0][1];
			value = formatTime(getDays(v));
			bar = (v / max) * 100;
		} else if (article.id == 'birthdays') {
			let v = Object.entries(items[item])[1][1];
			value = `${v}d`;
			bar = 100 - ((v / max) * 100);
		} else {
			value = Object.entries(items[item])[1][1];
			bar = (value / max) * 100;
		}

		console.log(bar);
		let li = document.createElement('li');
		let elBar = document.createElement('div');
		let elName = document.createElement('span');
		let elValue = document.createElement('span');

		elBar.style.width = `${Math.floor(bar)}%`;
		elName.className = 'name';
		elName.innerText = item;
		elValue.className = 'value';
		elValue.innerText = value;

		li.appendChild(elBar);
		li.appendChild(elName);
		li.appendChild(elValue);
		ul.appendChild(li);
	});

	return ul;
}

function listCharacters(data) {
	Object.keys(data).forEach(key => {
		if (data[key].length > 0) {
			let article = document.createElement('article');
			let hr = document.createElement('h2');
			let ul = document.createElement('ul');

			article.id = key;
			article.className = 'list';
			hr.textContent = key;

			for (value in data[key]) {
				let li = document.createElement('li');
				li.textContent = data[key][value];
				ul.appendChild(li);
			}

			article.appendChild(hr);
			article.appendChild(ul);
			uiMain.appendChild(article);
		}
	});
}

function createArticle(id, data, type) {
	let article = document.createElement('article');
	let hr = document.createElement('h2');
	let section = document.createElement('section');

	article.id = id;
	article.className = type;
	hr.textContent = formatHeader(id);

	if (type == 'pie') {
		const pie = drawPie(data);
		const labels = drawLabels(data);
		section.appendChild(labels);
		section.appendChild(pie);
	} else {
		const bars = drawBars(data, article);
		section.appendChild(bars);
	}

	article.appendChild(hr);
	article.appendChild(section);

	return article;
}

function createLog(value, error = false) {
	let div = document.createElement('div');
	div.innerText = value;

	uiFooter.appendChild(div);

	if (!error) {
		setTimeout(() => {
			div.classList.add('fade');

			setTimeout(() => { div.remove() }, 1000);
		}, 2000);
	} else {
		div.classList.add('error');
	}
}

async function fetchData(token) {
	apiProcessing = true;

	try {
		createLog('Verifying token...');

		const tokenInfo = await requestApi('tokeninfo', token);

		if (tokenInfo.permissions.includes('characters')) {
			createLog('Getting characters...');

			const characters = await requestApi('characters', token);

			createLog('Collecting data...');

			const chunks = getCharactersChunks(characters, chunkSize);
			const api = await Promise.all(chunks.map(chunk => requestApi('characters', token, chunk)));

			createLog('Parsing data...');

			apiData = api.flat();

			const data = {
				Races: { "Asura": 0, "Charr": 0, "Human": 0, "Norn": 0, "Sylvari": 0 },
				Professions: { "Elementalist": 0, "Engineer": 0, "Guardian": 0, "Mesmer": 0, "Necromancer": 0, "Ranger": 0, "Revenant": 0, "Thief": 0, "Warrior": 0 },
				Genders: { "Male": 0, "Female": 0 },
				Levels: {},
				Ages: {},
				Deaths: {},
				Played: {},
				Birthdays: {}
			}

			apiData.forEach(character => {
				data.Races[character.race] += 1;
				data.Professions[character.profession] += 1;
				data.Genders[character.gender] += 1;
				data.Levels[character.name] = { order: character.level, value: character.level };
				data.Ages[character.name] = { order: Date.parse(character.created), value: getAge(character.created) };
				data.Deaths[character.name] = { order: character.deaths, value: character.deaths };
				data.Played[character.name] = { order: character.age, value: getDays(character.age) };
				data.Birthdays[character.name] = { order: getBirthday(character.created), value: getBirthday(character.created) };
			});

			uiData = [];
			uiData.push(createArticle('races', data.Races, 'pie'));
			uiData.push(createArticle('professions', data.Professions, 'pie'));
			uiData.push(createArticle('genders', data.Genders, 'pie'));
			uiData.push(createArticle('levels', data.Levels, 'bars'));
			uiData.push(createArticle('played', data.Played, 'bars'));
			uiData.push(createArticle('deaths', data.Deaths, 'bars'));
			uiData.push(createArticle('ages', data.Ages, 'bars'));
			uiData.push(createArticle('birthdays', data.Birthdays, 'bars'));

			const nav = document.querySelector('nav a.selected');
			const index = getIndex(nav);

			setMain(index);

			createLog("Job's done!");
		} else {
			throw new Error('Token permissions failed: Missing "characters" permission');
		}
	} catch (error) {
		createLog(error.message, true);
		console.error(error.message);
	} finally {
		apiProcessing = false;
	}
}

function processToken(event) {
	if (event.target === uiSubmit || (event.target === uiToken && event.key === 'Enter')) {
		event.preventDefault();
		const token = uiToken.value.trim();

		if (!apiProcessing && /^[0-9A-F]{64}$/.test(token.replace(/-/g, '').toUpperCase())) {
			uiFooter.innerHTML = '';
			fetchData(token);
		}
	}
}

function setMain(index) {
	if (uiData.length > 0) {
		uiMain.innerHTML = '';

		if (index === 0)
			uiData.forEach(article => uiMain.appendChild(article));
		else {
			uiMain.appendChild(uiData[index - 1]);

			let output;

			switch (index) {
				case 1:
					output = getMain('race', labelsRace);
					break;
				case 2:
					output = getMain('profession', labelsProfession);
					break;
				case 3:
					output = getMain('gender', labelsGender);
					break;
				default:
					return;
			}

			listCharacters(output);
		}
	}
}

uiToken.addEventListener('keydown', event => processToken(event));

document.addEventListener('click', event => {
	if (uiNav.includes(event.target)) {
		event.preventDefault();
		uiNav.forEach(nav => nav.classList.remove('selected'));
		event.target.classList.add('selected');
		setMain(getIndex(event.target));
	}

	if (event.target === uiSubmit)
		processToken(event);

	if (event.target === uiScreenshot) {
		html2canvas(uiMain).then(canvas => {
			var link = document.createElement('a');
			link.href = canvas.toDataURL('image/png');
			link.download = 'gw2-characters-charts.png';
			link.click();
		});
	}
});