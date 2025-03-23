import pandas as pd
from os import environ as env

from influxdb_client import InfluxDBClient, Point, WriteOptions, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

BATCH_SIZE = 500


def ingest_price_history(price_history: pd.DataFrame):


    points = []
    for timestamp, row in price_history.iterrows():
        for ticker, price in row.items():
            point = Point("stocks").tag("ticker", ticker).field("price", price).time(timestamp, write_precision=WritePrecision.S)
            points.append(point)
    print(f'Writing {len(points)} points to InfluxDB')
    # print(points)
    # for i in range(0, len(points), BATCH_SIZE):
    #     write_points(points[i: i+BATCH_SIZE], bucket="stocks")

def ingest_next_prices(price: pd.DataFrame):
    pass


def get_influx_client() -> object:
    return InfluxDBClient(
        url=env.get("INFLUXDB_URL"), 
        token=env.get("INFLUXDB_TOKEN"),
        org=env.get("INFLUXDB_ORG"),
        timeout=300_000
    )


def write_points(points: list, bucket: str):

    client = get_influx_client()
    write_api = client.write_api(write_options=SYNCHRONOUS)
    write_api.write(bucket=bucket, org=env.get("INFLUXDB_ORG"), record=points)

    client.close()