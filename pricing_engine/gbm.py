import time
import numpy as np
import pandas as pd

from datetime import datetime, time, date, timedelta
from influx import ingest_price_history, ingest_next_prices


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

    start_time = pd.Timestamp(f'{today} 09:30:00')
    timestamps = [start_time + pd.Timedelta(minutes=i) for i in range(len(price_history))]
    price_history = pd.DataFrame(price_history, index=timestamps, columns=stocks.index)
    price_history.index.name = 'timestamp'

    # print(price_history)
    
    last_timestamp = price_history.index[-1]
    
    # start_repicing(stock_prices, stocks, last_timestamp)
    # print("Start repricing", stock_prices, stocks, last_timestamp)

    # injest data in InluxDB
    ingest_price_history(price_history)



    

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
    return pd.read_csv('stocks.csv', index_col=0)

def start_repicing(stock_prices, stocks, last_timestamp):

    now = datetime.now()
    four_pm = now.replace(hour=16, minute=0, second=0, microsecond=0)
    if now < four_pm:
        four_pm -= timedelta(days=1)

    print(now)
    print(four_pm)

    if now >= four_pm:
        return



    # Start minutely repricing process with latest data that
    # injests data into InfluxDB and updates Redis Latest Prices
    print(last_timestamp)
    print(datetime.now())

    one_minute = timedelta(minutes=1)

    while True:
        if last_timestamp > pd.Timestamp(datetime.now()) - one_minute:
            time.sleep(15)
        else:
            stocks = update_stocks(stocks)
            stock_prices_next = gbm(stock_prices, stocks)
            ingest_next_prices(stock_prices_next)
            last_timestamp = last_timestamp + pd.Timedelta(minutes=1)
            stock_prices = stock_prices_next



def update_stocks(stocks: pd.DataFrame):
    # update stocks from Redis check in Redis if parameters were updated by the user
    return stocks

start_pricing_engine()
