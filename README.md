# BMO Pricing Engine

In practice, the ecosystem of trading analytics involves differently organized teams using different technologies. For this reason, in this takehome, I emphasized the architecting of an event-driven containerized distributed system that tolerates eventual consistency within a few seconds. The system is designed to support a universe of 50,000 stocks with up to a few thousand DAU who monitor a basket of 50 stocks. At a high level, the application works as follows:

![Alt text for the image](system_overview.png)

Run the app with `docker compose up --build --force-recreate -d`

While "functional", the application is not production-ready &#9786;. Out of scope are quant model validation and tuning, thourough testing, refactoring, and advanced charting.

## Pricing Engine

Pricing of securities will likely involve integrating financial models that the quant team built with `Python` data stack. For this reason, the pricing engine is run as an independently-scalable and independently-deployable `Python` process. This provides **loose coupling** (e.g. change price generation without affecting the frontend, data access even if the engine is down) and **coherence** (the analytics team is not concerned with serving frontend).

> Deviated from specification: generate prices only for stocks selected by users in the frontend

Following GBM formula, ![Equation](<https://latex.codecogs.com/svg.latex?S_{t+1} = S_t \times e^{(\mu - 0.5 \sigma^2)dt + \sigma \sqrt{dt} Z}>), I generate sample data for about 100 stocks with assuming dt = 1 / (252 days * 390 minutes), volatility of 30%, drift of 10%.

On start, the engine loads stock data from the initial `.csv` file into `Redis` to create a single source of truth for the stock parameters. It then reproducibly prices stocks with `pandas` and `numpy` up to the earlier of current time and 4:00 pm. The generated price history is injected into `InfluxDB`. After that, the process reprices securities every minute, checking for user-updates from a `Redis` queue, and write new data into `InfluxDB`.

The largest dataframe is `price_history` which a matrix of `float64` values across `ticker` columns and `timestamps` index. It's approximate size 150MB: 50,000 stocks &#215; 390 trading minutes &#215; 8 bytes per price / 2^30 bytes in MB. Overall, the system should consume well under 1GB of RAM. If needed, pricing jobs can be partioned by `security_type` or `id`.

## InfluxDB and Redis

InfluxDB and Redis implement event driven communication betwen the pricing engine and the frontend. For example, frontend may react to *new pricing data* event and pricing engine may react to *parameter update* event.

`InfluxDB` is a time series database that supports heavy write loads. It also provides monitoring and query capabilities to the pricing team. The dashoard is available at `http://localhost:8086/`. A high number of tickers can create cardinality and performance issues, especially versions prior to 3.0. Query limitations can create chalanges for complex fincial analysis. Additionally, the trading team is likely to be more familiar with tradional financial time-series databases like KDB+.

`Redis` is an in-memory data store that supports a queue used to push real-time parameter updates to the pricing engine. I also use it to store stock parameters, but, in production, it would be stored in a RDBMS.

## Backend For Frontend

The frontend is served by a light-weight Backend For Frontend (BFF) REST APIs server implemented in `Go` for high performance. Due to time-limitations, the data flow is intirely pull-based: after inital load the frontend polls BFF for updates since `last_timestamp`. If this is unacceptable, push-based approaches can be implemented. For example, a Websockets can subcribe to a `Kafka` topic that serves real-time pricing feed and push data to the dashboard.

### Endpoints

- `POST /api/v1/stocks`: get parameters for each ticker in a list
    - Request: `{ "tickers": ["MSFT","AAPL","GOOG"] }`
    - Resonse: `{ [{"ticker": "MSFT", "drift": 0.2, "volatility": 0.5}, {"ticker": "AAPL", "drift": 0.3, "volatility": 0.4}] }`
- `PATCH /api/v1/stocks`: update parameters for a ticker
    - Request: `{"ticker": "MSFT", "drift": 0.1, "volatility": 0.2}`
- `GET /api/v1/stocks/tickers`: get a list of all tickers priced by the engine
    - Response: `{"tickers": ["MSFT","AAPL","GOOG"]}`
- `POST api/v1/stocks/prices`: get prices for each ticker in a list.
    - Request: `{ "tickers": ["MSFT","AAPL","GOOG"] }`
    - Response: `{"timestamps": [], {"ticker1": [123.45, 123.46], ticker2: [103.47, 103.48]}`
- `POST api/v1/stocks/feed`: get last price for each ticker in a list.
    - Request: `{ "tickers": ["MSFT","AAPL","GOOG"] }`
    - Response: `{ "feed": [{"ticker": "AAPL", "price": 222.68,"timestamp": "2025-04-01T18:25:00Z" },]}`

>Because I send tickers in a JSON body, POST is used to "GET" data. To simplify, I do not make sure that numbers are transported as strings. This might cause precision issues in production. Another (unrealitic) assumption is that all stocks are priced at the same timestamp and that no data is missing.

## Frontend

The frontend is a `React/Next.js` application. The **state** of the application is almost entirely dereminited by list of selected stocks that are passed to the `StockGrid` and `StockChart` components as props. For this reason, state management is done primarally with `useState` and `useEffect`. There's no need to use reducers or context. Similary, the data fetching is simple enough to be done without TanStack Query. This will change as the application grows in complexity. For example, context will be necessary for authentication and authorization.

The `StockGrid` and `StockChart` components use `AgGrid` and `AgCharts` to display the data. The entreprise versions of these libraries allows to customize grids and charts without deploying significant man-power. e.g. zoom on the chart.

## Some Next Steps

* **Validation** of the pricing model and testing: timezones, precision, invalid input handling, etc.
* **UI/UX Improvements** like adding ability to zoom in on the Chart (e.g. enable navigator for entreprise version of AG Grid)
* **API**: documentation and auto-generate client side SDK's with (Swagger / OpenAPI). More informative response messages and robust data handling (Pagination, HATEOAS). Websockets. A dedictated client-side data fetching library like `TanStack Query` or `swr`.
* Reliability, Fault-tolerance, and auto-scaling for the pricing engine.
* **Prod Deployment**:
``` yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pricing-engine
spec:
  replicas: 1
  selector:
    matchLabels:
      app: pricing-engine
  template:
    metadata:
      labels:
        app: pricing-engine
    spec:
      containers:
      - name: pricing-engine
        image: <your-ecr-repo>/pricing-engine:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        env:
        - name: REDIS_HOST
          value: "redis-service"
        - name: INFLUXDB_V2_URL
          value: "http://influxdb-service:8086"
```
