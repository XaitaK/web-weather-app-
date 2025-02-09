class WeatherApp {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.temperatureChart = null;
        this.forecast = new Forecast(apiKey);
        this.init();
    }

    init() {
        document.getElementById('getWeatherBtn').addEventListener('click', () => {
            let city = document.getElementById('cityInput').value;
            this.getWeather(city);
        });

        document.getElementById('cityInput').addEventListener('input', () => {
            let query = document.getElementById('cityInput').value;
            this.getCitySuggestions(query);
        });

        document.addEventListener("DOMContentLoaded", () => {
            fetch("http://ip-api.com/json")
                .then(response => response.json())
                .then(data => {
                    document.getElementById('cityInput').value = data.city;
                    this.getWeather(data.city);
                })
                .catch(error => console.error("Ошибка определения местоположения", error));
        });
    }

    getCitySuggestions(query) {
        const apiUrl = `http://api.teleport.org/api/cities/?search=${query}`;

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                let suggestions = data._embedded['city:search-results'];
                let datalist = document.getElementById('citySuggestions');
                datalist.innerHTML = '';

                suggestions.forEach(suggestion => {
                    let option = document.createElement('option');
                    option.value = suggestion.matching_full_name;
                    datalist.appendChild(option);
                });
            })
            .catch(error => console.error("Ошибка при получении подсказок городов", error));
    }

    getWeather(city) {
        const apiUrl = `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${this.apiKey}&units=metric&lang=ru`;

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                if (data.cod !== 200) {
                    alert("Город не найден");
                    return;
                }

                document.getElementById('weatherCard').classList.remove('hidden');
                document.getElementById('forecastTable').classList.remove('hidden');
                document.getElementById('rainMapContainer').classList.remove('hidden');
                document.getElementById('clockContainer').classList.remove('hidden');

                document.getElementById('cityName').innerText = `Погода в ${data.name}`;
                document.getElementById('temperature').innerText = Math.round(data.main.temp);
                document.getElementById('feelsLike').innerText = Math.round(data.main.feels_like);
                document.getElementById('pressure').innerText = Math.round(data.main.pressure * 0.75006375541921); // Преобразование давления
                document.getElementById('humidity').innerText = data.main.humidity;
                document.getElementById('windSpeed').innerText = Math.round(data.wind.speed);
                document.getElementById('description').innerText = data.weather[0].description;
                document.getElementById('weatherIcon').src = `http://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
                this.forecast.getForecast(city);
                mapHandler.updateRainMap(data.coord.lat, data.coord.lon);
                mapHandler.updateWeatherLayers(data.coord.lat, data.coord.lon);
                this.getUVIndex(data.coord.lat, data.coord.lon);
                this.getAirPollution(data.coord.lat, data.coord.lon);
            })
            .catch(error => {
                alert("Ошибка при получении данных");
                console.error(error);
            });
    }

    getUVIndex(lat, lon) {
        const apiUrl = `http://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${this.apiKey}`;

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                document.getElementById('uvIndex').innerText = data.value;
            })
            .catch(error => console.error("Ошибка при получении данных УФ индекса", error));
    }

    getAirPollution(lat, lon) {
        const apiUrl = `http://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${this.apiKey}`;

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                const aqi = data.list[0].main.aqi;
                let aqiText = '';

                switch (aqi) {
                    case 1:
                        aqiText = 'Очень низкое';
                        break;
                    case 2:
                        aqiText = 'Низкое';
                        break;
                    case 3:
                        aqiText = 'Среднее';
                        break;
                    case 4:
                        aqiText = 'Высокое';
                        break;
                    case 5:
                        aqiText = 'Очень высокое';
                        break;
                    default:
                        aqiText = 'Неизвестно';
                }

                document.getElementById('airQuality').innerText = aqiText;
            })
            .catch(error => console.error("Ошибка при получении данных загрязненности воздуха", error));
    }

    updateChart(times, temperatures) {
        if (this.temperatureChart) {
            this.temperatureChart.destroy();
        }

        const ctx = document.getElementById("temperatureChart").getContext("2d");
        this.temperatureChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: times,
                datasets: [{
                    label: "Температура (°C)",
                    data: temperatures,
                    borderColor: "orange",
                    backgroundColor: "rgb(240, 11, 11)",
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: false }
                }
            }
        });
    }
}

class Forecast {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    getForecast(city) {
        const apiUrl = `http://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${this.apiKey}&units=metric&lang=ru`;

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                let forecastBody = document.getElementById('forecastBody');
                forecastBody.innerHTML = '';

                let times = [];
                let temperatures = [];

                data.list.slice(0, 5).forEach(item => {
                    let time = new Date(item.dt * 1000).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' });

                    times.push(time);
                    temperatures.push(Math.round(item.main.temp));

                    let row = `<tr>
                        <td>${time}</td>
                        <td>${Math.round(item.main.temp)}°C</td>
                        <td>${Math.round(item.wind.speed)} м/с</td>
                        <td>${item.main.humidity}%</td>
                    </tr>`;
                    forecastBody.innerHTML += row;
                });

                weatherApp.updateChart(times, temperatures);
            })
            .catch(error => console.error(error));
    }
}

class MapHandler {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.rainMap = null;
        this.initMap();
    }

    initMap() {
        this.rainMap = L.map('rainMap').setView([55.76, 37.64], 10); // Координаты центра карты (Москва)
        L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(this.rainMap);

        this.rainMap.on('mousemove', (e) => {
            const coords = [e.latlng.lat, e.latlng.lng];
            this.showWeatherInfo(coords);
        });
    }

    updateRainMap(lat, lon) {
        this.rainMap.setView([lat, lon], 10);
    }

    updateWeatherLayers(lat, lon) {
        // Пример добавления слоя погоды (осадки)
        L.tileLayer(`http://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${this.apiKey}`, {
            opacity: 0.7
        }).addTo(this.rainMap);

        // Пример добавления слоя температуры
        L.tileLayer(`http://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${this.apiKey}`, {
            opacity: 0.5
        }).addTo(this.rainMap);

        // Пример добавления слоя ветра
        L.tileLayer(`http://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${this.apiKey}`, {
            opacity: 0.5
        }).addTo(this.rainMap);
    }

    showWeatherInfo(coords) {
        const [lat, lon] = coords;
        const apiUrl = `http://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric&lang=ru`;

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                let weatherCondition = '';
                switch (data.weather[0].main) {
                    case 'Rain':
                        weatherCondition = 'Дождь';
                        break;
                    case 'Snow':
                        weatherCondition = 'Снег';
                        break;
                    case 'Clear':
                        weatherCondition = 'Ясно';
                        break;
                    case 'Clouds':
                        weatherCondition = 'Облачно';
                        break;
                    default:
                        weatherCondition = data.weather[0].description;
                }

                const weatherInfo = `
                    <div>
                        <strong>Температура:</strong> ${Math.round(data.main.temp)}°C<br>
                        <strong>Скорость ветра:</strong> ${Math.round(data.wind.speed)} м/с<br>
                        <strong>Погодные условия:</strong> ${weatherCondition}<br>
                    </div>
                `;
                const popup = L.popup()
                    .setLatLng(coords)
                    .setContent(weatherInfo)
                    .openOn(this.rainMap);
            })
            .catch(error => console.error("Ошибка при получении данных погоды", error));
    }
}

class ClockUpdater {
    static updateClock() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        document.getElementById('clock').innerText = `${hours}:${minutes}:${seconds}`;
    }
}

// Инициализация классов
const apiKey = '0faa2fffbd7850892811bcbdad1eec91';
const weatherApp = new WeatherApp(apiKey);
const forecast = new Forecast(apiKey);
const mapHandler = new MapHandler(apiKey);

// Запуск обновления часов каждую секунду
setInterval(ClockUpdater.updateClock, 1000);
ClockUpdater.updateClock();