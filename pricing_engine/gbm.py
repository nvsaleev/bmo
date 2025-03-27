from time import sleep
import numpy as np
import pandas as pd
import pytz

import bmo_db, bmo_time

from os import environ as env
from datetime import datetime, time, date, timedelta

local_tz = pytz.timezone("America/New_York")


np.random.seed(1023) # for reproducibility


def start_pricing_engine():

    sleep(10) # a cludge to wait for Redis and InfluxDB to be ready. Not acceptable for production.
    stocks = bmo_db.get_stocks() # Load initial stock data from Redis
    print(f'Stocks: {stocks}')

    # price stocks from 9:30 EST to current time:
    price_history = compute_price_history(stocks)
    print(f'Price History: {price_history}')
    bmo_db.ingest_price_history(price_history)
    
    last_timestamp = price_history.index[-1]
    last_prices = price_history.iloc[-1].transpose()
    start_repicing(stocks, last_prices, last_timestamp)


def compute_price_history(stocks: pd.DataFrame):
    
    stock_prices = stocks['open']
    price_history = [stock_prices, ]
    minutes_since_trading_start = bmo_time.get_minutes_since_trading_start()

    for _ in range(minutes_since_trading_start):
        stock_prices_next = gbm(stock_prices, stocks)
        price_history.append(stock_prices_next)
        stock_prices = stock_prices_next
    
    today = date.today().strftime("%Y-%m-%d")
    start_time = pd.Timestamp(f'{today} 09:30:00', tz=local_tz)
    timestamps = [start_time + pd.Timedelta(minutes=i) for i in range(len(price_history))]

    print(f'Price History: {price_history[:2]}')

    print('timestamps', len(timestamps))
    print('minutes_since_trading_start:', minutes_since_trading_start)

    price_history = pd.DataFrame(price_history, index=timestamps, columns=stocks.index)
    price_history.index.name = 'timestamp'

    return price_history
   

def gbm(price_t: pd.DataFrame, stocks: pd.DataFrame) -> pd.DataFrame:
    Z = np.random.normal(0, 1, len(stocks))
    a = (stocks['drift'] - 0.5 * (stocks['volatility'] ** 2)) * bmo_time.DT
    b = stocks['volatility'] * np.sqrt(bmo_time.DT) * Z
    return price_t * np.exp(a+b)


def start_repicing(stocks, stock_prices, last_timestamp):

    now = datetime.now() 
    one_minute = timedelta(minutes=1)
    trading_start = now.replace(hour=9, minute=30, second=0, microsecond=0)
    trading_end = now.replace(hour=16, minute=0, second=0, microsecond=0)
   
    print("repricing from ", last_timestamp)
    redis_client = bmo_db.get_redis_client()
    
    while True:
        now = datetime.now() 
        if now < trading_start or now > trading_end:
            return
        elif last_timestamp > pd.Timestamp(datetime.now(), tz=local_tz) - one_minute:
            sleep(2)
        else:
            if (parameter_updates := bmo_db.get_parameter_updates(redis_client)):
                stocks.update(parameter_updates)

            stock_prices_next = gbm(stock_prices, stocks)
            last_timestamp = last_timestamp + pd.Timedelta(minutes=1)
            bmo_db.ingest_next_prices(stock_prices_next, last_timestamp)
            stock_prices = stock_prices_next


if __name__ == "__main__":
    start_pricing_engine()
