package main

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
)

// type getLeaderResponse struct {
// 	Total int        `json:"total"`
// 	Data  []UserInfo `json:"data"`
// }

// type UserInfo struct {
// 	UserId string `json:"user_id"`
// 	Score  int    `json:"score"`
// 	Rank   int    `json:"rank"`
// }

// type User struct {
// 	UserId string `json:"user_id"`
// 	Score  int    `json:"score"`
// }

func main() {

	r := mux.NewRouter()

	r.HandleFunc("/v1/stocks", getStocks).Methods("GET")
	r.HandleFunc("/v1/stocks/{userId}", getStockPriceHistory).Methods("GET")
	r.HandleFunc("/v1/stocks/{userId}", updateStockParams).Methods("PUT")

	http.ListenAndServe(":8003", r)
}

func updateScore(w http.ResponseWriter, r *http.Request) {

	var user User
	json.NewDecoder(r.Body).Decode(&user)

	client := getRedisClient()
	defer client.Close()

	if _, err := client.ZIncrBy("userRanks", 1.0, user.UserId).Result(); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		panic(err)
		fmt.Fprint(w, "Failed to update score")
	} else {
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "OK")
	}

}

func getLeaders(w http.ResponseWriter, r *http.Request) {

	client := getRedisClient()
	defer client.Close()

	if leaders, err := client.ZRevRangeWithScores("userRanks", 0, 9).Result(); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprint(w, "Failed to update score")
	} else {
		users := make([]UserInfo, 10)

		for rank, user := range leaders {
			users[rank] = UserInfo{user.Member.(string), int(user.Score), rank}
		}

		response := getLeaderResponse{10, users}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}

}

func getUser(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusServiceUnavailable)
	fmt.Fprint(w, "This resource is under development")

}

func getRedisClient() *redis.Client {

	client := redis.NewClient(&redis.Options{
		Addr: "redis:6379", // Replace with your Redis server address
		DB:   0,            // Select the default database
	})

	return client
}
