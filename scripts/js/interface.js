const uiNav = document.querySelectorAll('nav a');
const uiToken = document.getElementById('token');
const uiSubmit = document.getElementById('submit');
const uiMain = document.querySelector('main');
const uiArticle = document.querySelector('article');
const uiScreenshot = document.querySelector('#screenshot');

const labelData = {
	race: ["Asura", "Charr", "Human", "Norn", "Sylvari"],
	profession: ["Elementalist", "Engineer", "Guardian", "Mesmer", "Necromancer", "Ranger", "Revenant", "Thief", "Warrior"],
	gender: ["Male", "Female"]
}

var apiData = {};
var uiData = [];
var apiProcessing = false;

function formatHeader(value) {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatValue(value) {
	return String(value).padStart(2, '0');
}

function formatOrdinal(value) {
	const suf = ['th', 'st', 'nd', 'rd'];
	const mod = value % 100;

	if (mod >= 11 && mod <= 13)
		return value + suf[0];

	return value + (suf[value % 10] || suf[0]);
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
		let li = document.createElement('li');
		const span = document.createElement('span');

		span.classList.add(key);
		span.textContent = `${key}: ${data[key]}`;

		li.appendChild(span);
		ul.appendChild(li);
	});

	return ul;
}

function getDetails(label, data) {
	switch (label) {
		case labelData.race:
			return `${data[0]} (Lv.${data[1]} ${data[2].toLowerCase()} ${data[3].toLowerCase()})`;
		case labelData.profession:
			return `${data[0]} (Lv.${data[1]} ${data[2].toLowerCase()} ${data[4].toLowerCase()})`;
		case labelData.gender:
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

function drawCircle(cx, cy, radius, className) {
	const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');

	circle.setAttribute('cx', cx);
	circle.setAttribute('cy', cy);
	circle.setAttribute('r', radius);
	circle.setAttribute('class', className);

	return circle;
}

function drawPie(data, radius = 8.5) {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	const circumference = 2 * Math.PI * radius;
	const total = Object.values(data).reduce((acc, val) => acc + val, 0);

	let offset = 0;

	svg.setAttribute('viewBox', '0 0 24 24');
	svg.appendChild(drawCircle('12', '12', radius, 'ring'));

	Object.keys(data).forEach(item => {
		const value = data[item];
		const percentage = value / total;
		const dash = percentage * circumference;
		const circle = drawCircle('12', '12', radius, `segment ${item}`);

		circle.setAttribute('stroke-dasharray', `${dash} ${circumference}`);
		circle.setAttribute('stroke-dashoffset', `${offset * -1}`);
		svg.appendChild(circle);

		offset += dash;
	});

	return svg;
}

function drawBars(data, section) {
	const ul = document.createElement('ul');
	const items = sortData(data, ['ages', 'birthdays'].includes(section.id) ? true : false);

	var max = 0;

	if (section.id == 'ages')
		max = Math.max(...Object.values(data).map(s => s.value.total));
	else if (section.id == 'played' || section.id == 'birthdays')
		max = Math.max(...Object.values(data).map(s => s.order));
	else
		max = Math.max(...Object.values(data).map(s => s.value));

	Object.keys(items).forEach(item => {
		let value = 0;
		let bar = 0;

		if (section.id == 'ages') {
			let v = Object.entries(items[item])[1][1];
			value = formatTime(v);
			bar = (v.total / max) * 100;
		} else if (section.id == 'played') {
			let v = Object.entries(items[item])[0][1];
			value = formatTime(getDays(v));
			bar = (v / max) * 100;
		} else if (section.id == 'birthdays') {
			let v = Object.entries(items[item])[0][1];
			let y = Object.entries(items[item])[1][1]['years'];
			value = `${v}d (${formatOrdinal(y + 1)} year)`;
			bar = 100 - ((v / max) * 100);
		} else {
			value = Object.entries(items[item])[1][1];
			bar = (value / max) * 100;
		}

		let li = document.createElement('li');
		let elBar = document.createElement('span');
		let elName = document.createElement('span');
		let elValue = document.createElement('span');

		elBar.style.width = `${Math.floor(bar)}%`;
		elBar.className = 'bar';
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
			let section = document.createElement('section');
			let hr = document.createElement('h2');
			let ul = document.createElement('ul');

			section.id = key;
			section.className = 'list';
			hr.textContent = key;

			for (value in data[key]) {
				let li = document.createElement('li');
				li.textContent = data[key][value];
				ul.appendChild(li);
			}

			section.appendChild(hr);
			section.appendChild(ul);
			uiArticle.appendChild(section);
		}
	});
}

function createSection(id, data, type) {
	let section = document.createElement('section');
	let hr = document.createElement('h2');
	let div = document.createElement('div');

	section.id = id;
	section.className = type;
	hr.textContent = formatHeader(id);

	if (type == 'pie') {
		const labels = drawLabels(data);
		const pie = drawPie(data);

		div.appendChild(labels);
		div.appendChild(pie);
	} else {
		const bars = drawBars(data, section);

		div.appendChild(bars);
	}

	section.appendChild(hr);
	section.appendChild(div);

	return section;
}

async function fetchData(token) {
	apiProcessing = true;

	try {
		uiSubmit.value = 'Verifying...';

		const tokenInfo = await requestApi('tokeninfo', token);

		if (tokenInfo.permissions.includes('characters')) {
			uiSubmit.value = 'Collecting...';

			const characters = await requestApi('characters', token);
			const chunks = getCharactersChunks(characters, 10);
			const api = await Promise.all(chunks.map(chunk => requestApi('characters', token, chunk)));

			uiSubmit.value = 'Parsing...';

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
				data.Birthdays[character.name] = { order: getBirthday(character.created), value: getAge(character.created) };
			});

			uiData = [];
			uiData.push(createSection('races', data.Races, 'pie'));
			uiData.push(createSection('professions', data.Professions, 'pie'));
			uiData.push(createSection('genders', data.Genders, 'pie'));
			uiData.push(createSection('levels', data.Levels, 'bars'));
			uiData.push(createSection('played', data.Played, 'bars'));
			uiData.push(createSection('deaths', data.Deaths, 'bars'));
			uiData.push(createSection('ages', data.Ages, 'bars'));
			uiData.push(createSection('birthdays', data.Birthdays, 'bars'));

			const nav = document.querySelector('nav a.selected');
			const index = getIndex(nav);

			setMain(index);

			uiSubmit.value = 'Fetch';
		} else {
			throw new Error('Token permissions failed: Missing "characters" permission');
		}
	} catch (error) {
		uiSubmit.value = 'Retry';
		console.error(error.message);
	} finally {
		apiProcessing = false;
	}
}

function processToken(event) {
	if (event.target === uiSubmit || (event.target === uiToken && event.key === 'Enter')) {
		event.preventDefault();
		const token = uiToken.value.trim();

		if (!apiProcessing && /^[0-9A-F]{64}$/.test(token.replace(/-/g, '').toUpperCase()))
			fetchData(token);
	}
}

function setMain(index) {
	if (uiData.length > 0) {
		uiArticle.innerHTML = '';

		if (index === 0)
			uiData.forEach(section => uiArticle.appendChild(section));
		else {
			uiArticle.appendChild(uiData[index - 1]);

			let output;

			switch (index) {
				case 1:
					output = getMain('race', labelData.race);
					break;
				case 2:
					output = getMain('profession', labelData.profession);
					break;
				case 3:
					output = getMain('gender', labelData.gender);
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
	if (Array.from(uiNav).includes(event.target)) {
		event.preventDefault();
		uiNav.forEach(nav => nav.classList.remove('selected'));
		event.target.classList.add('selected');

		setMain(getIndex(event.target));
	}

	if (event.target === uiSubmit)
		processToken(event);

	if (event.target === uiScreenshot && uiArticle.children.length > 0) {
		uiMain.classList.add('screenshot');

		html2canvas(uiArticle).then(canvas => {
			let nav = document.querySelector('nav a.selected').hash;
			let link = document.createElement('a');
			link.href = canvas.toDataURL('image/png');
			link.download = `gw2-characters-charts-${nav.substring(1)}.png`;

			link.click();
			uiMain.classList.remove('screenshot');
		});
	}
});