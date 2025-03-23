import datetime
import numpy as np
import pandas as pd
import time
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
    print(f'Trading for {trading_minutes} minutes')

    for _ in range(trading_minutes): # ? -1
        stock_prices_next = gbm(stock_prices, stocks)
        price_history.append(stock_prices_next)
        stock_prices = stock_prices_next
    
    today = datetime.date.today().strftime("%Y-%m-%d")

    start_time = pd.Timestamp(f'{today} 09:30:00')
    timestamps = [start_time + pd.Timedelta(minutes=i) for i in range(len(price_history))]
    price_history = pd.DataFrame(price_history, index=timestamps, columns=stocks.index)
    price_history.index.name = 'timestamp'
    
    last_timestamp = price_history.index[-1]
    
    start_repicing(stock_prices, stocks, last_timestamp)

    # injest data in InluxDB
    ingest_price_history(price_history)



    

def gbm(price_t: pd.DataFrame, stocks: pd.DataFrame) -> pd.DataFrame:
    Z = random_vector = np.random.normal(0, 1, len(stocks))
    a = (stocks['drift'] - 0.5 * (stocks['volatility'] ** 2)) * DT
    b = stocks['volatility'] * np.sqrt(DT) * Z
    return stocks['open'] * np.exp(a+b)


def repicing():
    pass
    

def trading_minutes_elapsed():

    trading_start = datetime.time(9, 30)
    trading_end = datetime.time(16, 0)
    current_time = datetime.datetime.now().time()

    start_datetime = datetime.datetime.combine(datetime.date.today(), trading_start)
    end_datetime = datetime.datetime.combine(datetime.date.today(), trading_end)
    current_datetime = datetime.datetime.combine(datetime.date.today(), current_time)

    # Determine the effective end time
    effective_end = min(end_datetime, current_datetime)

    # Calculate the time difference
    time_difference = effective_end - start_datetime

    # Calculate the elapsed minutes
    elapsed_minutes = int(time_difference.total_seconds() / 60)

    if elapsed_minutes < 0:
        return TRADING_MINUTES

    return elapsed_minutes


def get_stocks():
    return pd.read_csv('stocks.csv', index_col=0)

def start_repicing(stock_prices, stocks, last_timestamp):

    now = datetime.datetime.now()
    four_pm = now.replace(hour=16, minute=0, second=0, microsecond=0)
    if now < four_pm:
        four_pm -= datetime.timedelta(days=1)

    print(now)
    print(four_pm)

    if now >= four_pm:
        return



    # Start minutely repricing process with latest data that
    # injests data into InfluxDB and updates Redis Latest Prices
    print(last_timestamp)
    print(datetime.datetime.now())

    one_minute = datetime.timedelta(minutes=1)

    while True:
        if last_timestamp > pd.Timestamp(datetime.datetime.now()) - one_minute:
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
