import redis
import json
import pandas as pd
import pytz
from os import environ as env

from datetime import datetime, timezone

from influxdb_client import InfluxDBClient, Point, WriteOptions, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

BATCH_SIZE = 1000

local_tz = pytz.timezone("America/New_York")


def ingest_price_history(price_history: pd.DataFrame):

    flush_bucket("StockPricing")

    points = []
    for timestamp, row in price_history.iterrows():
        utc_timestamp = timestamp.astimezone(pytz.utc)
        for ticker, price in row.items():
            point = Point("stocks").tag("ticker", ticker).field("price", price).time(utc_timestamp, write_precision=WritePrecision.S)
            points.append(point)
    
    print(f'Writing History {len(points)} points to InfluxDB')
    for i in range(0, len(points), BATCH_SIZE):
        write_points(points[i: i+BATCH_SIZE], bucket="StockPricing")

def ingest_next_prices(prices: pd.DataFrame, timestamp: pd.Timestamp):

    points = []
    for ticker, price  in prices.items():
        utc_timestamp = timestamp.astimezone(pytz.utc)
        point = Point("stocks").tag("ticker", ticker).field("price", price).time(utc_timestamp, write_precision=WritePrecision.S)
        points.append(point)
    
    print(f'Writing Real-time {len(points)} points to InfluxDB at {timestamp}')
   
    for i in range(0, len(points), BATCH_SIZE):
        write_points(points[i: i+BATCH_SIZE], bucket="StockPricing")


def get_influx_client() -> object:
    return InfluxDBClient.from_env_properties(enable_gzip=True) # retries = urlib3.Retry(connect=5, read=2, redirect=5)


def write_points(points: list, bucket: str):
    with InfluxDBClient.from_env_properties(enable_gzip=True) as client:
        with client.write_api(write_options=WriteOptions(batch_size=BATCH_SIZE)) as write_api:
            write_api.write(bucket, env.get("INFLUXDB_V2_ORG"), points)

def flush_bucket(bucket: str):
    with InfluxDBClient.from_env_properties(enable_gzip=True) as client:
        delete_api = client.delete_api()
        delete_api.delete(
            start="1970-01-01T00:00:00Z",  # Delete from the beginning of time
            stop=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),   # Delete until the end of time
            predicate='_measurement="stocks"',
            bucket=bucket,
            org=env.get("INFLUXDB_V2_ORG"),
        )


def get_stocks():

    # close Redit client with decorator?

    stocks = pd.read_csv('stocks.csv', index_col=0,)
    stocks = stocks[~stocks.index.duplicated(keep='first')]
    redis_client = redis.Redis(host=env.get("REDIS_HOST"), port=env.get("REDIS_PORT"), db=env.get("REDIS_DB"))
    
    for index, row in stocks.iterrows():
        row_json = json.dumps(row.to_dict())
        redis_client.set(index, row_json)

    return stocks


def get_redis_client() -> object:
    return redis.Redis(host=env.get("REDIS_HOST"), port=env.get("REDIS_PORT"), db=env.get("REDIS_DB"))


def get_parameter_updates(redis_client) -> dict:

    print("checking for parameter updates...")

    updates = []
    while (update_data := redis_client.lpop("parameter_updates")) is not None:
        updates.append(json.loads(update_data))
    
    if not updates:
        return None

    updates_df = pd.DataFrame(updates).set_index('ticker')
    print("updates_df", updates_df)

    return updates_df