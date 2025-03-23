import pandas as pd
from os import environ as env

from influxdb_client import InfluxDBClient, Point, WriteOptions
from influxdb_client.client.write_api import SYNCHRONOUS


def ingest_price_history(price_history: pd.DataFrame):
    pass

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