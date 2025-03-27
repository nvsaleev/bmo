from datetime import datetime

TRADING_MINUTES = 390
TRADNG_DAYS = 252
TRADING_MINUTES = 390
DT = 1 / (TRADNG_DAYS * TRADING_MINUTES)


def get_minutes_since_trading_start():

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