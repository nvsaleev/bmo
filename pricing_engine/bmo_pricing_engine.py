import numpy as np
import pandas as pd
import pytz
from datetime import datetime, date, timedelta
from time import sleep

import bmo_db
import bmo_time

LOCAL_TZ = pytz.timezone("America/New_York")
TRADING_START = datetime.now().replace(hour=9, minute=30, second=0, microsecond=0)
TRADING_END = datetime.now().replace(hour=16, minute=0, second=0, microsecond=0)
np.random.seed(1023) # ensure reproducibility


def start_pricing_engine():

    stocks = bmo_db.get_stocks() # Load initial stock data to (later from) Redis
    price_history = compute_price_history(stocks) # from 9:30 EST to now
    last_prices, last_timestamp = price_history.iloc[-1].transpose(), price_history.index[-1]

    bmo_db.ingest_price_history(price_history)
    start_repricing(stocks, last_prices, last_timestamp)


def compute_price_history(stocks: pd.DataFrame, time_zone: object = LOCAL_TZ) -> pd.DataFrame:
    """
        Compute stock price history using Geometric Brownian Motion
        
        Args:
            stocks (pd.DataFrame): Initial stock parameters
        
        Returns:
            pd.DataFrame: Simulated price history
    """
    stock_prices = stocks['open']
    price_history = [stock_prices, ]
    minutes_since_trading_start = bmo_time.get_minutes_since_trading_start()

    for _ in range(minutes_since_trading_start):
        stock_prices_next = geometric_brownian_motion(stock_prices, stocks)
        price_history.append(stock_prices_next)
        stock_prices = stock_prices_next
    
    today = date.today().strftime("%Y-%m-%d")
    start_time = pd.Timestamp(f'{today} 09:30:00', tz=time_zone)
    timestamps = [start_time + pd.Timedelta(minutes=i) for i in range(len(price_history))]

    price_history = pd.DataFrame(price_history, index=timestamps, columns=stocks.index)
    price_history.index.name = 'timestamp'

    print(f'Price History: {price_history}')

    return price_history


def start_repricing(stocks: pd.DataFrame, stock_prices: pd.Series, last_timestamp: pd.Timestamp, time_zone: object = LOCAL_TZ, trading_start: datetime = TRADING_START, trading_end: datetime = TRADING_END):    
    """
        Continuously reprice stocks during trading hours
        
        Args:
            stocks (pd.DataFrame): Stock parameters
            stock_prices (pd.Series): Last computed stock prices
            last_timestamp (pd.Timestamp): Last price timestamp
    """

    now = datetime.now() 
    one_minute = timedelta(minutes=1)
   
    print("repricing from ", last_timestamp)
    redis_client = bmo_db.get_redis_client()
    influx_client = bmo_db.get_influx_client()
    
    while True:
        now = datetime.now() 
        if now < trading_start or now > trading_end:
            break
        elif last_timestamp > pd.Timestamp(datetime.now(), tz=time_zone) - one_minute:
            sleep(2)
        else:
            if (parameter_updates := bmo_db.get_parameter_updates(redis_client)):
                stocks.update(parameter_updates)

            stock_prices_next = geometric_brownian_motion(stock_prices, stocks)
            last_timestamp = last_timestamp + pd.Timedelta(minutes=1)
            bmo_db.ingest_next_prices(stock_prices_next, influx_client, last_timestamp)
            stock_prices = stock_prices_next
    
    redis_client.close()
    print("Pricing Finished for the day")
    # Run cleanup functions hear


def geometric_brownian_motion(price_t: pd.Series, stocks: pd.DataFrame) -> pd.Series:
    """
        Simulate stock price changes using Geometric Brownian Motion
        
        Args:
            price_t (pd.Series): Current stock prices
            stocks (pd.DataFrame): Stock parameters
        
        Returns:
            pd.Series: Next simulated stock prices
    """
    Z = np.random.normal(0, 1, len(stocks))
    a = (stocks['drift'] - 0.5 * (stocks['volatility'] ** 2)) * bmo_time.DT
    b = stocks['volatility'] * np.sqrt(bmo_time.DT) * Z
    return price_t * np.exp(a+b)


if __name__ == "__main__":
    start_pricing_engine()