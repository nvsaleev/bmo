from time import sleep
import numpy as np
import pandas as pd
import pytz

import redis
import json

from os import environ as env
from datetime import datetime, time, date, timedelta
from influx import ingest_price_history, ingest_next_prices

local_tz = pytz.timezone("America/New_York")

TRADNG_DAYS = 252
TRADING_MINUTES = 390
DT = 1 / (TRADNG_DAYS * TRADING_MINUTES)

np.random.seed(1023)


# define a decorator to flush InfluxDB in case of failure
def start_pricing_engine():

    # Load initial stock data from Redis
    stocks = get_stocks()

    # price stocks from 9:30 to current time
    stock_prices = stocks['open']
    price_history = [stock_prices, ]
    trading_minutes = trading_minutes_elapsed()
    # print(f'Trading for {trading_minutes} minutes')
    

    for _ in range(trading_minutes): # ? -1
        stock_prices_next = gbm(stock_prices, stocks)
        price_history.append(stock_prices_next)
        stock_prices = stock_prices_next
    
    today = date.today().strftime("%Y-%m-%d")

    start_time = pd.Timestamp(f'{today} 09:30:00', tz=local_tz)
    timestamps = [start_time + pd.Timedelta(minutes=i) for i in range(len(price_history))]
    price_history = pd.DataFrame(price_history, index=timestamps, columns=stocks.index,)
    price_history.index.name = 'timestamp'

    # print(price_history)
    
    last_timestamp = price_history.index[-1]
    
    print(price_history)
    ingest_price_history(price_history)
    start_repicing(stock_prices, stocks, last_timestamp)



    

def gbm(price_t: pd.DataFrame, stocks: pd.DataFrame) -> pd.DataFrame:
    Z = random_vector = np.random.normal(0, 1, len(stocks))
    a = (stocks['drift'] - 0.5 * (stocks['volatility'] ** 2)) * DT
    b = stocks['volatility'] * np.sqrt(DT) * Z
    return stocks['open'] * np.exp(a+b)


def trading_minutes_elapsed():

    now = datetime.now()
    trading_start = now.replace(hour=9, minute=30, second=0, microsecond=0)
    trading_end = now.replace(hour=16, minute=0, second=0, microsecond=0)

    if now < trading_start:
        return 0
    elif now >= trading_end:
        return TRADING_MINUTES
    else:
        time_difference = now - trading_start
        elapsed_minutes = int(time_difference.total_seconds() / 60)
        return elapsed_minutes



def get_stocks():

    stocks = pd.read_csv('stocks.csv', index_col=0)
    r = redis.Redis(host=env.get("REDIS_HOST"), port=env.get("REDIS_PORT"), db=env.get("REDIS_DB"))
    
    for index, row in stocks.iterrows():
        row_json = json.dumps(row.to_dict())
        r.set(index, row_json)
        print(f"Stored {index}: {row_json}")

    return stocks

def start_repicing(stock_prices, stocks, last_timestamp):


    now = datetime.now()
    one_minute = timedelta(minutes=1)
    trading_start = now.replace(hour=9, minute=30, second=0, microsecond=0)
    trading_end = now.replace(hour=16, minute=0, second=0, microsecond=0)

   
    print("repricing from ", last_timestamp)

    r = redis.Redis(host=env.get("REDIS_HOST"), port=env.get("REDIS_PORT"), db=env.get("REDIS_DB"))
    
    
    while True:
        if now < trading_start or now >= trading_end:
            return
        elif last_timestamp > pd.Timestamp(datetime.now(), tz=local_tz) - one_minute:
            sleep(2)
        else:
            update_json = r.lpop("parameter_updates")
            if update_json:
                updates = json.loads(update_json)
                print("updates", updates)
                update_df = pd.DataFrame.from_dict(updates, orient='index', columns=['volatility', 'drift'])
                stocks.update(update_df)

            stock_prices_next = gbm(stock_prices, stocks)
            last_timestamp = last_timestamp + pd.Timedelta(minutes=1)
            ingest_next_prices(stock_prices_next, last_timestamp)
            stock_prices = stock_prices_next





start_pricing_engine()
