# BMO Pricing Engine

## Overview & Assumptions

In this takehome, I emphasized the architecting of a scalable containerized distributed system that tolerates eventual consistency within a few seconds. The system is designed to support a universe of 50,000 stocks with up to a few thousand DAU who monitor a basket of 50 stocks. At a high level, the application works as follows:

![Alt text for the image](system_overview.png)

Run the app with `docker compose up --build --force-recreate -d`

While "functional", the application is not production-ready &#9786;. Out of scope are quant model validation and tuning, thourough testing, refactoring, and advanced charting.

## Pricing Engine

Pricing of securities will likely involve integrating financial models that the quant team built with `Python` data stack. For this reason, the pricing engine is run as an independently deployable and scalable `Python` process.

> Deviated from specification: generate prices only for stocks selected by users in the frontend

On start, the engine loads stock data from the initial `.csv` file into `Redis` to create a single source of truth for the stock parameters. It then reproducibly prices stocks with `pandas` and `numpy` up to the earlier of current time and 4:00 pm. The generated price history is injected into `InfluxDB`. After that, the process reprices securities every minute, checking for user-updates from a `Redis` queue, and write new data into `InfluxDB`.

The largest dataframe is `price_history` which a matrix of `float64` values across `ticker` columns and `timestamps` index. It's approximate size 160MB: 50,000 stocks &#215; 390 trading minutes &#215; 8 bytes per price = 156 MB. Overall, the system should consume well under 1GB of RAM. If needed, pricing jobs can be partioned by `security_type` or `id`.

Following GBM formula, ![Equation](<https://latex.codecogs.com/svg.latex?S_{t+1} = S_t \times e^{(\mu - 0.5 \sigma^2)dt + \sigma \sqrt{dt} Z}>), I generate sample data for about 100 stocks with assuming dt = 1 / (252 days * 390 minutes), volatility of 30%, drift of 10%.

## InfluxDB and Redis

`InfluxDB` is a time series database that supports heavy write loads. It also provides monitoring and query capabilities to the pricing team. The dashoard is available at `http://localhost:8086/`. A high number of tickers can create cardinality and performance issues, especially versions priot to 3.0. Query limitation can create chalanges for complex fincial analysis. Additionally, the trading team is likely to be more familiar with tradional time-series databases like KDB+.

`Redis` is an in-memory data store that supports a queue used to push real-time parameter updates to the pricing engine. I also use it to store stock parameters, but, in production, it would be stored in a RDBMS.

## Backend For Frontend

The frontend is served by a light-weight Backend For Frontend (BFF) REST APIs server implemented in `Go` for high performance. Due to time-limitations, the data flow is intirely pull-based: after inital load the frontend polls BFF for updates since `last_timestamp`. If this is unacceptable, push-based approaches can be implemented. For example, a Websockets can subcribe to a `Kafka` topic that serves real-time pricing feed and push data to the dashboard.

> To simplify, I do not make sure that numbers are compunicated as strings. This might cause precision issues in production. Another (unrealitic) assumption is that all stocks are priced at the same timestamp and that no data is missing.

### Endpoints:

- `GET /api/v1/tickers`: get a list of all tickers priced by the engine
    - Response: `{"tickers": ["MSFT","AAPL","GOOG"]}`
- `POST /api/v1/stocks`: get parameters for each ticker in a list
    - Request: `{ "tickers": ["MSFT","AAPL","GOOG"] }`
    - Resonse: `{ [{"ticker": "MSFT", "drift": 0.2, "volatility": 0.5}, {"ticker": "AAPL", "drift": 0.3, "volatility": 0.4}] }`
- `PUT /api/v1/stocks`: update parameters for each ticker in a list 
    - Request: `{ [{"ticker": "MSFT", "drift": 0.1, "volatility": 0.2}, {"ticker": "AAPL", "drift": 0.3, "volatility": 0.4}] }`
- `POST api/v1/prices`: get prices for each ticker in a list.
    - Request: `{ "tickers": ["MSFT","AAPL","GOOG"], "after_timestamp": 1679123200 | null }`
    - Response: `{"timestamps": [], {"ticker1": [123.45, 123.46], ticker2: [103.47, 103.48]}`


## Frontend

The frontend is `React/Next.js` application that uses `AgGrid` and `AgCharts` to display the data. The entreprise versions of these libraries allows to customize grids and charts without deploying significant man-power. e.g. zoom on the chart.
There is no multi-user support and some UX features are lacking.

## Some Next Steps

* Tesing and validation of the model: e.g. annualization conventions for volatility and drift given trading days and trading minutes.
* UX Improvements like adding ability to zoom in on the Chart (e.g. enable navigator for entreprise version)
* Data Fetching: while data logic for this applications is simple, we can consider using a dedictated data fetching library like `react-query` or `swr`.
* Refactoring: there's a fair amount of boileplate code or inaptly named variables and functions.
* The pricing engine should be factored into a robust job queue with retry cababilities.
* Reliability, Fault-tolerance, and auto-scaling provisions.
