import redis
import json
import pandas as pd
import pytz
from os import environ as env

from time import sleep
from datetime import datetime, timezone, timedelta

from influxdb_client import InfluxDBClient, Point, WriteOptions, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

CONNECTION_TIMEOUT = 15 # seconds
BATCH_SIZE = 5000 # Optimize for batch size later
UPDATE_QUEUE = "parameter_updates"
STOCK_PRICING_BUCKET = "StockPricing"


local_tz = pytz.timezone("America/New_York")

def get_redis_client(timeout_seconds: int = CONNECTION_TIMEOUT) -> object:

    start_time, time_out = datetime.now(), timedelta(seconds=timeout_seconds)
    redis_client = redis.Redis(host=env.get("REDIS_HOST"), port=env.get("REDIS_PORT"), db=env.get("REDIS_DB"))

    while datetime.now() - start_time < time_out:
        try:
            redis_client.ping()
            return redis_client
        except redis.exceptions.ConnectionError:
            print("Redis client not yet ready. Sleeping for 1 second...")
            sleep(1)

    raise Exception("Redis client not yet ready. Timed out.")


def check_redis_health(redis_client: object):
    try:
        redis_client.ping()
        return redis_client
    except redis.exceptions.ConnectionError:
        return get_redis_client()


def get_stocks() -> pd.DataFrame:

    stocks = pd.read_csv('stocks.csv', index_col=0,)
    stocks = stocks[~stocks.index.duplicated(keep='first')] # Remove duplicate tickers if any
    
    redis_client = get_redis_client()

    for ticker, parameters in stocks.iterrows():
        parameters_json = json.dumps(parameters.to_dict())
        redis_client.set(ticker, parameters_json)
    redis_client.close()

    print(f"Stocks:\n {stocks}")
    return stocks


def get_parameter_updates(redis_client: object) -> pd.DataFrame:

    redis_client = check_redis_health(redis_client)
    print("checking for parameter updates...")

    updates = []
    while (update_data := redis_client.lpop(UPDATE_QUEUE)) is not None:
        updates.append(json.loads(update_data))
    
    if not updates:
        return None

    updates_df = pd.DataFrame(updates).set_index('ticker')
    print("updates_df: ", updates_df)

    return updates_df


def get_influx_client(timeout_seconds: int = CONNECTION_TIMEOUT) -> object:
    start_time, time_out = datetime.now(), timedelta(seconds=timeout_seconds)

    while datetime.now() - start_time < time_out:
        try:
            influx_client = InfluxDBClient.from_env_properties(enable_gzip=True)
            influx_client.ping()
            return influx_client
        except Exception as e:
            sleep(1)

    raise Exception("InfluxDB client not yet ready. Timed out.")


def check_influx_health(influx_client: object):
    try:
        influx_client.ping()
        return influx_client
    except Exception as e:
        return get_influx_client()

def write_points(points: list, influx_client: object, bucket: str):
    influx_client = check_influx_health(influx_client)
    with influx_client as client:
        with client.write_api(write_options=WriteOptions(batch_size=BATCH_SIZE)) as write_api:
            write_api.write(bucket, env.get("INFLUXDB_V2_ORG"), points)


def flush_bucket(bucket: str):
    influx_client = get_influx_client()
    with influx_client as client:
        delete_api = client.delete_api()
        delete_api.delete(
            start="1970-01-01T00:00:00Z",  # Delete from the beginning of time
            stop=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),   # Delete until the end of time
            predicate='_measurement="stocks"',
            bucket=bucket,
            org=env.get("INFLUXDB_V2_ORG"),
        )


def ingest_price_history(price_history: pd.DataFrame):

    flush_bucket(STOCK_PRICING_BUCKET)

    points = []
    for timestamp, stock in price_history.iterrows():
        utc_timestamp = timestamp.astimezone(pytz.utc)
        for ticker, price in stock.items():
            point = Point("stocks").tag("ticker", ticker).field("price", price).time(utc_timestamp, write_precision=WritePrecision.S)
            points.append(point)
    
    influx_client = get_influx_client()
    print(f'Writing History {len(points)} points to InfluxDB')
    write_points(points, influx_client, bucket=STOCK_PRICING_BUCKET)


def ingest_next_prices(prices: pd.DataFrame, influx_client: object, timestamp: pd.Timestamp):

    

    points = []
    for ticker, price  in prices.items():
        utc_timestamp = timestamp.astimezone(pytz.utc)
        point = Point("stocks").tag("ticker", ticker).field("price", price).time(utc_timestamp, write_precision=WritePrecision.S)
        points.append(point)
    
    influx_client = check_influx_health(influx_client)
    print(f'Writing Real-time {len(points)} points to InfluxDB at {timestamp}')
    write_points(points, influx_client, bucket=STOCK_PRICING_BUCKET)

