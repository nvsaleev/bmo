package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
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

type TickerRequest struct {
	Tickers []string `json:"tickers"`
}

type UpdateParametersRequest struct {
	Ticker     string  `json:"ticker"`
	Drift      float64 `json:"drift"`
	Volatility float64 `json:"volatility"`
}

type StockParametersResponse struct {
	Stocks []Stock `json:"stocks"`
}

type getStocksResponse struct {
	Tickers []string `json:"tickers"`
}

type StockPriceHistory struct {
	Ticker string    `json:"ticker"`
	Prices []float64 `json:"prices"`
}

type getStockPriceHistoryResponse struct {
	PriceHistory []StockPriceHistory `json:"price_history"`
	Timestamp    []string            `json:"timestamp"`
}

type StockPrice struct {
	Ticker    string  `json:"ticker"`
	Price     float64 `json:"price"`
	Timestamp string  `json:"timestamp"`
}

type getFeedResponse struct {
	Feed []StockPrice `json:"feed"`
}

func main() {

	rdb := redis.NewClient(&redis.Options{
		Addr:     "redis:6379",
		Password: "",
		DB:       0,
	})
	defer rdb.Close()

	r := mux.NewRouter()
	r.Use(enableCORS)
	r.Methods("OPTIONS").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.WriteHeader(http.StatusOK)
	})

	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), "redis", rdb)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	})

	r.HandleFunc("/api/v1/tickers", getStocks).Methods("GET")
	r.HandleFunc("/api/v1/stocks/feed", getFeed).Methods("POST")
	r.HandleFunc("/api/v1/stocks/history", getStockPriceHistory).Methods("POST")
	r.HandleFunc("/api/v1/stocks", updateStockParams).Methods("PUT")
	r.HandleFunc("/api/v1/stocks", getStockParameters).Methods("POST")

	http.ListenAndServe(":8080", r)
}

func getStocks(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rdb := r.Context().Value("redis").(*redis.Client)

	tickers, err := getAllTickersFromRedis(ctx, rdb)

	if err != nil {
		http.Error(w, fmt.Sprintf("Error retrieving stocks: %v", err), http.StatusInternalServerError)
		return
	}

	response := getStocksResponse{
		Tickers: tickers,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func getStockParameters(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rdb := r.Context().Value("redis").(*redis.Client)

	var tickerRequest TickerRequest
	err := json.NewDecoder(r.Body).Decode(&tickerRequest)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error decoding request body: %v", err), http.StatusBadRequest)
		return
	}

	tickers := tickerRequest.Tickers

	stocks, err := getStockParametersFromRedis(ctx, rdb, tickers)

	if err != nil {
		http.Error(w, fmt.Sprintf("Error retrieving stocks: %v", err), http.StatusInternalServerError)
		return
	}

	response := StockParametersResponse{
		Stocks: stocks,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func updateStockParams(w http.ResponseWriter, r *http.Request) {

	ctx := r.Context()
	rdb := r.Context().Value("redis").(*redis.Client)

	var updateRequest UpdateParametersRequest
	err := json.NewDecoder(r.Body).Decode(&updateRequest)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error decoding request body: %v", err), http.StatusBadRequest)
		return
	}

	updatedStock, err := updateStockParametersInRedis(ctx, rdb, updateRequest)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error updating stock parameters: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updatedStock)
}

func getStockPriceHistory(w http.ResponseWriter, r *http.Request) {
	// Decode ticker request
	var tickerRequest TickerRequest
	err := json.NewDecoder(r.Body).Decode(&tickerRequest)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error decoding request body: %v", err), http.StatusBadRequest)
		return
	}

	// Check if tickers are provided
	if len(tickerRequest.Tickers) == 0 {
		http.Error(w, "No tickers provided", http.StatusBadRequest)
		return
	}

	// InfluxDB setup from environment variables
	influxURL := os.Getenv("INFLUXDB_V2_URL")
	influxToken := os.Getenv("INFLUXDB_V2_TOKEN")
	influxOrg := os.Getenv("INFLUXDB_V2_ORG") // Required for InfluxDB v2
	influxBucket := "StockPricing"

	if influxOrg == "" {
		http.Error(w, "InfluxDB organization not set", http.StatusInternalServerError)
		return
	}

	// Create InfluxDB client
	client := influxdb2.NewClient(influxURL, influxToken)
	defer client.Close()

	// Set time range (last 24 hours)
	timeRangeStop := time.Now()
	timeRangeStart := timeRangeStop.Add(-24 * time.Hour)

	// Construct Flux query with proper tickers array
	tickersFlux := fmt.Sprintf(`["%s"]`, strings.Join(tickerRequest.Tickers, `", "`))
	fluxQuery := fmt.Sprintf(`
        from(bucket: "%s")
        |> range(start: %s, stop: %s)
        |> filter(fn: (r) => r["_measurement"] == "stocks")
        |> filter(fn: (r) => r["_field"] == "price")
        |> filter(fn: (r) => contains(value: r["ticker"], set: %s))`,
		influxBucket,
		timeRangeStart.Format(time.RFC3339),
		timeRangeStop.Format(time.RFC3339),
		tickersFlux)
	log.Printf("Flux Query: %s", fluxQuery) // Log the query for debugging

	// Execute query
	queryAPI := client.QueryAPI(influxOrg)
	result, err := queryAPI.Query(r.Context(), fluxQuery)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error executing query: %v", err), http.StatusInternalServerError)
		return
	}

	// Prepare response structures
	response := &getStockPriceHistoryResponse{
		PriceHistory: []StockPriceHistory{},
		Timestamp:    []string{},
	}

	// Use a map to track prices and timestamps
	data := make(map[string]map[string]float64) // ticker -> timestamp -> price
	allTimestamps := make(map[string]struct{})  // Unique timestamps

	// Process query results
	for result.Next() {
		record := result.Record()
		ticker, ok := record.ValueByKey("ticker").(string)
		if !ok {
			continue // Skip if ticker is not a string
		}
		price, ok := record.Value().(float64)
		if !ok {
			continue // Skip if price is not a float64
		}
		timestamp := record.Time().Format(time.RFC3339)

		// Initialize ticker map if not present
		if _, exists := data[ticker]; !exists {
			data[ticker] = make(map[string]float64)
		}
		data[ticker][timestamp] = price
		allTimestamps[timestamp] = struct{}{}
	}

	// Check for query errors
	if err := result.Err(); err != nil {
		http.Error(w, fmt.Sprintf("Query result error: %v", err), http.StatusInternalServerError)
		return
	}

	// Sort timestamps
	timestamps := make([]string, 0, len(allTimestamps))
	for ts := range allTimestamps {
		timestamps = append(timestamps, ts)
	}
	sort.Strings(timestamps)
	response.Timestamp = timestamps

	// Construct price history for each ticker
	for ticker := range data {
		prices := make([]float64, len(timestamps))
		for i, ts := range timestamps {
			if price, exists := data[ticker][ts]; exists {
				prices[i] = price
			} else {
				prices[i] = 0.0 // Default value for missing data
			}
		}
		response.PriceHistory = append(response.PriceHistory, StockPriceHistory{
			Ticker: ticker,
			Prices: prices,
		})
	}

	// Respond with JSON
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func getAllTickersFromRedis(ctx context.Context, client *redis.Client) ([]string, error) {
	// Use SCAN instead of KEYS for better performance in production
	var tickers []string
	var cursor uint64

	for {
		var keys []string
		var err error

		// Scan keys in batches (pagination)
		keys, cursor, err = client.Scan(cursor, "*", 100).Result()
		if err != nil {
			return nil, fmt.Errorf("error scanning keys from redis: %w", err)
		}

		// Filter during iteration
		for _, key := range keys {
			if !strings.Contains(key, "parameter_updates") {
				tickers = append(tickers, key)
			}
		}

		// Exit when we've scanned all keys
		if cursor == 0 {
			break
		}
	}

	return tickers, nil
}

func getStockParametersFromRedis(ctx context.Context, client *redis.Client, keys []string) ([]Stock, error) {

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

func updateStockParametersInRedis(ctx context.Context, client *redis.Client, updateRequest UpdateParametersRequest) (Stock, error) {

	key := updateRequest.Ticker

	val, err := client.Get(key).Result()
	if err != nil {
		return Stock{}, fmt.Errorf("error getting key %s: %v", key, err)
	}

	var stock Stock
	err = json.Unmarshal([]byte(val), &stock)
	if err != nil {
		return Stock{}, fmt.Errorf("error unmarshalling key %s: %v", key, err)
	}

	stock.Volatility = updateRequest.Volatility
	stock.Drift = updateRequest.Drift
	stock.Ticker = updateRequest.Ticker

	stockJSON, err := json.Marshal(stock)
	if err != nil {
		return Stock{}, fmt.Errorf("error marshalling updated stock: %v", err)
	}

	err = client.RPush("parameter_updates", stockJSON).Err()
	if err != nil {
		return Stock{}, fmt.Errorf("error setting updated stock in Redis: %v", err)
	}

	err = client.Set(key, stockJSON, 0).Err()
	if err != nil {
		return Stock{}, fmt.Errorf("error setting updated stock in Redis: %v", err)
	}

	return stock, nil
}

func getFeed(w http.ResponseWriter, r *http.Request) {
	// Decode ticker request
	var tickerRequest TickerRequest
	err := json.NewDecoder(r.Body).Decode(&tickerRequest)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error decoding request body: %v", err), http.StatusBadRequest)
		return
	}

	// Check if tickers are provided
	if len(tickerRequest.Tickers) == 0 {
		http.Error(w, "No tickers provided", http.StatusBadRequest)
		return
	}

	// InfluxDB setup from environment variables
	influxURL := os.Getenv("INFLUXDB_V2_URL")
	influxToken := os.Getenv("INFLUXDB_V2_TOKEN")
	influxOrg := os.Getenv("INFLUXDB_V2_ORG") // Required for InfluxDB v2
	influxBucket := "StockPricing"

	if influxOrg == "" {
		http.Error(w, "InfluxDB organization not set", http.StatusInternalServerError)
		return
	}

	// Create InfluxDB client
	client := influxdb2.NewClient(influxURL, influxToken)
	defer client.Close()

	// Set time range (last 24 hours)
	timeRangeStop := time.Now()
	timeRangeStart := timeRangeStop.Add(-24 * time.Hour)

	// Construct Flux query with proper tickers array
	tickersFlux := fmt.Sprintf(`["%s"]`, strings.Join(tickerRequest.Tickers, `", "`))
	fluxQuery := fmt.Sprintf(`
	from(bucket: "%s")
	|> range(start: %s, stop: %s)
	|> filter(fn: (r) => r["_measurement"] == "stocks")
	|> filter(fn: (r) => r["_field"] == "price")
	|> filter(fn: (r) => contains(value: r["ticker"], set: %s))
	|> last()`,
		influxBucket,
		timeRangeStart.Format(time.RFC3339),
		timeRangeStop.Format(time.RFC3339),
		tickersFlux)

	log.Printf("Flux Query: %s", fluxQuery) // Log the query for debugging

	// Execute query
	queryAPI := client.QueryAPI(influxOrg)
	result, err := queryAPI.Query(r.Context(), fluxQuery)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error executing query: %v", err), http.StatusInternalServerError)
		return
	}

	// Slice to hold StockPrice instances
	var feed []StockPrice

	// Iterate over query results
	for result.Next() {
		record := result.Record()

		// Extract ticker (tag), price (value), and timestamp
		ticker, ok := record.ValueByKey("ticker").(string)
		if !ok {
			continue // Skip if ticker is invalid
		}
		price, ok := record.Value().(float64)
		if !ok {
			continue // Skip if price is invalid
		}
		timestamp := record.Time().Format(time.RFC3339) // Convert time to string

		// Create and append StockPrice instance
		stockPrice := StockPrice{
			Ticker:    ticker,
			Price:     price,
			Timestamp: timestamp,
		}
		feed = append(feed, stockPrice)
	}

	// Check for errors in the result set
	if err := result.Err(); err != nil {
		http.Error(w, fmt.Sprintf("Query result error: %v", err), http.StatusInternalServerError)
		return
	}

	// Build the response
	response := getFeedResponse{
		Feed: feed,
	}

	// Serialize to JSON and write response
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, fmt.Sprintf("Error encoding response: %v", err), http.StatusInternalServerError)
		return
	}
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")    // Allow Next.js origin
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS") // Add POST
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")            // Adjust headers as needed

		// Handle preflight OPTIONS request
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Pass to the next handler
		next.ServeHTTP(w, r)
	})
}
