package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"

	"github.com/go-redis/redis"
	"github.com/gorilla/mux"
)

// change datatype to string ??
type Stock struct {
	Ticker     string  `json:"ticker"`
	Open       float64 `json:"open"`
	Drift      float64 `json:"drift"`
	Volatility float64 `json:"volatility"`
}

type getStocksResponse struct {
	Stocks []Stock `json:"stocks"`
}

type StockPrice struct {
	Price     float64 `json:"price"`
	Timestamp string  `json:"timestamp"`
}

type getStockPriceHistoryResponse struct {
	PriceHistory []StockPrice `json:"price_history"`
}

func main() {

	rdb := redis.NewClient(&redis.Options{
		Addr:     "redis:6379",
		Password: "",
		DB:       0,
	})
	defer rdb.Close()

	r := mux.NewRouter()

	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), "redis", rdb)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	})

	r.HandleFunc("/api/v1/stocks", getStocks).Methods("GET")
	r.HandleFunc("/api/v1/stocks/{ticker}", getStockPriceHistory).Methods("GET")
	r.HandleFunc("/api/v1/stocks/{ticker}", updateStockParams).Methods("PUT")

	http.ListenAndServe(":8080", r)
}

func getStocks(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rdb := r.Context().Value("redis").(*redis.Client)

	stocks, err := getAllStocksFromRedis(ctx, rdb)

	if err != nil {
		http.Error(w, fmt.Sprintf("Error retrieving stocks: %v", err), http.StatusInternalServerError)
		return
	}

	response := getStocksResponse{
		Stocks: stocks,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// func getStockPriceHistory(w http.ResponseWriter, r *http.Request) {
// 	w.WriteHeader(http.StatusServiceUnavailable)
// 	fmt.Fprint(w, "This resource is under development")
// }

func updateStockParams(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusServiceUnavailable)
	fmt.Fprint(w, "This resource is under development")
}

func getStockPriceHistory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	ticker := vars["ticker"]

	// InfluxDB setup from environment variables
	influxURL := os.Getenv("INFLUXDB_V2_URL")
	influxToken := os.Getenv("INFLUXDB_V2_TOKEN")
	influxOrg := os.Getenv("INFLUXDB_V2_ORG")
	influxBucket := "StockPricing"

	client := influxdb2.NewClient(influxURL, influxToken)
	defer client.Close()

	queryAPI := client.QueryAPI(influxOrg)

	timeRangeStop := time.Now()
	timeRangeStart := timeRangeStop.Add(-24 * time.Hour) // Last hour

	fluxQuery := fmt.Sprintf(`
		from(bucket: "%s")
		|> range(start: %s, stop: %s)
		|> filter(fn: (r) => r["_measurement"] == "stocks")
		|> filter(fn: (r) => r["_field"] == "price")
		|> filter(fn: (r) => r["ticker"] == "%s")
		|> aggregateWindow(every: 1m, fn: last, createEmpty: false)
		|> yield(name: "last")`,
		influxBucket, timeRangeStart.Format(time.RFC3339), timeRangeStop.Format(time.RFC3339), ticker)
	log.Printf("Flux Query: %s", fluxQuery) // Log the query
	result, err := queryAPI.Query(ctx, fluxQuery)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error querying InfluxDB: %v", err), http.StatusInternalServerError)
		return
	}
	defer result.Close()

	priceHistory := []StockPrice{}
	for result.Next() {
		if result.TableChanged() {
			continue
		}

		value := result.Record().Value().(float64)
		timestamp := result.Record().Time().Format(time.RFC3339)

		priceHistory = append(priceHistory, StockPrice{
			Price:     value,
			Timestamp: timestamp,
		})
	}

	if result.Err() != nil {
		http.Error(w, fmt.Sprintf("Error iterating InfluxDB results: %v", result.Err()), http.StatusInternalServerError)
		return
	}

	response := getStockPriceHistoryResponse{
		PriceHistory: priceHistory,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func getAllStocksFromRedis(ctx context.Context, client *redis.Client) ([]Stock, error) {
	keys, err := client.Keys("*").Result() // Get all keys
	if err != nil {
		return nil, fmt.Errorf("error getting keys from redis: %w", err)
	}

	stocks := []Stock{}
	for _, key := range keys {
		val, err := client.Get(key).Result()
		if err != nil {
			log.Printf("Error getting key %s: %v", key, err) // Log error, but continue
			continue
		}

		var stock Stock
		err = json.Unmarshal([]byte(val), &stock)
		stock.Ticker = key
		if err != nil {
			log.Printf("Error unmarshalling key %s: %v", key, err) // Log error, but continue
			continue
		}
		stocks = append(stocks, stock)
	}
	return stocks, nil
}
